import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "./middleware/require-auth";
import sessions from "./routes/sessions";
import chat from "./routes/chat";
import auth from "./routes/auth";
import billing from "./routes/billing";
import downloads from "./routes/downloads";

const app = new Hono();

app.get("/health", (c) =>
  c.json({ status: "ok", service: "owlcode-api" })
);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ 
      error: error.message || "Request failed",
    }, error.status);
  };

  console.error("Unhandled server error", error);
  return c.json({ error: "Internal server error" }, 500);
});

app.use("/sessions/*", requireAuth);
app.use("/chat/*", requireAuth);
app.use("/billing/checkout", requireAuth);
app.use("/billing/portal", requireAuth);

const routes = app
  .route("/auth", auth)
  .route("/downloads", downloads)
  .route("/billing", billing)
  .route("/sessions", sessions)
  .route("/chat", chat);

export type AppType = typeof routes;

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port number");
}

const hostname = "0.0.0.0";
console.info(`OwlCode API configured to listen on ${hostname}:${port}`);

// idleTimeout must be high, otherwise LLM tool calls might not complete.
export default {
  port,
  hostname,
  fetch: app.fetch,
  idleTimeout: 255,
  development: process.env.NODE_ENV !== "production",
};
