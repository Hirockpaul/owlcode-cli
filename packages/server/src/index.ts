import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import session  from "./routes/sessions"
import { sentry } from '@sentry/hono/bun';
import * as Sentry from "@sentry/hono/bun";
import chat from "./routes/chat"


const app = new Hono();

app.use(
  sentry(app, {
    dsn: "https://1daef9cc5f3e86f8407d1181588f08cb@o4511610193117184.ingest.us.sentry.io/4511610213040128",
    tracesSampleRate: 1.0,
    enableLogs: true,
    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/hono/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: [],
    },
  }),
);

app.get("/debug-sentry", () => {
  // Send a log before throwing the error
  Sentry.logger.info('User triggered test error', {
    action: 'test_error_endpoint',
  });
  // Send a test metric before throwing the error
  Sentry.metrics.count('test_counter', 1);
  throw new Error("My first Sentry ercclror!");
});

app.get("/health", (c) => {
  return c.json({ status: "ok" }, 200);
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    Sentry.logger.warn("Handled Http error", {
      status: error.status,
      message: error.message || "Request failed",
      path : c.req.method,
      method: c.req.method
    })
    return c.json ({
      error:error.message || "Request failed",
    },error.status);
    }
    Sentry.logger.error("Unhandled server error", {
      path: c.req.path,
      method: c.req.method,
      message:error instanceof Error? error.message:"Unknown error",
    })
   
    return c.json({error: "Internal server error"},500)
});

const routes = app.route("/session", session).route("/chat", chat);

export type AppType = typeof routes; // ← routes, not app

// idleTimeout must be high, otherwise LLM tool calls might not complete
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
export default { port, fetch: app.fetch, idleTimeout: 255 };