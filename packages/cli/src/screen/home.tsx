import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/header";
import { InputBar } from "../components/input-bar";
import { usePromptConfig } from "../providers/prompt-config";
import { TextAttributes } from "@opentui/core";
import { Spinner } from "../components/spinner";
import { getUserDisplayName } from "../lib/auth";
import { useTheme } from "../providers/theme";

export function Home() {
  const navigate = useNavigate();
  const { mode, model } = usePromptConfig();
  const { colors } = useTheme();
  const [userDisplayName, setUserDisplayName] = useState(getUserDisplayName);

  const handleSubmit = useCallback(
    (text: string) => {
      navigate("/sessions/new", { state: { message: text, mode, model  } });
    },
    [navigate, mode, model],
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
        {userDisplayName && (
          <box alignItems="center" flexDirection="column" marginBottom={1}>
            <text fg={colors.primary}>Welcome back, {userDisplayName}.</text>
            <text fg={colors.primary}>What are we building today?</text>
          </box>
        )}
        <InputBar
          onSubmit={handleSubmit}
          onLogin={() => setUserDisplayName(getUserDisplayName())}
        />
        <box flexDirection="row" gap={1} flexShrink={0} marginLeft="auto">
          <text>tab</text>
          <text attributes={TextAttributes.DIM}>agents</text>
        </box>
      </box>
      
    </box>
  );
};
