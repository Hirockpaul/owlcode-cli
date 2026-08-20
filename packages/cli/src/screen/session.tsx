import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { useKeyboard } from "@opentui/react";
import { type ModeType, type SupportedChatModelId } from "@owlcode/shared";
import type { InferResponseType } from "hono/client";
import { SessionShell } from "../components/session-shell";
import { 
  UserMessage, 
  BotMessage, 
  ErrorMessage
} from "../components/messages";
import { useToast } from "../providers/toast";
import { useChat } from "../hooks/use-chat";
import { usePromptConfig } from "../providers/prompt-config";
import type { Message } from "../hooks/use-chat";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import { useKeyboardLayer } from "../providers/keyboard-layer";

type SessionData = InferResponseType<(typeof apiClient.sessions)[":id"]["$get"], 200>;
type MessagePart = Message["parts"][number];

function isTextPart(part: MessagePart): part is MessagePart & { type: "text"; text: string } {
  return part.type === "text" && "text" in part;
}

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>((val) => val != null && typeof val === "object" && "id" in val),
  initialPrompt: z
    .object({
      message: z.string(),
      mode: z.custom<ModeType>(),
      model: z.custom<SupportedChatModelId>(),
    })
    .optional(),
});

function ChatMessage(
  { msg, canRegenerate, streaming, onRegenerate }: {
    msg: Message;
    canRegenerate?: boolean;
    streaming?: boolean;
    onRegenerate?: () => void;
  }
) {
  if (msg.role === "user") {
    const text = msg.parts
      .filter((p) => p.type === "text")
      .filter(isTextPart)
      .map((p) => p.text)
      .join("");

    return <UserMessage message={text} mode={msg.metadata?.mode ?? "BUILD"} />;
  }

  if (msg.role === "error") {
    const text = msg.parts
      .filter(isTextPart)
      .map((p) => p.text)
      .join("");

    return <ErrorMessage message={text} onRetry={onRegenerate} />;
  }

  return (
    <BotMessage
      parts={msg.parts}
      model={msg.metadata?.model ?? "unknown"}
      mode={msg.metadata?.mode ?? "BUILD"}
      durationMs={msg.metadata?.durationMs}
      streaming={streaming}
      canRegenerate={canRegenerate}
      onRegenerate={onRegenerate}
    />
  );
};

function SessionChat({ 
  session,
  initialPrompt,
}: { 
  session: SessionData,
  initialPrompt?: { message: string; mode: ModeType; model: SupportedChatModelId };
}) {
  const [initialMessages] = useState(() => session.messages as unknown as Message[]);
  const { mode, model } = usePromptConfig();
  const { isTopLayer } = useKeyboardLayer();
  const { messages, status, submit, abort, interrupt, error, regenerateLast } = useChat(
    session.id,
    initialMessages
  );
  const hasSubmittedInitialPromptRef = useRef(false);

  // Stop the pending reply when the user leaves this session.
  useEffect(() => {
    return () => {
      void abort();
    };
  }, [abort]);

  // Let the user cancel a reply even before the first streamed chunk arrives.
  useKeyboard((key) => {
    if (
      key.name === "escape" 
      && isTopLayer("base") 
      && (status === "submitted" || status === "streaming")
    ) {
      key.preventDefault();
      interrupt();
    }
  });

  useEffect(() => {
    if (!initialPrompt || hasSubmittedInitialPromptRef.current) return;
    hasSubmittedInitialPromptRef.current = true;
    void submit({
      userText: initialPrompt.message,
      mode: initialPrompt.mode,
      model: initialPrompt.model,
    });
  }, [initialPrompt, submit]);

  return (
    <SessionShell
      onSubmit={(text) => submit({ userText: text, mode, model })}
      loading={status === "submitted" || status === "streaming"}
      interruptible={status === "submitted" || status === "streaming"}
    >
      {messages.map((msg, index) => {
        const isLastMessage = index === messages.length - 1;
        const isBusy = status === "submitted" || status === "streaming";

        return (
          <ChatMessage 
            key={msg.id} 
            msg={msg} 
            streaming={isLastMessage && isBusy}
            canRegenerate={isLastMessage && msg.role === "assistant" && !isBusy}
            onRegenerate={regenerateLast}
          />
        );
      })}
      {error && <ErrorMessage message={error.message} onRetry={regenerateLast} />}
    </SessionShell>
  );
}

export function Session() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const prefetched = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    return parsed.success ? parsed.data : null;
  }, [location.state]);

  const [session, setSession] = useState<SessionData | null>(prefetched?.session ?? null);

  useEffect(() => {
    // Skip fetch if session was passed via location state
    if (prefetched?.session) return;

    setSession(null);

    if (!id) return;

    let ignore = false;
    const fetchSession = async () => {
      try {
        const res = await apiClient.sessions[":id"].$get({ 
          param: { id },
        });
        if (ignore) return;
        if (!res.ok) throw new Error(await getErrorMessage(res));
        const resolved = await res.json();
        setSession(resolved);
      } catch (err) {
        if (ignore) return;
        toast.show({
          variant: "error",
          message: err instanceof Error ? err.message : "Failed to load session",
        });
        navigate("/", { replace: true });
      }
    };

    fetchSession();
    return () => {
      ignore = true;
    };
  }, [id, prefetched, toast, navigate]);

  if (!session) {
    return <SessionShell onSubmit={() => {}} inputDisabled loading />;
  }

  return (
    <SessionChat 
      key={session.id} 
      session={session} 
      initialPrompt={prefetched?.initialPrompt}
    />
  );
};
