import { useTheme } from "../../providers/theme";
import { EmptyBorder } from "../border";
import type { ClientMessagePart, ClientToolCallPart } from "../../hooks/use-chat";
import  { Mode } from "@owlcode/database";
import { TextAttributes } from "@opentui/core";
import prettyMs from "pretty-ms";

type Props =  {
    parts: ClientMessagePart[];
    model : string;
    mode : Mode;
    duration?: string;
    streaming?: boolean;
    interrupted?: boolean;
};

function formateToolName(name:string) : string {
  return name
  .replace(/([A-Za-z0-9])([A-Z])/g, " $1$2")
  .replace(/^/,(c) => c.toUpperCase())
}

function formatToolArgs(tc:ClientToolCallPart) : string {
  return Object.values(tc.args).map(String).join(" ");
};

function formatToolCallStatus(tc: ClientToolCallPart): string {
  const args = formatToolArgs(tc);
  const suffix = tc.status === "calling" ? "..." : "";
  return [formateToolName(tc.name), args].filter(Boolean).join(" ") + suffix;
}

type PartGroup = {
  type: ClientMessagePart["type"];
  parts: ClientMessagePart[];
  key: string;
};

function groupConsecutiveParts(parts: ClientMessagePart[]): PartGroup[] {
  const groups: PartGroup[] = [];

  parts.forEach((part, i) => {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.type === part.type) {
      lastGroup.parts.push(part);
    } else {
      const key =
        part.type === "tool-call"
          ? `group-tc-${part.id}`
          : `group-${part.type}-s${i}`;
      groups.push({ type: part.type, parts: [part], key });
    }
  });

  return groups;
}

export function BotMessage({
  parts,
  model,
  mode,
  duration,
  streaming = false,
}: Props) {
  const { colors } = useTheme();

 return (
  <box width="100%" alignItems="center">
    <box width="100%" alignItems="center">
      {groupConsecutiveParts(parts).map((group) => (
        <box key={group.key} width="100%" paddingY={1}>
          {group.parts.map((part, j) => {
            if (part.type === "reasoning") {
              return (
                <box
                  key={`reasoning-${j}`}
                  border={["left"]}
                  borderColor={colors.thinkingBorder}
                  customBorderChars={{ ...EmptyBorder, vertical: "│" }}
                  width="100%"
                  paddingX={2}
                >
                  <text attributes={TextAttributes.DIM} fg={colors.thinking}>
                    {`Thinking: ${part.text}`}
                  </text>
                </box>
              );
            }

            if(part.type === "tool-call") {
                return (
                <box
                  key={`tool-call-${j}`}
                  border={["left"]}
                  borderColor={colors.thinkingBorder}
                  customBorderChars={{ ...EmptyBorder, vertical: "│" }}
                  width="100%"
                  paddingX={2}
                >
                  <text attributes={TextAttributes.DIM} fg={colors.info}>
                    {formatToolCallStatus(part)}
                  </text>
                </box>
              );
            }

              if (part.type === "text") {
                return (
                  <box key={`text-${j}`} width="100%" paddingX={3}>
                    <text>{part.text}</text>
                  </box>
                );
              }
            return null;
          })}
        </box>
      ))}
    </box>
      <box paddingX={3} paddingY={1} gap={1} width="100%">
        <box flexDirection="row" gap={2}>
          <text fg={mode === Mode.PLAN ? colors.planMode : colors.primary}>◉</text>
          <box flexDirection="row" gap={1}>
            <text>{mode === Mode.PLAN ? "Plan" : "Build"}</text>
            <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
              ›
            </text>
            <text attributes={TextAttributes.DIM}>{model}</text>
            {duration != null && (
              <>
                <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                  ›
                </text>
                <text attributes={TextAttributes.DIM}>{duration}</text>
              </>
            )}
          </box>
        </box>
      </box>
    </box>
  );
}
