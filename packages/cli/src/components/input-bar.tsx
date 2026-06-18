import { StatusBar } from "./status_bar";
import { EmptyBorder } from "./border";
import  type {KeyBinding } from "@opentui/core";
import { CommandMenu } from "./command-menu";
import { useCallback, useEffect, useRef } from "react";
import { useRenderer } from "@opentui/react";
import { TextareaRenderable } from "@opentui/core";
import type { Command } from "./command-menu/types";
import { useCommandMenu } from "./command-menu/use-command-menu";
import {  MAX_VISIBLE_ITEMS } from "./command-menu";
import { useToast } from "../providers/toast";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { text } from "node:stream/consumers";
import { useDialog } from "../providers/dialog";
import { useTheme } from "../providers/theme";

type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  fixedWidth?: number | undefined;
};

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] =[
  {name: "return", action: "submit"},
  {name: "enter", action: "submit"},
  {name: "return", shift: true, action: "newline"},
  {name: "enter", shift: true, action: "newline"},
]

export function InputBar({ onSubmit, disabled = false, fixedWidth, }: Props) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const onSubmitRef  = useRef<() =>void>(() => {});
  const renderer = useRenderer();
  const toast = useToast()
  const dialog = useDialog();
  const {isTopLayer, setResponder} = useKeyboardLayer();
  const {colors} = useTheme()

  const {
    showCommandMenu,
    commandQuery,
    selectedIndex,
    scrollRef,
    handleContentChange,
    resolveCommand,
    setSelectedIndex,
  } = useCommandMenu();

const handleCommandExecute = useCallback((index: number) => {
    const command = resolveCommand(index);
    handleCommand(command);
}, []);

  const handleTextareaContentChange = useCallback(() => {
      const textarea = textareaRef.current;
      if(!textarea) return

      handleContentChange(textarea.plainText); 
  },[]);

   const handleSubmit = useCallback (() => {
    if(disabled) return;

    const textarea = textareaRef.current;
    if(!textarea) return;

    const  text = textarea.plainText.trim();
    if(text.length === 0) return;

    onSubmit(text);
    textarea.setText("");
  },[disabled, onSubmit])

  const handleCommand = useCallback ((
    command: Command | undefined
  ) => {
    const textarea = textareaRef.current;
    if(!textarea || !command) return;
    textarea.setText("");

    if(command.action) {
      command.action({
        exit: () =>renderer.destroy(),
        toast,
        dialog,
      });
    } else {
      textarea.insertText(command.value + " ");
    }

  },[renderer, toast]);
 
  // wire up textarea submit handler once  so it alwasy read the latest state.
  useEffect(() => {
    const textarea = textareaRef.current;
    if(!textarea) return;

    textarea.onSubmit = () => {
      onSubmitRef.current();
    };
  }, []);

  onSubmitRef.current = () => {
    if(disabled) return;

    if(showCommandMenu) {
      const command = resolveCommand(selectedIndex);
      handleCommand(command);
      return; 
    }
    handleSubmit();
  };

  // Register the base layer responder for ctrl+c dismissal
  useEffect(() => {
    setResponder("base", () => {
      if(disabled) return false;

      const textarea = textareaRef.current;
      if(textarea && textarea.plainText.length > 0) {
        textarea.setText("");
        return true;
      }
      return false;
    });

    return () => setResponder("base", null);
  },[disabled, setResponder]);

  return (
    <box alignItems="center">
      <box
        border={["left"]}
        borderColor={colors.primary}
        customBorderChars={{
          ...EmptyBorder,
          vertical: "┃",
          bottomLeft: "╹",
        }}
        width={60}
        minWidth={40}
        alignSelf="center"
      >

      <box
        position="relative"
        justifyContent="center"
        paddingX={2}
        paddingY={1}
        backgroundColor={colors.surface}
        gap={1}
      >
        {showCommandMenu && (
          <box
          position="absolute"
          bottom="100%"
          left={0}
          minWidth={50}
          height={MAX_VISIBLE_ITEMS}
          overflow="hidden"
          backgroundColor={colors.surface}
          zIndex={10}
          >
            <CommandMenu
            query={commandQuery}
            selectIndex={selectedIndex}
            scrollRef={scrollRef}
            onSelect={setSelectedIndex}
            onExecute={handleCommandExecute}
            />

          </box>
        )}
        <textarea
          ref={textareaRef}
          flexShrink={0}
          focused={!disabled && (isTopLayer("base") || isTopLayer("command"))}
          keyBindings={TEXTAREA_KEY_BINDINGS}
          onContentChange={handleTextareaContentChange}
          placeholder='Ask anything... "Fix a bug in the database"'
        />

        <StatusBar />
      </box>
    </box>
    </box>
  );
}