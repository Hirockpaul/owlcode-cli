import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { addDefaultParsers, getTreeSitterClient } from "@opentui/core";
import javaHighlights from "../assets/java-highlights.scm" with { type: "file" };
import javaWasm from "tree-sitter-wasms/out/tree-sitter-java.wasm" with { type: "file" };

let registered = false;

export function registerSyntaxHighlighters() {
  if (registered) return;
  registered = true;

  const packagedWorker = join(dirname(process.execPath), "owlcode-parser.worker.js");
  if (!process.env.OTUI_TREE_SITTER_WORKER_PATH && existsSync(packagedWorker)) {
    process.env.OTUI_TREE_SITTER_WORKER_PATH = packagedWorker;
  }

  addDefaultParsers([
    {
      filetype: "java",
      queries: { highlights: [javaHighlights] },
      wasm: javaWasm,
    },
  ]);
}

export async function verifySyntaxHighlighting() {
  const client = getTreeSitterClient();

  try {
    await client.initialize();
    const markdown = await client.highlightOnce("**bold**", "markdown");
    const java = await client.highlightOnce(
      'public class Solution { String value = "ok"; }',
      "java",
    );

    if (!markdown.highlights?.length) {
      throw new Error(markdown.error ?? markdown.warning ?? "Markdown parser returned no highlights");
    }
    if (!java.highlights?.length) {
      throw new Error(java.error ?? java.warning ?? "Java parser returned no highlights");
    }
  } finally {
    await client.destroy();
  }
}
