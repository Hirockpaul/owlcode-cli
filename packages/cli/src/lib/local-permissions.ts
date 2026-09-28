import { relative, isAbsolute } from "node:path";

export type LocalPermissionAccess = "read" | "write" | "execute";

export type LocalPermissionRequest = {
  access: LocalPermissionAccess;
  path: string;
};

type PermissionPrompt = (request: LocalPermissionRequest) => Promise<boolean>;

const approvedScopes: Record<LocalPermissionAccess, Set<string>> = {
  read: new Set(),
  write: new Set(),
  execute: new Set(),
};

let permissionQueue = Promise.resolve();

function includesPath(scope: string, target: string) {
  const rel = relative(scope, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function isApproved(request: LocalPermissionRequest) {
  return [...approvedScopes[request.access]].some((scope) => includesPath(scope, request.path));
}

export async function requestLocalPermission(
  request: LocalPermissionRequest,
  prompt: PermissionPrompt,
) {
  if (isApproved(request)) return true;

  let release!: () => void;
  const previous = permissionQueue;
  permissionQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    if (isApproved(request)) return true;
    const allowed = await prompt(request);
    if (allowed) approvedScopes[request.access].add(request.path);
    return allowed;
  } finally {
    release();
  }
}

export function clearLocalPermissions() {
  for (const scopes of Object.values(approvedScopes)) scopes.clear();
}
