import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { InputBar } from "./input-bar";
import { Spinner } from "./spinner";
import { usePromptConfig } from "../providers/prompt-config";
import { useTheme } from "../providers/theme";

type Props = {
    children?: ReactNode;
    onSubmit: (text: string) => void;
    onInterrupt?: () => void;
    inputDisabled?: boolean;
    loading?: boolean;
    interruptible?: boolean;
    followStreaming?: boolean;
}

export function SessionShell({
    children,
    onSubmit,
    onInterrupt,
    inputDisabled = false,
    loading = false,
    interruptible = false,
    followStreaming = false,
}: Props) {
    const {mode} = usePromptConfig();
    const {colors} = useTheme();
    const conversationRef = useRef<ScrollBoxRenderable>(null);
    const [hasNewContent, setHasNewContent] = useState(false);

    const isNearBottom = useCallback(() => {
        const conversation = conversationRef.current;
        if (!conversation) return true;

        const maxScrollTop = Math.max(
            0,
            conversation.scrollHeight - conversation.viewport.height,
        );
        return conversation.scrollTop >= maxScrollTop - 1;
    }, []);

    const syncFollowState = useCallback(() => {
        setHasNewContent(followStreaming && !isNearBottom());
    }, [followStreaming, isNearBottom]);

    const handleManualScroll = useCallback(() => {
        // The scrollbox applies its wheel delta before the next tick. Reading after
        // that update lets its native sticky-scroll state remain the source of truth.
        process.nextTick(syncFollowState);
    }, [syncFollowState]);

    const jumpToLatest = useCallback(() => {
        const conversation = conversationRef.current;
        if (!conversation) return;

        conversation.scrollTo(
            Math.max(0, conversation.scrollHeight - conversation.viewport.height),
        );
        setHasNewContent(false);
    }, []);

    useEffect(() => {
        syncFollowState();
    }, [followStreaming, syncFollowState]);

    return (
        <box
            flexDirection="column"
            flexGrow={1}
            width="100%"
            height="100%"
            paddingY={1}
            paddingX={2}
            gap={1}
        >
            <scrollbox
                ref={conversationRef}
                flexGrow={1}
                width="100%"
                stickyScroll
                stickyStart="bottom"
                onMouseScroll={handleManualScroll}
            >
                <box width="100%" maxWidth={110} alignSelf="center">{children}</box>
            </scrollbox>
            {hasNewContent && (
                <box width="100%" maxWidth={110} alignSelf="center" alignItems="flex-end">
                    <text
                        selectable={false}
                        fg={colors.primary}
                        attributes={TextAttributes.DIM}
                        onMouseDown={jumpToLatest}
                    >
                        ↓ New content
                    </text>
                </box>
            )}
            <box flexShrink={0} width="100%" maxWidth={110} alignSelf="center">
                <InputBar onSubmit={onSubmit} disabled={inputDisabled} />
            </box>
            <box
                flexShrink={0}
                flexDirection="row"
                justifyContent="center"
                width="100%"
                height={1}
                gap={2}
                paddingLeft={1}
            >
                <box flexDirection="row" alignItems="center" gap={2}>
                    {loading ? (
                        <>
                        <Spinner mode={mode} /> 
                        
                    {interruptible ? <text> esc to interrupt</text> : null }
                    </>
                    ) : null}
                </box>

            </box>
        </box>
    );
}
