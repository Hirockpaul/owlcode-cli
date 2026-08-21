import { Hono } from "hono";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { grantSignupCredits } from "../lib/polar";

const app = new Hono().post("/clerk", async (c) => {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("CLERK_WEBHOOK_SIGNING_SECRET is not configured");
    return c.json({ error: "Webhook endpoint is not configured" }, 503);
  }

  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(c.req.raw, { signingSecret });
  } catch {
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  if (event.type !== "user.created") {
    return c.json({ received: true });
  }

  const user = event.data;
  const email =
    user.email_addresses.find((item) => item.id === user.primary_email_address_id)
      ?.email_address ?? user.email_addresses[0]?.email_address;

  if (!email) {
    console.error("Cannot grant signup credits: Clerk user has no email", { userId: user.id });
    return c.json({ error: "A user email is required for signup credits" }, 422);
  }

  try {
    await grantSignupCredits({
      externalCustomerId: user.id,
      email,
      name: [user.first_name, user.last_name].filter(Boolean).join(" ") || undefined,
    });
    return c.json({ received: true });
  } catch (error) {
    console.error("Failed to grant signup credits", { error, userId: user.id });
    return c.json({ error: "Unable to grant signup credits" }, 500);
  }
});

export default app;
