import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RootLayout } from "./layouts/root-layout";
import { Home } from "./screen/home";
import { NewSession } from "./screen/new-session";
import { Session } from "./screen/session";

// Load environment variables from repo root .env file
const envPath = process.cwd().endsWith("/packages/cli")
  ? resolve(process.cwd(), "../..", ".env")
  : resolve(process.cwd(), ".env");

try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && !key.startsWith("#") && key.trim()) {
      const value = valueParts.join("=").trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch {
  // .env file not found or unreadable, continue with defaults
}

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

const renderer = await createCliRenderer({
  targetFps: 60,
  exitOnCtrlC: false,
});
createRoot(renderer).render(<App />);