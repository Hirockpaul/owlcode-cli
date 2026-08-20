import { Hono } from "hono";
import {  streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import{ z} from "zod"
import{streamText as aiStreamText, stepCountIs} from "ai"
import {db} from "@owlcode/database/client"
import{Mode, MessageStatus, } from "@owlcode/database/enums"
import {  
    type ChatStreamEvent ,
    type MessagePart,
     toolcallArgsSchema,
     messagePartsSchema
} from "@owlcode/shared";
import { isSupportedChatModel, resolveChatModel } from "../lib/model";
import type { Prisma } from "@owlcode/database";
import {createTools} from "../tools"
import { buildSystemPrompt } from "../../system-prompt";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { randomUUID } from "node:crypto";

import type { LanguageModelUsage } from "ai";
import { requireCreditsBalance } from "../middleware/require-credits-balance";
import { calculateCreditsForUsage } from "../lib/credits";
import { ingestAiUsage } from "../lib/polar";

const  submitSchema = z.object ({
    content: z.string(),
    mode: z.enum(Mode),
    model: z.string().refine(isSupportedChatModel,"Unsupported model"),
});

const submitValidator = zValidator("json", submitSchema, (result, c) => {
    if(!result.success) {
        return c.json({error: "Invalid request body"}, 400);
    }
})

const activeResumeSessionIds = new Set<string>();
const activeRegenerateSessionIds = new Set<string>();

type ClientMessagePart =
    | {type: "text" | "reasoning"; text: string}
    | {
        type: `tool-${string}`;
        toolCallId: string;
        input?: unknown;
        state?: "input-available" | "output-available" | "output-error";
        output?: unknown;
        errorText?: string;
    };

type StoredChatMessage = {
    id: string;
    role: "user" | "assistant" | "error" | "USER" | "ASSISTANT" | "ERROR";
    parts?: ClientMessagePart[];
    content?: string;
    status?: MessageStatus;
    model?: string;
    mode?: Mode;
    metadata?: {
        mode?: Mode;
        model?: string;
        durationMs?: number;
        status?: MessageStatus;
    };
};

function readSessionMessages(messages: Prisma.JsonValue): StoredChatMessage[] {
    return Array.isArray(messages) ? (messages as StoredChatMessage[]) : [];
}

function getSessionCwd(session: unknown) {
    return (session as {cwd?: string | null}).cwd ?? null;
}

function getMessageText(message: StoredChatMessage) {
    if(typeof message.content === "string") return message.content;

    return (message.parts ?? [])
        .flatMap((p) => p.type === "text" ? [p.text] : [])
        .join("");
}

function toClientParts(parts: MessagePart[]): ClientMessagePart[] {
    return parts.map((part) => {
        if(part.type === "tool-call") {
            return {
                type: `tool-${part.name}` as const,
                toolCallId: part.id,
                input: part.args,
                state: part.result ? ("output-available" as const) : ("input-available" as const),
                output: part.result,
            };
        }

        return part;
    });
}

async function appendSessionMessage(
    sessionId: string,
    userId: string,
    message: StoredChatMessage,
) {
    const session = await db.session.findFirst({
        where: {id: sessionId, userId},
        select: {messages: true},
    });

    if(!session) return null;

    const messages = readSessionMessages(session.messages);
    await db.session.update({
        where: {id: sessionId},
        data: {
            messages: [...messages, message] as Prisma.InputJsonValue,
        },
    });

    return message;
}

// strip error messages and empty assistant messages from the conversation
function buildConversationHistory(
    messages: StoredChatMessage[],
) {
    return messages.flatMap((m) => {
        const role = m.role.toLowerCase();
        const content = getMessageText(m);

        if(role === "error") return [];
        if(role === "assistant" && content.length === 0) return [];

        return [
            {
                role: role ==="user" ? ("user" as const) : ("assistant" as const),
                content
            }
        ]
    })
};

function getResumableUserMessage(
    message: StoredChatMessage[],
) {
    const lastMessage = message[message.length - 1];
    if(!lastMessage || lastMessage.role.toLowerCase() != "user" ) {
        return null
    }

    return lastMessage;
}

function getLatestUserMessageIndex(messages: StoredChatMessage[]) {
    for (let i = messages.length - 1; i >= 0; i--) {
        if(messages[i]?.role.toLowerCase() === "user") {
            return i;
        }
    }

    return -1;
}

type StreamParams = {
    sessionId: string;
    userId: string;
    model: string;
    cwd: string | null
    history: {role: "user" | "assistant" ; content: string} [];
    mode: Mode;
    abortController: AbortController;
}

type IngestUsageForMessageParams = {
    messageId: string;
    status: "complete" | "interrupted";
}

async function streamAIResponse ( 
     stream: Parameters<Parameters<typeof streamSSE>[1]>[0],
     params: StreamParams,
) {
    const {sessionId, userId, model, history, cwd, mode, abortController} = params;
    const startTime = Date.now();
    const tools =cwd? createTools(cwd,mode): undefined;
    const parts: MessagePart[] = [];
    const resolveModel = resolveChatModel(model);
   let completedUsage: LanguageModelUsage | undefined;
    const persistInterruptedMessage = async () => {
        const fullText = parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
         .join("")

         if(fullText.length === 0 && parts.length === 0) {
            return; 
         }

        const elapsedMs = Date.now() - startTime;
        return appendSessionMessage(sessionId, userId, {
            id: randomUUID(),
            role:"assistant",
            status: MessageStatus.INTERRUPTED,
            model,
            content:fullText,
            parts: toClientParts(messagePartsSchema.parse(parts)),
            mode,
            metadata: {
                mode,
                model,
                durationMs: elapsedMs,
                status: MessageStatus.INTERRUPTED,
            },
        })
    }

    const  ingestUsageForMessage = async ({messageId,status}: IngestUsageForMessageParams) => {
        if(!completedUsage) return;

        try {
            const billableUsage = calculateCreditsForUsage ({
                provider: resolveModel.provider,
                model: resolveModel.modelId,
                usage: completedUsage
            });

            await ingestAiUsage({
                externalCustomerId: userId,
                eventId: `chat-message:${messageId}:${status}`,
                credits: billableUsage.credits
            })
        } catch (error) {
               console.error("Failed to ingest Polar AI usage for chat message" ,{
                  error,
                  sessionId,
                  messageId,
                  userId,
               })
        }
    }

    const persistInterruptedMessageAndUsage = async () => {
        const interruptedMessage = await persistInterruptedMessage()
        if (!interruptedMessage) return;

        await ingestUsageForMessage({
            messageId:interruptedMessage.id,
            status: "interrupted",
        })
    }

    try {
        const result = aiStreamText({
            model: resolveModel.model,
            system: buildSystemPrompt({cwd,mode}),
            messages: history,
            tools,
            stopWhen: tools ? stepCountIs(50) : undefined,
            abortSignal: abortController.signal,
            providerOptions: resolveModel.providerOptions,
            onFinish(event) {
                completedUsage = event.totalUsage;
            }
        });

        for await (const part of result.fullStream) {
            if(stream.aborted) break;

            if(part.type === "reasoning-delta") {
                const last = parts[parts.length - 1];
                if(last && last.type === "reasoning") {
                    last.text += part.text;
                } else {
                    parts.push({type: "reasoning", text: part.text});
                }
                const event: ChatStreamEvent = {type: "reasoning-data", text: part.text};
                await stream.writeSSE({
                    event: "reasoning-delta", 
                    data: JSON.stringify(event)
                });
            }

            if(part.type === "text-delta") {
                const last = parts[parts.length - 1];
                if(last && last.type === "text") {
                    last.text += part.text;
                } else {
                    parts.push({type: "text", text: part.text});
                }

                const event: ChatStreamEvent = {type: "text-delta", text: part.text}
                await stream.writeSSE({event : "text-delta", data:JSON.stringify(event)})
            }
              
            if(part.type === "tool-call") {
                const args = toolcallArgsSchema.parse(part.input);

                parts.push({
                    type: "tool-call",
                     id:part.toolCallId,
                     name: part.toolName,
                     args,
                    });

                    const event: ChatStreamEvent = {
                        type: "tool-call",
                        toolCallId: part.toolCallId,
                        toolName: part.toolName,
                        args,
                    };
                    await stream.writeSSE({event: "tool-call", data: JSON.stringify(event)});
            }

            if(part.type === "tool-result") {
                const resultStr =
                 typeof part.output === "string" ? part.output : JSON.stringify(part.output);

                 const tcPart = parts.find(
                    (p) : p is Extract<MessagePart, {type: "tool-call"}> => 
                    p.type === "tool-call" && p.id === part.toolCallId);

                    if(tcPart) {
                        tcPart.result = resultStr;
                    }

                    const event: ChatStreamEvent = {
                        type: "tool-result",
                        toolCallId: part.toolCallId,
                        result: resultStr,
                    };
                    await stream.writeSSE({event: "tool-result", data: JSON.stringify(event)});
            }
            if(part.type === "error") {
                throw part.error;
            }

            if(part.type === "finish") {
                completedUsage = part.totalUsage;
            }
        }

        if(stream.aborted || abortController.signal.aborted) {
            await persistInterruptedMessageAndUsage();
            return;
        }

        const elapsedMs = Date.now() - startTime;
        const fullText = parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("")
        
        const assistantMessage = await appendSessionMessage(sessionId, userId, {
            id: randomUUID(),
            role:"assistant",
            status: MessageStatus.COMPLETE,
            model,
            content:fullText,
            parts: toClientParts(messagePartsSchema.parse(parts)),
            mode,
            metadata: {
                mode,
                model,
                durationMs: elapsedMs,
                status: MessageStatus.COMPLETE,
            },
        })
         
        if(assistantMessage) {
            await ingestUsageForMessage({
                messageId: assistantMessage.id,
                status: "complete"
            })
        }

        const doneEvent: ChatStreamEvent = {
            type: "done",
            messageId: assistantMessage?.id ?? randomUUID(),
            durationMs:elapsedMs
        };

        await stream.writeSSE({event: "done", data: JSON.stringify(doneEvent)})
    } catch (err) {
        if (abortController.signal.aborted) {
            await persistInterruptedMessageAndUsage()
            return
        }

        const message = err instanceof Error ? err.message:String(err);

        await appendSessionMessage(sessionId, userId, {
            id: randomUUID(),
            role:"error",
            status:MessageStatus.COMPLETE,
            model,
            content:message,
            parts: [{type: "text", text: message}],
            mode,
            metadata: {
                mode,
                model,
                status: MessageStatus.COMPLETE,
            },
        })

        const  errorEvent: ChatStreamEvent = {type: "error" , message};
        await stream.writeSSE({event:"error", data: JSON.stringify(errorEvent)}); 
     }
}

const app = new Hono<AuthenticatedEnv>()
 
  .post("/:sessionId/regenerate" , requireCreditsBalance, async (c) => {
    const sessionId = c.req.param("sessionId")
    const userId = c.get("userId")

    const session = await db.session.findFirst({
         where: {id:sessionId, userId},
    });

     if(!session) {
        return c.json({error: "Session not found"},404);
    }

    const sessionMessages = readSessionMessages(session.messages);
    const latestUserIndex = getLatestUserMessageIndex(sessionMessages);
    if(latestUserIndex === -1) {
        return c.json({error: "Session has no user message to regenerate from"},409)
    }

    const userMessage = sessionMessages[latestUserIndex]!;
    const regenerateModel = userMessage.model ?? userMessage.metadata?.model;
    const regenerateMode = userMessage.mode ?? userMessage.metadata?.mode;

    if(!regenerateModel || !regenerateMode) {
        return c.json({error: "Session user message is missing model or mode"},409)
    }

    if(!isSupportedChatModel(regenerateModel)) {
        return c.json({error: `Session user unsupported model: ${regenerateModel}`},409)
    }

    if(activeRegenerateSessionIds.has(sessionId)) {
        return c.json ({
            error: "Session already has an active regeneration"
        },409)
    }

    const trimmedMessages = sessionMessages.slice(0, latestUserIndex + 1);
    await db.session.update({
        where: {id: sessionId},
        data: {
            messages: trimmedMessages as Prisma.InputJsonValue,
        },
    });

    activeRegenerateSessionIds.add(sessionId)

    const history = buildConversationHistory(trimmedMessages);
    const abortController = new AbortController();

    try {
       return streamSSE(
        c,
        async(stream) => {
            stream.onAbort(() => {
                abortController.abort();
            });

            try {
                await streamAIResponse(stream, {
                    sessionId,
                    userId,
                    model : regenerateModel,
                    cwd: getSessionCwd(session),
                    history,
                    mode: regenerateMode,
                    abortController
                });
            } finally {
                activeRegenerateSessionIds.delete(sessionId)
            }
        },
        async (err, stream) => {
            activeRegenerateSessionIds.delete(sessionId)
            const message = err instanceof Error ? err.message: String(err);
            const errorEvent: ChatStreamEvent = {type:"error", message};
            await stream.writeSSE({event: "error", data:JSON.stringify(errorEvent)})
        }
    )
    } catch(error) {
        activeRegenerateSessionIds.delete(sessionId);
        throw error;
    }
  })

  .post("/:sessionId/resume" , requireCreditsBalance, async (c) => {
    const sessionId = c.req.param("sessionId")
    const userId = c.get("userId")

    const session = await db.session.findFirst({
         where: {id:sessionId, userId},
    });

     if(!session) {
        return c.json({error: "Session not found"},404);
    }
    const sessionMessages = readSessionMessages(session.messages);
    const resumableMessage = getResumableUserMessage(sessionMessages)
    if(!resumableMessage) {
        return c.json({error: "Session has no pending user message to resume"},409)
    }

    const resumableModel = resumableMessage.model;
    const resumableMode = resumableMessage.mode;

    if(!resumableModel || !resumableMode) {
        return c.json({error: "Session pending user message is missing model or mode"},409)
    }
   
    if(!isSupportedChatModel(resumableModel)) {
        return c.json({error: `Session user unsupported model: ${resumableModel}`},409)
    }

    if(activeResumeSessionIds.has(sessionId)) {
        return c.json ({
            error: "Session already has an active resume"
        },409)
    }

    activeResumeSessionIds.add(sessionId)

    const history = buildConversationHistory(sessionMessages);
    const abortController = new AbortController();
    
    try { 
       return streamSSE(
        c,
        async(stream) => {
            stream.onAbort(() => {
                abortController.abort();
            });

            try { 
            await streamAIResponse(stream, {
                sessionId,
                userId,
                model : resumableModel,
                cwd: getSessionCwd(session),
                history,
                mode: resumableMode,
                abortController
            });
        } finally {
            activeResumeSessionIds.delete(sessionId)
        }
        },
        async (err, stream) => {
            activeResumeSessionIds.delete(sessionId)
            const message = err instanceof Error ? err.message: String(err);
            const errorEvent: ChatStreamEvent = {type:"error", message};
            await stream.writeSSE({event: "error", data:JSON.stringify(errorEvent)})  
        }
    )
    }catch(error) {
        activeResumeSessionIds.delete(sessionId);
        throw error;
    }
  })  

 .post("/:sessionId", requireCreditsBalance, submitValidator, async (c) => {
    const sessionId =  c.req.param("sessionId");
    const userId = c.get("userId")

    const session = await db.session.findFirst({
        where: {id:sessionId, userId},
    });

    if(!session) {
        return c.json({error: "Session not found"},404);
    }

    const data = c.req.valid("json");

    const sessionMessages = readSessionMessages(session.messages);
    const userMessage: StoredChatMessage = {
        id: randomUUID(),
        role:"user",
        status:MessageStatus.COMPLETE,
        model: data.model,
        content : data.content,
        parts: [{type: "text", text: data.content}],
        mode:data.mode,
        metadata: {
            mode: data.mode,
            model: data.model,
            status: MessageStatus.COMPLETE,
        },
    };

    await db.session.update({
        where: {id: sessionId!},
        data: {
            messages: [...sessionMessages, userMessage] as Prisma.InputJsonValue,
        },
    });

    const history =buildConversationHistory([
        ...sessionMessages,// TODO limit to last 10 ,5 message
        userMessage,
    ])

    const abortController = new AbortController();

    return streamSSE(
        c,
        async(stream) => {
            stream.onAbort(() => {
                abortController.abort();
            });

            await streamAIResponse(stream, {
                sessionId: sessionId!,
                userId,
                model: data.model,
                cwd:getSessionCwd(session),
                history,
                mode: data.mode,
                abortController,
            });
        },
        async (err, stream) => {
            const message = err instanceof Error ? err.message:String(err);
            const errorEvent: ChatStreamEvent = {type: "error", message};
            await stream.writeSSE({event:"error", data:JSON.stringify(errorEvent)})
        }
    );
 });

 export default app;
