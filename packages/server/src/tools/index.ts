import { tool } from "ai";
import { getToolContracts, type ModeType } from "@owlcode/shared";
import { webToolContracts } from "./web";

type ExecuteClientTool = (params: {
  toolCallId: string;
  toolName: string;
  input: unknown;
  abortSignal?: AbortSignal;
}) => Promise<unknown>;

export function createTools(mode: ModeType, executeClientTool?: ExecuteClientTool) {
  const contracts = getToolContracts(mode);

  const clientTools = executeClientTool ? Object.fromEntries(
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
  ) : {};

  const webTools = {
    searchWeb: tool({
      description: webToolContracts.searchWeb.description,
      inputSchema: webToolContracts.searchWeb.inputSchema,
      execute: (input, options) => webToolContracts.searchWeb.execute(input, options.abortSignal),
    }),
    openWebPage: tool({
      description: webToolContracts.openWebPage.description,
      inputSchema: webToolContracts.openWebPage.inputSchema,
      execute: (input, options) => webToolContracts.openWebPage.execute(input, options.abortSignal),
    }),
    extractWebContent: tool({
      description: webToolContracts.extractWebContent.description,
      inputSchema: webToolContracts.extractWebContent.inputSchema,
      execute: (input, options) => webToolContracts.extractWebContent.execute(input, options.abortSignal),
    }),
    findOnPage: tool({
      description: webToolContracts.findOnPage.description,
      inputSchema: webToolContracts.findOnPage.inputSchema,
      execute: (input) => webToolContracts.findOnPage.execute(input),
    }),
  };

  return { ...clientTools, ...webTools };
}

export function isClientTool(toolName: string, mode: ModeType) {
  return toolName in getToolContracts(mode);
}

const slashWebTools = {
  search: "searchWeb",
  open: "openWebPage",
  read: "extractWebContent",
  find: "findOnPage",
} as const;

export type WebToolName = (typeof slashWebTools)[keyof typeof slashWebTools];

export function getSlashWebTool(content: string): WebToolName | undefined {
  const match = content.trim().match(/^\/(search|open|read|find)(?:\s+)(\S[\s\S]*)$/i);
  if (!match) return undefined;
  return slashWebTools[match[1]!.toLowerCase() as keyof typeof slashWebTools];
}
