import { useCallback, useEffect, useRef } from "react";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";
import { Mode, type ModeType } from "@owlcode/shared";

const AVAILABLE_MODES: ModeType[] = [Mode.PLAN, Mode.BUILD];

type AgentsDialogContentProps = {
    currentMode:ModeType;
    onSelectMode:(mode:ModeType) => void;
}

function getModeLabel(mode:ModeType) {
    return mode === Mode.PLAN ? "Plan" : "Build";
}

export const AgentsDialogContent = ({
     currentMode,
     onSelectMode 
    }: AgentsDialogContentProps) => {
     const dialog = useDialog();
     const confirmedRef = useRef(false);

   const handleSelect = useCallback(
    (nextMode: ModeType) => {
        onSelectMode(nextMode);
        dialog.close();
    },
    [onSelectMode,dialog]
   )

   return (
    <DialogSearchList
      items={AVAILABLE_MODES}
      onSelect={handleSelect}
      filterFn={(item, query) => (getModeLabel(item)).toLowerCase().includes(query.toLowerCase())}
      renderItem={(item, isSelected) => (
        <text selectable ={false} fg = {isSelected ? "black" : "white"}>
            {item === currentMode ? " • " : "  "}
            {getModeLabel(item)}
        </text>
      )}
      getKey={(item) => item}
      placeholder="Search agents"
      emptyText="No matching agents"
    />
   )
}