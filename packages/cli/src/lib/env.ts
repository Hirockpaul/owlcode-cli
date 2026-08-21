import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const CONFIG_FILE = join(homedir(), ".owlcode", "config.json");
const CONFIG_DIR = join(homedir(), ".owlcode");

// The installer and release artifacts live in this public bucket. This is only
// a bootstrap location: its JSON document contains public client settings.
const DEFAULT_CONFIG_URL =
  "https://owlcode-cli-releases-441870953577-ap-south-1-an.s3.ap-south-1.amazonaws.com/owlcode-config.json";

// These are public OAuth client settings for the OwlCode Clerk application.
// They intentionally do not include a Clerk secret key.
const DEFAULT_CLERK_FRONTEND_API = "https://alive-ewe-18.clerk.accounts.dev";
const DEFAULT_CLERK_OAUTH_CLIENT_ID = "dhGWw7f58C4yNecE";

type OwlCodeConfig = {
  apiUrl?: unknown;
  clerk?: {
    frontendApi?: unknown;
    oauthClientId?: unknown;
  };
  remoteConfig?: {
    apiUrl?: unknown;
    clerk?: {
      frontendApi?: unknown;
      oauthClientId?: unknown;
    };
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
  const config = getUserConfig();
  return (
    configuredString(process.env.OWLCODE_API_URL) ??
    configuredString(config.apiUrl) ??
    configuredString(config.remoteConfig?.apiUrl) ??
    "http://localhost:3000"
  );
}

export function getClerkConfig() {
  const config = getUserConfig();

  return {
    frontendApi:
      configuredString(process.env.CLERK_FRONTEND_API) ??
      configuredString(config.clerk?.frontendApi) ??
      configuredString(config.remoteConfig?.clerk?.frontendApi) ??
      DEFAULT_CLERK_FRONTEND_API,
    oauthClientId:
      configuredString(process.env.CLERK_OAUTH_CLIENT_ID) ??
      configuredString(config.clerk?.oauthClientId) ??
      configuredString(config.remoteConfig?.clerk?.oauthClientId) ??
      DEFAULT_CLERK_OAUTH_CLIENT_ID,
  };
}

function isRemoteConfig(value: unknown): value is NonNullable<OwlCodeConfig["remoteConfig"]> {
  if (!value || typeof value !== "object") return false;
  const config = value as OwlCodeConfig;
  return Boolean(
    configuredString(config.apiUrl) &&
      configuredString(config.clerk?.frontendApi) &&
      configuredString(config.clerk?.oauthClientId),
  );
}

/**
 * Fetch public production settings for a fresh installed CLI. Failures are
 * intentionally non-fatal: local overrides, the cached config, and compiled
 * Clerk defaults still let developers and existing users work offline.
 */
export async function initializeConfig() {
  const url = configuredString(process.env.OWLCODE_CONFIG_URL) ?? DEFAULT_CONFIG_URL;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return;

    const remoteConfig: unknown = await response.json();
    if (!isRemoteConfig(remoteConfig)) return;

    const current = getUserConfig();
    const next: OwlCodeConfig = { ...current, remoteConfig };
    if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { mode: 0o700 });

    const temporaryFile = `${CONFIG_FILE}.new`;
    writeFileSync(temporaryFile, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
    renameSync(temporaryFile, CONFIG_FILE);
  } catch {
    // Network and filesystem errors must not prevent the CLI from starting.
  }
}
