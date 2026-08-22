import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type AuthData = {
  token: string;
  user?: {
    name?: string;
    email?: string;
  };
};

const AUTH_DIR = join(homedir(), ".owlcode");
const AUTH_FILE = join(AUTH_DIR, "auth.json");


export function getAuth(): AuthData | null {
  try {
    const data = readFileSync(AUTH_FILE, "utf-8");
    const parsed = JSON.parse(data) as Partial<AuthData>;
    if (typeof parsed.token !== "string") return null;

    const user = parsed.user;
    return {
      token: parsed.token,
      ...(user && typeof user === "object"
        ? {
            user: {
              ...(typeof user.name === "string" ? { name: user.name } : {}),
              ...(typeof user.email === "string" ? { email: user.email } : {}),
            },
          }
        : {}),
    };
  } catch {
    return null;
  }
};

export function getUserDisplayName() {
  const user = getAuth()?.user;
  const name = user?.name?.trim();
  if (name) return name.split(/\s+/)[0] ?? null;

  const email = user?.email?.trim();
  return email?.split("@")[0] || null;
}

export function saveAuth(data: AuthData) {
  if (!existsSync(AUTH_DIR)) {
    // Owner-only permissions (rwx------) so other users on the machine can't read tokens
    mkdirSync(AUTH_DIR, { mode: 0o700 });
  }
  writeFileSync(AUTH_FILE, JSON.stringify(data), { mode: 0o600 });
}

export function clearAuth() {
  try {
    unlinkSync(AUTH_FILE);
  } catch {
    // File doesn't exist
  }
}
