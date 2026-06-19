import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { useTheme } from "../providers/theme"
import { ErrorMessage, UserMessage, BotMessage } from "../components/messages";
import { SessionShell } from "../components/session-shell";

export function NewSession () {
  const navigate = useNavigate();
  const location = useLocation();
  const {colors} = useTheme()

  const state = location.state as {message? : string} |  null;

  useEffect(() => {
    if(!state?.message) {
      navigate("/", {replace : true});
    }
  },[state, navigate])
  
  if (!state?.message) return null

  return (
    <SessionShell onSubmit={() => {}} inputDisabled loading>
      <UserMessage message={state.message} />
      <BotMessage
      content="this is a simple bot response to demonstrate themessage layout."
      model="opus-4-6"
      />
      <ErrorMessage message="This is a simple error message" />
    </SessionShell>
  )

}