import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { z } from "zod";

const TAVILY_URL = "https://api.tavily.com/search";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PROVIDER_RESPONSE_BYTES = 2_000_000;
const MAX_OPEN_CONTENT_CHARS = 20_000;
const MAX_EXTRACTED_CONTENT_CHARS = 60_000;

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type DnsLookup = typeof lookup;

type WebDependencies = {
  fetch?: Fetch;
  lookup?: DnsLookup;
  timeoutMs?: number;
};

function failure(error: string, code?: string) {
  return { success: false as const, error, ...(code ? { code } : {}) };
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0]!;
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : null);
  if (!ipv4) return false;
  const octets = ipv4.split(".").map(Number);
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a! >= 224;
}

export async function validateWebUrl(value: string, dnsLookup: DnsLookup = lookup) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }
  if (url.username || url.password) throw new Error("URLs containing credentials are not supported");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local or internal network URLs are not allowed");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("Local or internal network URLs are not allowed");
  } else {
    const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("Local or internal network URLs are not allowed");
    }
  }

  return url.toString();
}

async function readLimitedJson(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error("Provider response exceeded the size limit");
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_PROVIDER_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Provider response exceeded the size limit");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text ? JSON.parse(text) : null;
}

async function providerRequest(
  url: string,
  init: RequestInit,
  apiName: string,
  fetchImpl: Fetch,
  signal?: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: combinedSignal });
  } catch (error) {
    if (combinedSignal.aborted) throw new Error(`${apiName} request timed out or was cancelled`);
    throw new Error(`${apiName} request failed`);
  }
  if (!response.ok) {
    if (response.status === 429) throw new Error(`${apiName} rate limit exceeded`);
    throw new Error(`${apiName} request failed with status ${response.status}`);
  }
  return readLimitedJson(response);
}

function domainOf(value: string) {
  try { return new URL(value).hostname; } catch { return undefined; }
}

export async function searchWeb(
  input: z.infer<typeof searchWebInput>,
  signal?: AbortSignal,
  dependencies: WebDependencies = {},
) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return failure("Web search is not configured", "NOT_CONFIGURED");
  try {
    const payload = await providerRequest(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: input.query,
        max_results: input.limit,
        search_depth: "advanced",
        include_answer: false,
        ...(input.recency ? { time_range: input.recency } : {}),
      }),
    }, "Tavily", dependencies.fetch ?? fetch, signal, dependencies.timeoutMs) as { results?: unknown[] } | null;
    const results = Array.isArray(payload?.results) ? payload.results : [];
    return {
      success: true as const,
      results: results.slice(0, input.limit).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const result = item as Record<string, unknown>;
        if (typeof result.url !== "string") return [];
        return [{
          title: typeof result.title === "string" ? result.title : result.url,
          url: result.url,
          snippet: typeof result.content === "string" ? result.content : "",
          source: domainOf(result.url),
          ...(typeof result.published_date === "string" ? { publishedAt: result.published_date } : {}),
        }];
      }),
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Web search failed", "SEARCH_FAILED");
  }
}

type FirecrawlData = {
  markdown?: string;
  metadata?: Record<string, unknown>;
};

async function scrapeWebPage(
  rawUrl: string,
  signal?: AbortSignal,
  dependencies: WebDependencies = {},
) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return failure("Webpage retrieval is not configured", "NOT_CONFIGURED");
  try {
    const url = await validateWebUrl(rawUrl, dependencies.lookup ?? lookup);
    const payload = await providerRequest(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    }, "Firecrawl", dependencies.fetch ?? fetch, signal, dependencies.timeoutMs) as { success?: boolean; data?: FirecrawlData } | null;
    if (!payload?.success || !payload.data) return failure("Unable to retrieve webpage", "EMPTY_RESPONSE");

    const metadata = payload.data.metadata ?? {};
    const finalUrlCandidate = [metadata.sourceURL, metadata.url].find((item): item is string => typeof item === "string") ?? url;
    const finalUrl = await validateWebUrl(finalUrlCandidate, dependencies.lookup ?? lookup);
    return { success: true as const, url: finalUrl, content: payload.data.markdown ?? "", metadata };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to retrieve webpage", "RETRIEVAL_FAILED");
  }
}

function pageMetadata(metadata: Record<string, unknown>) {
  const value = (keys: string[]) => keys.map((key) => metadata[key]).find((item): item is string => typeof item === "string");
  return {
    ...(value(["title", "ogTitle"]) ? { title: value(["title", "ogTitle"]) } : {}),
    ...(value(["description", "ogDescription"]) ? { description: value(["description", "ogDescription"]) } : {}),
    ...(value(["publishedTime", "published_at", "article:published_time"]) ? { publishedAt: value(["publishedTime", "published_at", "article:published_time"]) } : {}),
  };
}

export async function openWebPage(input: z.infer<typeof urlInput>, signal?: AbortSignal, dependencies?: WebDependencies) {
  const result = await scrapeWebPage(input.url, signal, dependencies);
  if (!result.success) return result;
  const truncated = result.content.length > MAX_OPEN_CONTENT_CHARS;
  return {
    success: true as const,
    url: result.url,
    source: domainOf(result.url),
    ...pageMetadata(result.metadata),
    content: result.content.slice(0, MAX_OPEN_CONTENT_CHARS),
    ...(truncated ? { truncated: true, totalCharacters: result.content.length } : {}),
  };
}

export async function extractWebContent(input: z.infer<typeof urlInput>, signal?: AbortSignal, dependencies?: WebDependencies) {
  const result = await scrapeWebPage(input.url, signal, dependencies);
  if (!result.success) return result;
  const truncated = result.content.length > MAX_EXTRACTED_CONTENT_CHARS;
  return {
    success: true as const,
    url: result.url,
    source: domainOf(result.url),
    ...pageMetadata(result.metadata),
    content: result.content.slice(0, MAX_EXTRACTED_CONTENT_CHARS),
    ...(truncated ? { truncated: true, totalCharacters: result.content.length } : {}),
  };
}

export function findOnPage(input: z.infer<typeof findOnPageInput>) {
  const query = input.query.trim().toLocaleLowerCase();
  const sections = input.content.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean);
  const matches = sections
    .map((text, index) => ({ text, index, score: text.toLocaleLowerCase().split(query).length - 1 }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, input.limit)
    .map(({ text, index }) => ({ section: index + 1, snippet: text.length > 1_500 ? `${text.slice(0, 1_500)}…` : text }));
  return { success: true as const, query: input.query, matches };
}

const searchWebInput = z.object({
  query: z.string().trim().min(1).max(1_000),
  limit: z.number().int().min(1).max(20).default(5),
  recency: z.enum(["day", "week", "month", "year"]).optional(),
});
const urlInput = z.object({ url: z.string().trim().min(1).max(8_192) });
const findOnPageInput = z.object({
  content: z.string().max(100_000),
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(20).default(5),
});

export const webToolContracts = {
  searchWeb: {
    description: "Search the current public web with Tavily. Returns source URLs and concise result snippets.",
    inputSchema: searchWebInput,
    execute: searchWeb,
  },
  openWebPage: {
    description: "Open an HTTP/HTTPS webpage through the server and return cleaned readable content and metadata.",
    inputSchema: urlInput,
    execute: openWebPage,
  },
  extractWebContent: {
    description: "Extract the main readable content and metadata from an HTTP/HTTPS webpage, removing page chrome and noise.",
    inputSchema: urlInput,
    execute: extractWebContent,
  },
  findOnPage: {
    description: "Find the most relevant matching sections in webpage content already retrieved by another web tool.",
    inputSchema: findOnPageInput,
    execute: (input: z.infer<typeof findOnPageInput>) => findOnPage(input),
  },
} as const;
