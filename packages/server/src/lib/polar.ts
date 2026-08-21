import { Polar } from "@polar-sh/sdk";

type PolarServer = "sandbox" | "production";
const SIGNUP_CREDITS = 100;
// Must match the immutable filter on the existing Polar meter.
const POLAR_CREDITS_EVENT_NAME = "owlcode-usage";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export function getPolarAccessToken() {
  return getRequiredEnv("POLAR_ACCESS_TOKEN");
}

export function getPolarProductId() {
  return getRequiredEnv("POLAR_PRODUCT_ID");
}

export function getPolarCreditsMeterId() {
  return getRequiredEnv("POLAR_CREDITS_METER_ID");
}

export function getPolarServer(): PolarServer {
  const server = process.env.POLAR_SERVER;
  if (!server) {
    return "sandbox";
  }

  if (server !== "sandbox" && server !== "production") {
    throw new Error("POLAR_SERVER must be either 'sandbox' or 'production'");
  }

  return server;
}

const polar = new Polar({
  accessToken: getPolarAccessToken(),
  server: getPolarServer(),
});

function hasStatusCode(error: unknown): error is { statusCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}

type CreateCheckoutUrlParams = {
  customerExternalId: string;
  requestUrl: string;
};

export async function createCheckoutUrl({
  customerExternalId,
  requestUrl,
}: CreateCheckoutUrlParams) {
  const result = await polar.checkouts.create({
    products: [getPolarProductId()],
    successUrl: new URL("/billing/success", requestUrl).toString(),
    externalCustomerId: customerExternalId,
    metadata: { source: "nightcode-cli" },
  });

  return result.url;
};

export async function createCustomerPortalUrl({
  customerExternalId,
  requestUrl,
}: CreateCheckoutUrlParams) {
  const result = await polar.customerSessions.create({
    externalCustomerId: customerExternalId,
    returnUrl: new URL("/billing/success", requestUrl).toString(),
  });

  return result.customerPortalUrl;
};

export async function getAvailableCreditsBalance(customerExternalId: string) {
  try {
    const customerState = await polar.customers.getStateExternal({
      externalId: customerExternalId,
    });

    const matchingMeters = customerState.activeMeters.filter(
      (meter) => meter.meterId === getPolarCreditsMeterId(),
    );

    if (matchingMeters.length > 1) {
      throw new Error("Expected exactly one matching Polar credits meter");
    }

    const creditsMeter = matchingMeters[0];
    return creditsMeter?.balance ?? 0;
  } catch (error) {
    if (hasStatusCode(error) && error.statusCode === 404) {
      return 0;
    }

    throw error;
  }
};

type GrantSignupCreditsParams = {
  externalCustomerId: string;
  email: string;
  name?: string;
};

/** Grants the one-time $1 (100-credit) signup bonus. Polar deduplicates the
 * event by externalId, so webhook delivery retries cannot grant it twice. */
export async function grantSignupCredits({
  externalCustomerId,
  email,
  name,
}: GrantSignupCreditsParams) {
  try {
    await polar.customers.getExternal({ externalId: externalCustomerId });
  } catch (error) {
    if (!hasStatusCode(error) || error.statusCode !== 404) throw error;

    await polar.customers.create({
      email,
      name: name || undefined,
      externalId: externalCustomerId,
    });
  }

  await polar.events.ingest({
    events: [
      {
        name: POLAR_CREDITS_EVENT_NAME,
        externalId: `signup-credit:${externalCustomerId}`,
        externalCustomerId,
        // A negative sum-meter event represents prepaid available credits.
        metadata: { credits: -SIGNUP_CREDITS },
      },
    ],
  });
}

type IngestAiUsageParams = {
  externalCustomerId: string;
  eventId: string;
  credits: number;
};

export async function ingestAiUsage({ 
  externalCustomerId, 
  eventId, 
  credits
}: IngestAiUsageParams) {
  if (credits <= 0) {
    return;
  }

  await polar.events.ingest({
    events: [
      {
        name: POLAR_CREDITS_EVENT_NAME,
        externalId: eventId,
        externalCustomerId,
        metadata: { credits },
      },
    ],
  });
};
