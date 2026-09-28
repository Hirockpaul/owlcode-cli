import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import packageMetadata from "../../../package.json" with { type: "json" };
import { RootLayout } from "./layouts/root-layout";
import { Home } from "./screen/home";
import { NewSession } from "./screen/new-session";
import { Session } from "./screen/session";
import { initializeConfig } from "./lib/env";
import { refreshApiClient } from "./lib/api-client";
import { updateOwlCode } from "./lib/update";
import { registerSyntaxHighlighters, verifySyntaxHighlighting } from "./lib/syntax-highlighting";

registerSyntaxHighlighters();

const router = createMemoryRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "sessions/new", element: <NewSession/> },
      { path: "sessions/:id", element: <Session/> },
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />
}

if (process.argv.includes("--check-syntax-highlighting")) {
  try {
    await verifySyntaxHighlighting();
    console.log("Syntax highlighting ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Syntax highlighting check failed: ${message}`);
    process.exit(1);
  }
} else if (process.argv[2] === "update") {
  try {
    const exitCode = await updateOwlCode();
    if (exitCode !== 0) process.exit(exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Update failed: ${message}`);
    process.exit(1);
  }
} else if (process.argv.includes("--version")) {
  console.log(`OwlCode v${packageMetadata.version}`);
} else {
  await initializeConfig();
  refreshApiClient();
  const renderer = await createCliRenderer({
    targetFps: 60,
    exitOnCtrlC: false,
  });
  createRoot(renderer).render(<App />);
}
