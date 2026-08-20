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
    <box width="100%" alignItems="center">
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
     justifyContent="center"
     paddingX={2}
     paddingY={1}
     backgroundColor={colors.surface}
     width="100%"
     >
        <text attributes={TextAttributes.DIM}>{message}</text>

     </box>
     {onRetry && (
      <box paddingX={2} paddingBottom={1}>
       <box
        flexDirection="row"
        paddingX={1}
        border={["left", "right"]}
        borderColor={colors.error}
        customBorderChars={EmptyBorder}
        onMouseDown={() => {
          onRetry();
        }}
       >
        <text selectable={false} fg={colors.error} attributes={TextAttributes.BOLD}>
          Retry response
        </text>
       </box>
      </box>
     )}

    </box>

    </box>
)








}
