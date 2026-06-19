import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/header";
import { InputBar } from "../components/input-bar";
//import { usePromptConfig } from "../providers/prompt-config";
import { TextAttributes } from "@opentui/core";
import { Spinner } from "../components/spinner";

export function Home() {
  const navigate = useNavigate();
  //const { mode, model } = usePromptConfig();

  const handleSubmit = useCallback(
    (text: string) => {
      navigate("/sessions/new", { state: { message: text,  } });
    },
    [navigate, ],
  );

  return (
    <box
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
      gap={2}
      position="relative"
      width="100%"
      height="100%"
    >
      <Header />
      <box width="100%" maxWidth={78} paddingX={2} flexDirection="column" gap={1}>
        <InputBar onSubmit={handleSubmit} />
      </box>
      
    </box>
  );
};