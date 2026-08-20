import { useCallback, useRef, useState } from "react";
import {
  type ChatStreamEvent,
  type ModeType,
  type SupportedChatModelId,
} from "@owlcode/shared";
import { apiClient } from "../lib/api-client";
import { getAuth } from "../lib/auth";

export type ChatMessageMetadata = {
  mode?: ModeType;
  model?: SupportedChatModelId | string;
  durationMs?: number;
};

type TextPart = {
  type: "text" | "reasoning";
  text: string;
};

type ToolPart = {
  type: `tool-${string}`;
  toolCallId: string;
  input?: unknown;
  state?: "input-available" | "output-available" | "output-error";
  output?: unknown;
  errorText?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "error";
  parts: (TextPart | ToolPart)[];
  metadata?: ChatMessageMetadata;
};

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

function createId() {
  return crypto.randomUUID();
}

function appendTextPart(parts: Message["parts"], type: "text" | "reasoning", text: string) {
  const last = parts[parts.length - 1];

  if (last?.type === type && "text" in last) {
    return [...parts.slice(0, -1), { ...last, text: last.text + text }];
  }

  return [...parts, { type, text }];
}

function parseSseEvents(chunk: string) {
  return chunk
    .split("\n\n")
    .map((eventBlock) => {
      const data = eventBlock
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trimStart())
        .join("\n");

      return data ? (JSON.parse(data) as ChatStreamEvent) : null;
    })
    .filter((event): event is ChatStreamEvent => event != null);
}

export function useChat(sessionId: string, initialMessages: Message[]) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateAssistantMessage = useCallback(
    (assistantId: string, updater: (message: Message) => Message) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? updater(message) : message,
        ),
      );
    },
    [],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("ready");
  }, []);

  const consumeAssistantStream = useCallback(
    async (params: {
      response: Response;
      assistantId: string;
      abortController: AbortController;
    }) => {
      const { response, assistantId, abortController } = params;

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setStatus("streaming");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const eventEnd = buffer.lastIndexOf("\n\n");
        if (eventEnd === -1) continue;

        const eventText = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);

        for (const event of parseSseEvents(eventText)) {
          if (event.type === "reasoning-data") {
            updateAssistantMessage(assistantId, (message) => ({
              ...message,
              parts: appendTextPart(message.parts, "reasoning", event.text),
            }));
          }

          if (event.type === "text-delta") {
            updateAssistantMessage(assistantId, (message) => ({
              ...message,
              parts: appendTextPart(message.parts, "text", event.text),
            }));
          }

          if (event.type === "tool-call") {
            updateAssistantMessage(assistantId, (message) => ({
              ...message,
              parts: [
                ...message.parts,
                {
                  type: `tool-${event.toolName}`,
                  toolCallId: event.toolCallId,
                  input: event.args,
                  state: "input-available",
                },
              ],
            }));
          }

          if (event.type === "tool-result") {
            updateAssistantMessage(assistantId, (message) => ({
              ...message,
              parts: message.parts.map((part) =>
                part.type.startsWith("tool-") &&
                "toolCallId" in part &&
                part.toolCallId === event.toolCallId
                  ? { ...part, state: "output-available", output: event.result }
                  : part,
              ),
            }));
          }

          if (event.type === "done") {
            updateAssistantMessage(assistantId, (message) => ({
              ...message,
              id: event.messageId,
              metadata: {
                ...message.metadata,
                durationMs: event.durationMs,
              },
            }));
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      if (!abortController.signal.aborted) {
        setStatus("ready");
      }
    },
    [updateAssistantMessage],
  );

  const submit = useCallback(
    async (params: { userText: string; mode: ModeType; model: SupportedChatModelId }) => {
      const userMessage: Message = {
        id: createId(),
        role: "user",
        parts: [{ type: "text", text: params.userText }],
        metadata: {
          mode: params.mode,
          model: params.model,
        },
      };

      const assistantId = createId();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        parts: [],
        metadata: {
          mode: params.mode,
          model: params.model,
        },
      };

      const abortController = new AbortController();
      abortRef.current = abortController;
      setError(null);
      setStatus("submitted");
      setMessages((current) => [...current, userMessage, assistantMessage]);

      try {
        const auth = getAuth();
        const response = await fetch(
          apiClient.chat[":sessionId"].$url({ param: { sessionId } }).toString(),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
            },
            body: JSON.stringify({
              content: params.userText,
              mode: params.mode,
              model: params.model,
            }),
            signal: abortController.signal,
          },
        );

        await consumeAssistantStream({ response, assistantId, abortController });
      } catch (err) {
        if (abortController.signal.aborted) return;

        const nextError = err instanceof Error ? err : new Error(String(err));
        setError(nextError);
        setStatus("error");
      } finally {
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
      }
    },
    [consumeAssistantStream, sessionId],
  );

  const regenerateLast = useCallback(async () => {
    if (status === "submitted" || status === "streaming") return;

    const latestUserIndex = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === "user") return i;
      }

      return -1;
    })();

    if (latestUserIndex === -1) {
      setError(new Error("No user message to regenerate from"));
      setStatus("error");
      return;
    }

    const userMessage = messages[latestUserIndex]!;
    const assistantId = createId();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      parts: [],
      metadata: {
        mode: userMessage.metadata?.mode,
        model: userMessage.metadata?.model,
      },
    };

    const abortController = new AbortController();
    abortRef.current = abortController;
    setError(null);
    setStatus("submitted");
    setMessages((current) => [
      ...current.slice(0, latestUserIndex + 1),
      assistantMessage,
    ]);

    try {
      const auth = getAuth();
      const response = await fetch(
        apiClient.chat[":sessionId"].regenerate.$url({ param: { sessionId } }).toString(),
        {
          method: "POST",
          headers: {
            ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
          },
          signal: abortController.signal,
        },
      );

      await consumeAssistantStream({ response, assistantId, abortController });
    } catch (err) {
      if (abortController.signal.aborted) return;

      const nextError = err instanceof Error ? err : new Error(String(err));
      setError(nextError);
      setStatus("error");
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
      }
    }
  }, [consumeAssistantStream, messages, sessionId, status]);

  return {
    messages,
    status,
    error,
    submit,
    abort,
    interrupt: abort,
    regenerateLast,
  };
}
