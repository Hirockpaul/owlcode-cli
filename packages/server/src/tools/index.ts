import { tool } from "ai";
import { getToolContracts, type ModeType } from "@owlcode/shared";

type ExecuteClientTool = (params: {
  toolCallId: string;
  toolName: string;
  input: unknown;
  abortSignal?: AbortSignal;
}) => Promise<unknown>;

export function createTools(mode: ModeType, executeClientTool: ExecuteClientTool) {
  const contracts = getToolContracts(mode);

  return Object.fromEntries(
    Object.entries(contracts).map(([toolName, contract]) => [
      toolName,
      tool({
        description: contract.description,
        inputSchema: contract.inputSchema,
        execute: (input, options) => executeClientTool({
          toolCallId: options.toolCallId,
          toolName,
          input,
          abortSignal: options.abortSignal,
        }),
      }),
    ]),
  );
}
