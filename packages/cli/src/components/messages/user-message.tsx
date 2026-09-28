import { useState } from "react";
import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { Mode ,type ModeType } from "@owlcode/shared";
import { copyToClipboard } from "../../lib/clipboard";
import { useToast } from "../../providers/toast";

type Props =  {
    message : string
    mode: ModeType
}

export function UserMessage({message, mode}: Props ) {
    const { colors } = useTheme();
    const { show } = useToast();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!message.trim()) return;

        try {
            await copyToClipboard(message);
            setCopied(true);
            show({ variant: "success", message: "✓ Message copied" });
            setTimeout(() => setCopied(false), 1400).unref?.();
        } catch (error) {
            show({
                variant: "error",
                message: error instanceof Error ? error.message : "Failed to copy message",
            });
        }
    };

return (
    <box width="100%" paddingX={2} paddingTop={1} paddingBottom={2}>
     <box flexDirection="row" gap={1} paddingBottom={1}>
        <text attributes={TextAttributes.BOLD} fg={mode === Mode.PLAN ? colors.planMode : colors.primary}>YOU</text>
        <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>›</text>
     </box>
     <box width="100%" paddingLeft={2}>
        <text>{message}</text>
     </box>
     <box paddingLeft={2} paddingTop={1}>
        <box
        flexDirection="row"
        onMouseDown={() => {
            void handleCopy();
        }}
        >
            <text
            selectable={false}
            fg={copied ? colors.success : colors.info}
            attributes={TextAttributes.DIM}
            >
                {copied ? "✓ Copied" : "Copy message"}
            </text>
        </box>
     </box>
    </box>
)






}
