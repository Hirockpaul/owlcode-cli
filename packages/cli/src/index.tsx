import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import packageMetadata from "../../../package.json" with { type: "json" };
import { RootLayout } from "./layouts/root-layout";
import { Home } from "./screen/home";
import { NewSession } from "./screen/new-session";
import { Session } from "./screen/session";

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

if (process.argv.includes("--version")) {
  console.log(`OwlCode v${packageMetadata.version}`);
} else {
  const renderer = await createCliRenderer({
    targetFps: 60,
    exitOnCtrlC: false,
  });
  createRoot(renderer).render(<App />);
}
