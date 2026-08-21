import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

const CONFIG_FILE = join(homedir(), ".owlcode", "config.json");

// These are public OAuth client settings for the OwlCode Clerk application.
// They intentionally do not include a Clerk secret key.
const DEFAULT_CLERK_FRONTEND_API = "https://alive-ewe-18.clerk.accounts.dev";
const DEFAULT_CLERK_OAUTH_CLIENT_ID = "dhGWw7f58C4yNecE";

type OwlCodeConfig = {
  clerk?: {
    frontendApi?: unknown;
    oauthClientId?: unknown;
  };
};

function configuredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getUserConfig(): OwlCodeConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as OwlCodeConfig;
  } catch {
    return {};
  }
}

export function getApiUrl() {
  return process.env.OWLCODE_API_URL ?? "http://localhost:3000";
}

export function getClerkConfig() {
  const config = getUserConfig();

  return {
    frontendApi:
      configuredString(process.env.CLERK_FRONTEND_API) ??
      configuredString(config.clerk?.frontendApi) ??
      DEFAULT_CLERK_FRONTEND_API,
    oauthClientId:
      configuredString(process.env.CLERK_OAUTH_CLIENT_ID) ??
      configuredString(config.clerk?.oauthClientId) ??
      DEFAULT_CLERK_OAUTH_CLIENT_ID,
  };
}
