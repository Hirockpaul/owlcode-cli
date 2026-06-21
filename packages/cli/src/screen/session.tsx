import { SessionShell } from "../components/session-shell";
import { useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import type { InferResponseType } from "hono/client";

import { UserMessage, BotMessage, ErrorMessage } from "../components/messages";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";


type SessionData = InferResponseType<(typeof apiClient.session)[":id"]["$get"], 200>;

const sessionLocationSchema = z.object ({
    session:z.custom<SessionData>((val) => val != null && typeof val ==="object" && "id" in val)
})
function ChatMessage({ msg }: { msg: SessionData["messages"][number] }) {
    if (msg.role.toUpperCase() === "USER") {
        return <UserMessage message={msg.content} />
    }

    if (msg.status.toUpperCase() === "ERROR") {
        return <ErrorMessage message={msg.content} />
    }

    return <BotMessage content={msg.content} model={msg.model} />
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

    return (
      <SessionShell onSubmit={() => {}} inputDisabled>
        {session.messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}
      </SessionShell>
    );
         
}