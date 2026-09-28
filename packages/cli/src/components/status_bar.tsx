import { TextAttributes } from "@opentui/core";
import { useTheme } from "../providers/theme";
import { usePromptConfig } from "../providers/prompt-config";
import { Mode } from "@owlcode/shared";
import { SUPPORTED_CHAT_MODELS } from "@owlcode/shared";
import { useDialog } from "../providers/dialog";
import { AgentsDialogContent, ModelsDialogContent } from "./dialogs";

export function StatusBar() {
  const { mode, model, setMode, setModel } = usePromptConfig();
  const { colors } = useTheme();
  const dialog = useDialog();

  const openAgents = () => dialog.open({
    title: "Agents",
    children: <AgentsDialogContent currentMode={mode} onSelectMode={setMode} />,
  });
  const openModels = () => dialog.open({
    title: "Models",
    children: (
      <ModelsDialogContent
        models={SUPPORTED_CHAT_MODELS.map((supportedModel) => supportedModel.id)}
        onSelectModel={setModel}
      />
    ),
  });

  return (
    <box flexDirection="row" justifyContent="space-between" width="100%">
      <box flexDirection="row" gap={1}>
        <text
          selectable={false}
          fg={mode === Mode.PLAN ? colors.planMode : colors.primary}
          onMouseDown={openAgents}
        >
          {mode === Mode.PLAN ? "Plan" : "Build"}
        </text>
        <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>›</text>
        <text selectable={false} attributes={TextAttributes.DIM} onMouseDown={openModels}>
          {model}
        </text>
      </box>
      <box flexDirection="row" gap={1} onMouseDown={openAgents}>
        <text selectable={false}>Tab</text>
        <text selectable={false} attributes={TextAttributes.DIM}>· Agents</text>
      </box>
    </box>
  );
};
