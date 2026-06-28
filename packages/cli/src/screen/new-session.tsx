import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { useNavigate, useLocation } from "react-router";
import { resolve } from "node:path";
import { UserMessage } from "../components/messages";
import { SessionShell } from "../components/session-shell";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import { usePromptConfig } from "../providers/prompt-config";
import { Mode } from "@owlcode/database/enums";

const newSessionStateSchema = z.object({
  message : z.string(),
  mode:z.enum(Mode),
  model : z.string()
})

export function NewSession () {
  const navigate = useNavigate();
  const location = useLocation();
  const { show: showToast } = useToast();
  const { mode, model } = usePromptConfig();
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
           const cwd = process.cwd().endsWith("/packages/cli")
             ? resolve(process.cwd(), "..", "..")
             : process.cwd();

           const res  = await apiClient.sessions.$post({
            json: {
              title: state.message.slice(0, 100),
              cwd,
              initialMessage: {
                role: "USER",
                content: state.message,
                mode: state.mode,
                model:state.model
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
  },[mode, model, navigate, showToast, state]);
  if (!state) return null

  return (
    <SessionShell onSubmit={() => {}} inputDisabled loading>
      <UserMessage message={state.message} mode= {state.mode}/>
    </SessionShell>
  )

}
