import { useEffect, useMemo, useRef } from "react";
import {json, z} from "zod";
import { DEFAULT_CHAT_MODEL_ID } from "@owlcode/shared";
import { useNavigate, useLocation } from "react-router";
import { UserMessage,  ErrorMessage } from "../components/messages";
import { SessionShell } from "../components/session-shell";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import { title } from "node:process";

const newSessionStateSchema = z.object({
  message : z.string(),
})

export function NewSession () {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const hasStarteRef = useRef(false)
  
 const state = useMemo(() => {
         const parsed = newSessionStateSchema.safeParse(location.state)
         return parsed.success ? parsed.data:null;
 },[location.state])


  
  useEffect(() => {
    if(!state?.message) {
      navigate("/", {replace : true});
    }
  },[state, navigate])
  
  // Create the session on mount  -this screen exist to do this
  useEffect(() => {
    if(!state || hasStarteRef.current) return;

    hasStarteRef.current = true;

    let ignore = false;
    const createSession = async () => {
      try {
           const res  = await apiClient.session.$post({
            json: {
              title: state.message.slice(0, 100),
              cwd: process.cwd(),
              initialMessage: {
                role: "USER",
                content: state.message,
                mode: "BUILD",
                model: DEFAULT_CHAT_MODEL_ID,
              },
            },
          });
        if(ignore) return;
        if(!res.ok) {
          throw new Error (await getErrorMessage(res));
        }
        interface Message {
          id: string;
          role: string;
          title: string;
          content: string;
          mode: string;
          model: string;
          status: string;
          parts: null;
          duration: null;
          createdAt: string;
          sessionId: string;
        }

        interface Session {
          id: string;
          title: string;
          cwd: string | null;
          userId: string;
          createdAt: string;
          messages: Message[];
        }

        const Session = (await res.json()) as Session;

        navigate(`/sessions/${Session.id}`, {
          replace: true,
          state: { Session },
        });
      
      } catch (error) {
        if(ignore) return;
        toast.show({
          variant:"error",
          message:error instanceof Error ? error.message:"Faild to createtrue session",
        });
        navigate("/", {replace : true})
        }
    }
    createSession();
    return () => {
      ignore = true;
    };
  },[]);
  if (!state) return null

  return (
    <SessionShell onSubmit={() => {}} inputDisabled loading>
      <UserMessage message={state.message} />
    </SessionShell>
  )

}