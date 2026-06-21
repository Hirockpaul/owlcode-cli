import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL_ID } from "@owlcode/shared";
import { useNavigate, useLocation } from "react-router";
import { UserMessage } from "../components/messages";
import { SessionShell } from "../components/session-shell";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";

const newSessionStateSchema = z.object({
  message : z.string(),
})

export function NewSession () {
  const navigate = useNavigate();
  const location = useLocation();
  const { show: showToast } = useToast();
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
        const session = await res.json();

        navigate(`/sessions/${session.id}`, {
          replace: true,
          state: { session },
        });
      
      } catch (error) {
        if(ignore) return;
        showToast({
          variant:"error",
          message:error instanceof Error ? error.message:"Failed to create session",
        });
        navigate("/", {replace : true})
        }
    }
    createSession();
    return () => {
      ignore = true;
    };
  },[navigate, showToast, state]);
  if (!state) return null

  return (
    <SessionShell onSubmit={() => {}} inputDisabled loading>
      <UserMessage message={state.message} />
    </SessionShell>
  )

}
