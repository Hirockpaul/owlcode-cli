import type { RefObject } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { getFilteredCommands } from "./filter-commands";
import { COMMANDS } from "./commands";
import { useTheme } from "../../providers/theme";
import { color } from "bun";


export const MAX_VISIBLE_ITEMS = 8;

const COMMAND_COL_WIDTH = Math.max(...COMMANDS.map((cmd) => cmd.name.length)) + 4;

type CommandMenuProps = {
    query: string;
    selectIndex: number;
    scrollRef: RefObject<ScrollBoxRenderable>;
    onSelect: (index: number) => void;
    onExecute: (index: number) => void;
}

export function CommandMenu({
    query,
    selectIndex,
    scrollRef,
    onSelect,
    onExecute,
}: CommandMenuProps) {
    const {colors } = useTheme()
    const filtered = getFilteredCommands(query);
    const padCount = Math.max(0, MAX_VISIBLE_ITEMS - filtered.length);

    return (
        <scrollbox ref={scrollRef} height={MAX_VISIBLE_ITEMS} minHeight={MAX_VISIBLE_ITEMS}>
            {filtered.length === 0 ? (
                <>
                    <box paddingX={1}>
                        <text attributes={TextAttributes.DIM}>
                            No matching commands
                        </text>
                    </box>
                    {Array.from({ length: MAX_VISIBLE_ITEMS - 1 }).map((_, i) => (
                        <box key={`pad-${i}`} />
                    ))}
                </>
            ) : (
                <>
                    {filtered.map((cmd, i) => {
                        const isSelected = i === selectIndex;

                        return (
                            <box
                                key={cmd.value}
                                flexDirection="row"
                                paddingX={1}
                                overflow="hidden"
                                backgroundColor={isSelected ? colors.selection : undefined}
                                onMouseMove={() => onSelect(i)}
                                onMouseDown={() => onExecute(i)}
                            >
                                <box width={COMMAND_COL_WIDTH} flexShrink={0}>
                                    <text selectable={false} fg={isSelected ? "black" : "white"}>
                                        /{cmd.name}
                                    </text>
                                </box>
                                <box flexGrow={1} flexShrink={1} overflow="hidden">
                                    <text selectable={false} fg={isSelected ? "black" : "gray"}>
                                        {cmd.description}
                                    </text>
                                </box>
                            </box>
                        );
                    })}
                    {Array.from({ length: padCount }).map((_, i) => (
                        <box key={`pad-${i}`} />
                    ))}
                </>
            )}
        </scrollbox>
    );
}