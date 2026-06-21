import { hc } from "hono/client";
import type {AppType} from "@owlcode/server";

type ApiClient = {
  session: {
    $post: (init?: { json?: unknown }) => Promise<Response>;
    $get?: (init?: unknown) => Promise<Response>;
    [key: string]: any;
  };
  [key: string]: any;
};

export const apiClient = hc<AppType>(
  process.env.API_URL ?? "http://localhost:3000"
) as unknown as ApiClient;

