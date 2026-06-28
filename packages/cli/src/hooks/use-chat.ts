import { useState, useRef,useCallback,useEffect } from "react";
import {EventSourceParserStream} from "eventsource-parser/stream"
import prettyMs from "pretty-ms";
import type { ClientResponse } from "hono/client";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import type { Mode } from "@owlcode/database/enums";
import{
    chatStreamEventSchema,
    type SupportedChatModelId
} from "@owlcode/shared"
import { requestId } from "hono/request-id";
import { request } from "node:http";

export type ClientToolCallPart = {
    type: "tool-call";
    id: string;
    name: string;
    args: Record<string, unknown>;
    result?: string;
    status: "calling" | "done";
}

export type ClientReasoningPart = {
    type: "reasoning";
    text: string;
}

export type ClientMessagePart =
    | { type: "text"; text: string }
    | ClientToolCallPart
    | ClientReasoningPart;

export type Message = 
 | {id: string;
    role:"user";
     content: string;
     mode:Mode;
     model:SupportedChatModelId}
 | {
    id: string;
    role:"assistant";
    content:string;
    mode: Mode;
    model: SupportedChatModelId;
    parts: ClientMessagePart[];
    duration?:string;
    interrupted?: boolean;
 }
| {id:string; role: "error"; content: string};

type StreamingState = 
| {status: "idle"}
| {
    status: "streaming";
    parts:  ClientMessagePart[];
    mode: Mode;
    model: SupportedChatModelId
}

type ActiveStream = {
    requestId: string;
    controller: AbortController;
    mode:Mode;
    model:SupportedChatModelId;
    parts: ClientMessagePart[];
};

type SubmitParams = {
    userText : string;
    mode : Mode;
    model: SupportedChatModelId
};

type RunStreamParams = {
    mode: Mode;
    model: SupportedChatModelId;
    request: (controller: AbortController) => Promise<ClientResponse<unknown>>;
};

export function useChat (
    sessionId:string,
    initialMessage: Message[],
) {
    const [messages, setMessages] = useState<Message[]>(initialMessage);
    const[streaming, setStreaming] = useState<StreamingState>({
        status:"idle"
    });
    const activeStreamRef = useRef<ActiveStream | null>(null);

    const updateMessages = useCallback((updater: (prev:Message[]) => Message[]) =>{
        setMessages((prev) =>updater(prev));
    },[]);

    const isActiveRequest =useCallback((requestId:string)=> { 
     return activeStreamRef.current?.requestId === requestId;
    },[]);

    const emitParts = useCallback((
        requestId:string,
        parts:ClientMessagePart[]
    )=>{
        if(!isActiveRequest(requestId)) return;

        const snapshot = [...parts];
        const activeStream = activeStreamRef.current;
        if(!activeStream) return;

        activeStream.parts = snapshot;
        setStreaming({
            status:"streaming",
            parts: snapshot,
            mode :activeStream.mode,
            model:activeStream.model
        })
    },[isActiveRequest]);

    const clearStream = useCallback(
        (requestId: string) => {
          if(!isActiveRequest(requestId)) return;

          activeStreamRef.current = null;
          setStreaming({status:"idle"});
        },[isActiveRequest]);

        const handleStream = useCallback(async(
            response: ClientResponse<unknown>,
            activeStream: ActiveStream
        )=> {
            if(!isActiveRequest(activeStream.requestId)) return;

            if(!response.ok) {
                const message = await getErrorMessage(response);
                updateMessages((prev) => [
                    ...prev,
                    {
                        id:crypto.randomUUID(),
                        role:"error",
                        content:message,
                    }
                ]);
                return
            };

            const parts: ClientMessagePart[] = [];

            const stream = response
            .body!.pipeThrough(new TextDecoderStream())
            .pipeThrough(new EventSourceParserStream());

            for await (const {data} of stream) {
                if(!isActiveRequest(activeStream.requestId)) return;

                let event;

                try {
                    event = chatStreamEventSchema.parse(JSON.parse(data));
                } catch (err) {
                    const message = err instanceof Error ? err.message : "Invalid Stream event";
                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role:"error",
                            content:message,
                        }
                    ]);
                    break;
                }

                if (event.type === "reasoning-data") {
                    const last = parts[parts.length-1];
                    if (last && last.type === "reasoning") {
                        last.text += event.text;
                    } else {
                        parts.push({ type: "reasoning", text: event.text });
                    }
                    emitParts(activeStream.requestId, parts);
                } else if (event.type === "tool-call") {
                    parts.push({
                        type: "tool-call",
                        id: event.toolCallId,
                        name: event.toolName,
                        args: event.args,
                        status: "calling",
                    });
                    emitParts(activeStream.requestId, parts);
                } else if (event.type === "tool-result") {
                    const tc = parts.find(
                        (p): p is ClientToolCallPart => p.type === "tool-call" && p.id === event.toolCallId
                    );
                    if (tc) {
                        tc.status = "done";
                        tc.result = event.result;
                    }
                    emitParts(activeStream.requestId, parts);
                } else if (event.type === "text-delta") {
                    const last = parts[parts.length - 1];
                    if (last && last.type === "text") {
                        last.text += event.text;
                    } else {
                        parts.push({ type: "text", text: event.text });
                    }
                    emitParts(activeStream.requestId, parts);
                } else if (event.type === "done") {
                    if (!isActiveRequest(activeStream.requestId)) return;

                    const fullText = parts
                        .filter((p) => p.type == "text")
                        .map((p) => p.text)
                        .join("");

                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: event.messageId,
                            role: "assistant",
                            content: fullText,
                            mode: activeStream.mode,
                            model: activeStream.model,
                            duration: prettyMs(event.durationMs),
                            parts: [...parts],
                        },
                    ]);
                } else if (event.type === "error") {
                    updateMessages((prev) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role: "error",
                            content: event.message,
                        },
                    ]);
                }
            }
        },[updateMessages,emitParts,isActiveRequest])

        const runStream = useCallback(async(
             { mode, model ,request } : RunStreamParams 
        ) => {
              const controller = new AbortController();
              const activeStream: ActiveStream = {
                requestId: crypto.randomUUID(),
                controller,
                mode,
                model,
                parts: [],
              };

              activeStreamRef.current = activeStream;
              setStreaming({status: "streaming", parts: [], mode, model})

              try {
                 const response = await request  (controller);
                 await handleStream(response, activeStream);
              } catch(err){
                if(err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                if (!isActiveRequest(activeStream.requestId)) return;

                 const msg = err instanceof Error ? err.message : String(err);
                 updateMessages((prev) => [
                    ...prev,
                    {
                        id:crypto.randomUUID(),
                        role: "error",
                        content:msg,
                    },
                 ]);
              } finally {
                clearStream(activeStream.requestId);
              }
        },[clearStream, handleStream, isActiveRequest, updateMessages]);

        const resume = useCallback ( async(
            {mode, model} : Omit<SubmitParams, "userText">
        ) => {
            await runStream ({
                mode,
                model,
                request: async (controller) => {
                   return apiClient.chat[":sessionId"].resume.$post(
                        {param: {sessionId}},
                        {init: {signal:controller.signal}}
                    )
                }
            });

        }, [runStream,sessionId]);

        //auto - resume when the conversation end with a user message that has no reply
        const hasAutoResumeRef = useRef(false);
        useEffect(()=> {
            if(hasAutoResumeRef.current) return;
            const last = initialMessage[initialMessage.length -1];
            if(!last || last.role !== "user") return;

            hasAutoResumeRef.current = true;
            void resume({ mode: last.mode, model: last.model });
        },[initialMessage,resume]);

        const submit = useCallback(async( 
            {userText, mode, model} : SubmitParams
         ) => {
           const userMessage: Message ={
            id: crypto.randomUUID(),
            role: "user",
            content: userText,
            mode,
            model,
           }
           updateMessages((prev)=> [...prev, userMessage] )

           await runStream ({
            mode,
            model,
            request: async (controller) => {
                return apiClient.chat[":sessionId"].$post (
                    {
                        param: {sessionId},
                        json : {content: userText, mode,model}
                    },
                    {init: {signal: controller.signal}}
                )
            }
           })
        },[runStream, sessionId, updateMessages])

        const abort = useCallback(() => {
            const activeStream = activeStreamRef.current;
            if(!activeStream) return;

            activeStreamRef.current = null;
            setStreaming({status: "idle"});
            activeStream.controller.abort();
        },[])

        const interrupt = useCallback(() => {
            abort();
        }, [abort]);

        return {messages, streaming, submit, abort, interrupt}
    
}
