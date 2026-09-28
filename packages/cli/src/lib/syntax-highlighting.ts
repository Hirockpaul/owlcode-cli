import { addDefaultParsers } from "@opentui/core";
import javaHighlights from "../assets/java-highlights.scm" with { type: "file" };
import javaWasm from "tree-sitter-wasms/out/tree-sitter-java.wasm" with { type: "file" };

let registered = false;

export function registerSyntaxHighlighters() {
  if (registered) return;
  registered = true;

  addDefaultParsers([
    {
      filetype: "java",
      queries: { highlights: [javaHighlights] },
      wasm: javaWasm,
    },
  ]);
}
