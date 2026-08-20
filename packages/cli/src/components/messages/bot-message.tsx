import { useMemo, useState } from "react";
import prettyMs from "pretty-ms";
import { EmptyBorder } from "../border";
import { useTheme } from "../../providers/theme";
import type { Message } from "../../hooks/use-chat";
import { Mode, type ModeType } from "@owlcode/shared";
import { TextAttributes } from "@opentui/core";
import { copyToClipboard } from "../../lib/clipboard";
import { useToast } from "../../providers/toast";

type ClientMessagePart = Message["parts"][number];
type ToolPart = Extract<ClientMessagePart, { type: `tool-${string}` | "dynamic-tool" }>;

type Props = {
  parts: ClientMessagePart[];
  model: string;
  mode: ModeType;
  durationMs?: number;
  streaming?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
};

function formatToolName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
};

function isToolPart(part: ClientMessagePart): part is ToolPart {
  return part.type.startsWith("tool-");
};

function isTextPart(part: ClientMessagePart): part is ClientMessagePart & { type: "text"; text: string } {
  return part.type === "text" && "text" in part;
}

function formatToolArgs(tc: ToolPart): string {
  if (!("input" in tc) || tc.input == null) return "";
  if (typeof tc.input !== "object") return String(tc.input);

  return Object.entries(tc.input)
    .map(([key, value]) => {
      const rendered =
        value == null || typeof value !== "object"
          ? String(value)
          : JSON.stringify(value);

      return `${key}: ${rendered}`;
    })
    .join(", ");
}

function getToolInputValue(input: unknown, key: string) {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function getEditPreviewLines(part: ToolPart) {
  if (part.type !== "tool-editFile") return null;

  const oldString = getToolInputValue(part.input, "oldString");
  const newString = getToolInputValue(part.input, "newString");
  if (oldString == null || newString == null) return null;

  return [
    ...oldString.split("\n").map((line) => ({ kind: "removed" as const, text: `- ${line}` })),
    ...newString.split("\n").map((line) => ({ kind: "added" as const, text: `+ ${line}` })),
  ].slice(0, 80);
}

type PartGroup = {
  type: ClientMessagePart["type"];
  parts: ClientMessagePart[];
  key: string;
};

function groupConsecutiveParts(parts: ClientMessagePart[]): PartGroup[] {
  const groups: PartGroup[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const lastGroup = groups[groups.length - 1];

     if (lastGroup && lastGroup.type === part.type) {
      lastGroup.parts.push(part);
     } else {
      const key = 
        isToolPart(part) ? `group-tc-${part.toolCallId}` : `group-${part.type}-${i}`;
      groups.push({ type: part.type, parts: [part], key });
     }
  }

  return groups;
};

export function BotMessage({ 
  parts,
  model,
  mode,
  durationMs,
  streaming = false,
  canRegenerate = false,
  onRegenerate,
}: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copyText = useMemo(() => {
    return parts
      .filter(isTextPart)
      .map((part) => part.text)
      .join("");
  }, [parts]);

  const handleCopy = async () => {
    if (!copyText.trim()) return;

    try {
      await copyToClipboard(copyText);
      setCopied(true);
      toast.show({ variant: "success", message: "✓ Response copied" });
      setTimeout(() => setCopied(false), 1400).unref?.();
    } catch (err) {
      toast.show({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to copy response",
      });
    }
  };

  return (
    <box width="100%" alignItems="center">
      {groupConsecutiveParts(parts).map((group, i) => (
        <box key={group.key} width="100%" paddingTop={i === 0 ? 0 : 1}>
          {group.parts.map((part, j) => {
            if (part.type === "reasoning") {
              return (
                <box
                  key={`reasoning-${j}`}
                  border={["left"]}
                  borderColor={colors.thinkingBorder}
                  customBorderChars={{
                    ...EmptyBorder,
                    vertical: "│",
                  }}
                  width="100%"
                  paddingX={2}
                >
                  <text attributes={TextAttributes.DIM}>
                    <em fg={colors.thinking}>Thinking:</em> {part.text}
                  </text>
                </box>
              );
            }

            if (isToolPart(part)) {
              const toolName = part.type.slice("tool-".length);
              const editPreviewLines = getEditPreviewLines(part);

              return (
                <box
                  key={part.toolCallId}
                  border={["left"]}
                  borderColor={colors.thinkingBorder}
                  customBorderChars={{
                    ...EmptyBorder,
                    vertical: "│",
                  }}
                  width="100%"
                  paddingX={2}
                >
                  <text attributes={TextAttributes.DIM}>
                    <em fg={colors.info}>{formatToolName(toolName)}:</em> {formatToolArgs(part)}
                    {part.state !== "output-available" && part.state !== "output-error" 
                      ? " …" 
                      : ""
                    }
                    {part.state === "output-error" ? ` ${part.errorText}` : ""}
                  </text>
                  {editPreviewLines && (
                    <box paddingTop={1} width="100%">
                      <text attributes={TextAttributes.DIM} fg={colors.info}>
                        Edit preview:
                      </text>
                      <box paddingTop={1} width="100%">
                        {editPreviewLines.map((line, index) => (
                          <text
                            key={`${line.kind}-${index}`}
                            fg={line.kind === "removed" ? colors.error : colors.success}
                          >
                            {line.text}
                          </text>
                        ))}
                      </box>
                    </box>
                  )}
                </box>
              );
            }

            if (part.type === "text") {
              return (
                <box key={`text-${j}`} paddingX={3} width="100%">
                  <text>{part.text}</text>
                </box>
              );
            }
            
            return null;
          })}
        </box>
      ))}

      {((copyText.trim().length > 0) || canRegenerate) && !streaming && (
        <box paddingX={3} paddingTop={1} width="100%" flexDirection="row" gap={2}>
          {copyText.trim().length > 0 && (
            <box
              flexDirection="row"
              flexShrink={0}
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
                {copied ? "✓ Response copied" : "Copy response"}
              </text>
            </box>
          )}
          {canRegenerate && onRegenerate && (
            <box
              flexDirection="row"
              flexShrink={0}
              paddingX={1}
              border={["left", "right"]}
              borderColor={colors.info}
              customBorderChars={EmptyBorder}
              onMouseDown={() => {
                onRegenerate();
              }}
            >
              <text
                selectable={false}
                fg={colors.info}
                attributes={TextAttributes.BOLD}
              >
                Regenerate response
              </text>
            </box>
          )}
        </box>
      )}

      <box paddingX={3} paddingY={1} gap={1} width="100%">
        <box flexDirection="row" gap={2}>
          <text fg={mode === Mode.PLAN ? colors.planMode : colors.primary}>◉</text>
          <box flexDirection="row" gap={1}>
            <text>
              {mode === Mode.PLAN ? "Plan" : "Build"}
            </text>
            <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
              ›
            </text>
            <text attributes={TextAttributes.DIM}>{model}</text>
            {(durationMs != null) && (
              <>
                <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                  ›
                </text>
                <text attributes={TextAttributes.DIM}>
                  {prettyMs(durationMs)}
                </text>
              </>
            )}
          </box>
        </box>
      </box>
    </box>
  );
};
