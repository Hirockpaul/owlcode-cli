import { hc } from "hono/client";
import type { AppType } from "@owlcode/server";
import { clearAuth, getAuth } from "./auth";
import { getApiUrl } from "./env";

function createApiClient() {
  return hc<AppType>(
    getApiUrl(),
  {
    fetch: async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      const headers = new Headers(init?.headers);
      const auth = getAuth();

      if (auth) {
        headers.set("Authorization", `Bearer ${auth.token}`);
      }

      const response = await fetch(input, { ...init, headers });
      if (response.status === 401) {
        clearAuth();
      }

      return response;
    }
    },
  );
}

// This binding is refreshed after first-run public configuration is loaded.
// ESM imports remain live bindings, so UI code uses the production API URL.
export let apiClient = createApiClient();

export function refreshApiClient() {
  apiClient = createApiClient();
}
