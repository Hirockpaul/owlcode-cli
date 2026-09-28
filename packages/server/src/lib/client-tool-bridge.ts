import { randomUUID } from "node:crypto";

const TOOL_RESULT_TIMEOUT_MS = 120_000;
const MAX_BUFFERED_TOOL_RESULTS = 100;

type PendingToolCall = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  removeAbortListener?: () => void;
};

type ToolRun = {
  userId: string;
  sessionId: string;
  pending: Map<string, PendingToolCall>;
  earlyResults: Map<string, unknown>;
};

const activeRuns = new Map<string, ToolRun>();

export function createClientToolRun(userId: string, sessionId: string) {
  const runId = randomUUID();
  const run: ToolRun = {
    userId,
    sessionId,
    pending: new Map(),
    earlyResults: new Map(),
  };
  activeRuns.set(runId, run);

  const waitForResult = (
    toolCallId: string,
    abortSignal?: AbortSignal,
  ): Promise<unknown> => {
    if (!activeRuns.has(runId)) {
      return Promise.reject(new Error("Local tool run is no longer active"));
    }

    if (run.earlyResults.has(toolCallId)) {
      const result = run.earlyResults.get(toolCallId);
      run.earlyResults.delete(toolCallId);
      return Promise.resolve(result);
    }

    return new Promise((resolve, reject) => {
      const finish = () => {
        const pending = run.pending.get(toolCallId);
        if (!pending) return;
        clearTimeout(pending.timeout);
        pending.removeAbortListener?.();
        run.pending.delete(toolCallId);
      };

      const timeout = setTimeout(() => {
        finish();
        resolve({ error: "Timed out waiting for the CLI to execute the local tool" });
      }, TOOL_RESULT_TIMEOUT_MS);

      const pending: PendingToolCall = {
        resolve: (result) => {
          finish();
          resolve(result);
        },
        reject: (error) => {
          finish();
          reject(error);
        },
        timeout,
      };

      if (abortSignal) {
        const abort = () => pending.reject(new Error("Local tool execution was aborted"));
        abortSignal.addEventListener("abort", abort, { once: true });
        pending.removeAbortListener = () => abortSignal.removeEventListener("abort", abort);
      }

      run.pending.set(toolCallId, pending);
    });
  };

  const close = () => {
    if (!activeRuns.delete(runId)) return;
    for (const pending of run.pending.values()) {
      clearTimeout(pending.timeout);
      pending.removeAbortListener?.();
      pending.reject(new Error("Local tool run ended before a result was received"));
    }
    run.pending.clear();
    run.earlyResults.clear();
  };

  return { runId, waitForResult, close };
}

export function submitClientToolResult(params: {
  runId: string;
  toolCallId: string;
  userId: string;
  sessionId: string;
  result: unknown;
}) {
  const run = activeRuns.get(params.runId);
  if (!run || run.userId !== params.userId || run.sessionId !== params.sessionId) {
    return false;
  }

  const pending = run.pending.get(params.toolCallId);
  if (pending) {
    pending.resolve(params.result);
  } else {
    // The SSE tool-call can reach and finish in the CLI before the AI SDK
    // advances its stream far enough to invoke execute(). Hold that result
    // until waitForResult registers the matching call.
    if (
      !run.earlyResults.has(params.toolCallId) &&
      run.earlyResults.size >= MAX_BUFFERED_TOOL_RESULTS
    ) {
      return false;
    }
    run.earlyResults.set(params.toolCallId, params.result);
  }
  return true;
}
