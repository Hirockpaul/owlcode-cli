import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import { EmptyBorder } from "../border";

type Props =  {
    message : string;
    onRetry?: () => void;
}

export function ErrorMessage({message, onRetry}: Props ) {
    const { colors } = useTheme();

return (
    <box width="100%" paddingX={2} paddingBottom={2}>
    <box flexDirection="row" gap={1} paddingBottom={1}>
      <text attributes={TextAttributes.BOLD} fg={colors.error}>ERROR</text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>›</text>
    </box>
    <box
    border={["left"]}
    borderColor={colors.error}
    width="100%"
     customBorderChars={{
                    ...EmptyBorder,
                    vertical: "│",
                    bottomLeft: "╹"
                  }}
    >
     <box
     paddingLeft={1}
     width="100%"
     >
        <text attributes={TextAttributes.DIM}>{message}</text>

     </box>
     {onRetry && (
      <box paddingLeft={1} paddingTop={1}>
       <box
        flexDirection="row"
        onMouseDown={() => {
          onRetry();
        }}
       >
        <text selectable={false} fg={colors.error} attributes={TextAttributes.DIM}>
          Retry
        </text>
       </box>
      </box>
     )}

    </box>

    </box>
)








}
