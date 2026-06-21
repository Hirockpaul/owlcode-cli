import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import session  from "./routes/sessions"


const app = new Hono()

export type AppType = typeof app

app.onError((error, c) => {
    if(error instanceof HTTPException) {
        return c.json({
            error:error.message || "Request failed",
        },error.status);
    };
    
    console.error('Unhandled server error:', (error as Error)?.stack ?? error);
    return c.json ({error: "Internal server error"},500);
});

const routes = app.route("/session", session)
// idleTimeout  must be high, otherWise LLm tool calls might not complete
export default {port:3000, fetch:app.fetch,idleTimeOut: 255};