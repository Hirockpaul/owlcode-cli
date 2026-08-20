import { useState } from "react";
import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { EmptyBorder } from "../border";
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
    <box width="100%" alignItems="center">
    <box
    border={["left"]}
    borderColor={mode === Mode.PLAN ?colors.planMode : colors.primary}
    width="100%"
     customBorderChars={{
                    ...EmptyBorder,
                    vertical: "│",
                    bottomLeft: "╹"
                  }}
    >
     <box
     justifyContent="center"
     paddingX={2}
     paddingY={1}
     backgroundColor={colors.surface}
     width="100%"
     >
        <text >{message}</text>

     </box>
     <box paddingX={2} paddingBottom={1}>
        <box
        flexDirection="row"
        paddingX={1}
        border={["left", "right"]}
        borderColor={copied ? colors.success : colors.info}
        customBorderChars={EmptyBorder}
        onMouseDown={() => {
            void handleCopy();
        }}
        >
            <text
            selectable={false}
            fg={copied ? colors.success : colors.info}
            attributes={TextAttributes.BOLD}
            >
                {copied ? "✓ Message copied" : "Copy message"}
            </text>
        </box>
     </box>

    </box>

    </box>
)






}
