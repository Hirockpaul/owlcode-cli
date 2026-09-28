import { useCallback, useEffect, useRef } from "react";
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { LocalPermissionRequest } from "../../lib/local-permissions";
import { useDialog } from "../../providers/dialog";
import { useKeyboardLayer } from "../../providers/keyboard-layer";
import { useTheme } from "../../providers/theme";

type Props = {
  request: LocalPermissionRequest;
  resolve: (allowed: boolean) => void;
};

export function PermissionDialogContent({ request, resolve }: Props) {
  const dialog = useDialog();
  const { isTopLayer } = useKeyboardLayer();
  const { colors } = useTheme();
  const settled = useRef(false);

  const finish = useCallback((allowed: boolean) => {
    if (settled.current) return;
    settled.current = true;
    resolve(allowed);
    dialog.close();
  }, [dialog, resolve]);

  useEffect(() => () => {
    if (!settled.current) resolve(false);
  }, [resolve]);

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;
    if (key.name === "a" || key.name === "return" || key.name === "enter") finish(true);
    if (key.name === "d") finish(false);
  });

  return (
    <box flexDirection="column" gap={1}>
      <text>Allow OwlCode to {request.access}:</text>
      <text attributes={TextAttributes.BOLD}>{request.path}</text>
      <box flexDirection="row" gap={2}>
        <text fg={colors.primary} onMouseDown={() => finish(true)}>[Allow] A / Enter</text>
        <text onMouseDown={() => finish(false)}>[Deny] D / Esc</text>
      </box>
    </box>
  );
}
