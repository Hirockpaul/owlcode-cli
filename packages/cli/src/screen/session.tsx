import { SessionShell } from "../components/session-shell";
import { useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import type { InferResponseType } from "hono/client";
import { useKeyboard } from "@opentui/react";

import { UserMessage, BotMessage, ErrorMessage } from "../components/messages";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import prettyMs from "pretty-ms"
import { DEFAULT_CHAT_MODEL_ID, type SupportedChatModelId } from "@owlcode/shared";
import { useChat } from "../hooks/use-chat";
import type { Message, ClientMessagePart } from "../hooks/use-chat";
import { MessageStatus } from "@owlcode/database/enums";
import { useKeyboardLayer } from "../providers/keyboard-layer";

type SessionData = InferResponseType<(typeof apiClient.session)[":id"]["$get"], 200>;

const sessionLocationSchema = z.object ({
    session:z.custom<SessionData>((val) => val != null && typeof val ==="object" && "id" in val)
})
 
function mapDbMessages(dbMessages: SessionData["messages"]):Message[] {
    return dbMessages.map((m): Message => {
        if(m.role === "ERROR" ) {
            return {id: m.id, role: "error", content:m.content};
        }

        if(m.role === "USER") {
            return {
                id:m.id,
                role: "user",
                content: m.content,
                mode: m.mode,
                model: m.model as SupportedChatModelId,
            }
        }
        return {
            id:m.id,
            role:"assistant",
            content: m.content,
            mode:m.mode,
            model:m.model as SupportedChatModelId,
            parts: [{type: "text", text: m.content}],
            ...(m.duration != null ? {duration: prettyMs(m.duration * 1000)}: {}),
            interrupted: m.status === MessageStatus.INTERRUPTED,
        }
    })
}

function ChatMessage(
    { msg }: {
         msg: Message
        }
    ) {
    if (msg.role === "user") {
        return <UserMessage message={msg.content} />
    }

    if (msg.role === "error") {
        return <ErrorMessage message={msg.content} />
    }

    return (<BotMessage 
    parts={msg.parts}
    model={msg.model}
    mode={msg.mode}
    duration={msg.duration}
    streaming={false} 
    interrupted={msg.interrupted}
    />
);
}

function SessionChat({session}: {session: SessionData}) {
    const [initialMessage] = useState(() => mapDbMessages(session.messages));
    const { isTopLayer } = useKeyboardLayer();
    const {messages, streaming, submit, abort, interrupt} = useChat(session.id, initialMessage);

    //stop the pendiing reply when the user leaves thie session 
    useEffect(() => {
        return() => abort();
    },[abort])

    // let the user cancel a reply even before the first streamed chunk arrives.
    useKeyboard((key)=> {
        if(key.name === "escape" && isTopLayer ("base") && streaming.status ===
    "streaming") {
        key.preventDefault();
        interrupt();
    }
    })

    return (
        <SessionShell
        onSubmit={(text) => 
            submit({userText: text, mode: "BUILD", model: DEFAULT_CHAT_MODEL_ID})
        }
        onInterrupt={interrupt}
        loading={streaming.status === "streaming"}
        interruptible={streaming.status === "streaming"}
        >
            {messages.map((msg) => (
                <ChatMessage key = {msg.id} msg= {msg} />
            ))}
            {streaming.status === "streaming" && streaming.parts.length > 0 && (
                <BotMessage
                parts={ streaming.parts}
                model={streaming.model}
                mode={streaming.mode}
                streaming
                />
            )}
        </SessionShell>
    )
}

export function Session() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const toast = useToast();
    const prefetched = useMemo(() => {
        const parsed = sessionLocationSchema.safeParse(location.state);
        return parsed.success ? parsed.data.session : null;
    }, [location.state]);
    const [session, setSession] = useState<SessionData | null>(prefetched);
    const [loading, setLoading] = useState(!prefetched);
    const [error, setError] = useState<string | null>(null);
// skip fetch if session was passed via loaction state
    useEffect(() => {
        if (prefetched) return
          
         setSession(null)

        if (!id ) return;

        let ignore = false;
        const fetchSession = async () => {
            try {
                const response = await apiClient.session[":id"].$get({
                    param: { id },
                });
                if(ignore) return
                if (!response.ok)  throw new Error(await getErrorMessage(response));
                    const resolved = await response.json();
                    setSession(resolved);
                
            } catch (err) {
                toast.show({
                    variant:"error",
                    message: err instanceof Error ? err.message :"Faild to load session",
                });
                navigate("/", {replace: true})
            }
        };

        fetchSession();
        return () => {
            ignore = true;
        };
    }, [id, navigate, prefetched, toast]);
 
    if (!session) { 
      return <SessionShell onSubmit={() => {}} inputDisabled loading={loading} />;
    }
  
    return <SessionChat key ={session.id} session={session} />
         
}