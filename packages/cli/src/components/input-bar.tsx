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
type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
};

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] =[
  {name: "return", action: "submit"},
  {name: "enter", action: "submit"},
  {name: "return", shift: true, action: "newline"},
  {name: "enter", shift: true, action: "newline"},
]

export function InputBar({ onSubmit, disabled = false,}: Props) {
  const textareaRef = useRef<TextareaRenderable>(null);
  const onSubmitRef  = useRef<() =>void>(() => {});
  const renderer = useRenderer();

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
      });
    } else {
      textarea.insertText(command.value + " ");
    }

  },[renderer])
 
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

  
  return (
    <box width="100%" alignItems="center">
      <box
        border={["left"]}
        borderColor="cyan"
        customBorderChars={{
          ...EmptyBorder,
          vertical: "┃",
          bottomLeft: "╹",
        }}
        width="100%"
      >

      <box
        position="relative"
        justifyContent="center"
        paddingX={2}
        paddingY={1}
        backgroundColor="#1A1A24"
        width="100%"
        gap={1}
      >
        {showCommandMenu && (
          <box
          position="absolute"
          bottom="100%"
          left={0}
          width="100%"
          minWidth={50}
          height={MAX_VISIBLE_ITEMS}
          overflow="hidden"
          backgroundColor="#1A1A24"
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
          focused={!disabled}
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