import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  extractWebContent,
  findOnPage,
  openWebPage,
  searchWeb,
  validateWebUrl,
} from "./web";
import { getSlashWebTool } from ".";

const originalTavilyKey = process.env.TAVILY_API_KEY;
const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY;

beforeEach(() => {
  process.env.TAVILY_API_KEY = "server-test-tavily-key";
  process.env.FIRECRAWL_API_KEY = "server-test-firecrawl-key";
});

afterEach(() => {
  if (originalTavilyKey === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = originalTavilyKey;
  if (originalFirecrawlKey === undefined) delete process.env.FIRECRAWL_API_KEY;
  else process.env.FIRECRAWL_API_KEY = originalFirecrawlKey;
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("searchWeb", () => {
  test("returns normalized structured search results", async () => {
    const mockFetch = async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.stringify(init?.body)).not.toContain("FIRECRAWL");
      return jsonResponse({ results: [{
        title: "Bun 2.0",
        url: "https://bun.sh/blog/bun-v2",
        content: "Release notes",
        published_date: "2026-09-01",
      }] });
    };
    const result = await searchWeb({ query: "latest Bun", limit: 5 }, undefined, { fetch: mockFetch });
    expect(result).toEqual({ success: true, results: [{
      title: "Bun 2.0",
      url: "https://bun.sh/blog/bun-v2",
      snippet: "Release notes",
      source: "bun.sh",
      publishedAt: "2026-09-01",
    }] });
  });

  test("handles empty results", async () => {
    const result = await searchWeb({ query: "nothing", limit: 5 }, undefined, {
      fetch: async () => jsonResponse({ results: [] }),
    });
    expect(result).toEqual({ success: true, results: [] });
  });

  test("returns structured provider failures", async () => {
    const result = await searchWeb({ query: "failure", limit: 5 }, undefined, {
      fetch: async () => jsonResponse({}, 500),
    });
    expect(result).toMatchObject({ success: false, code: "SEARCH_FAILED" });
  });

  test("returns a structured timeout", async () => {
    const result = await searchWeb({ query: "timeout", limit: 5 }, undefined, {
      timeoutMs: 5,
      fetch: async (_url, init) => {
        await new Promise<void>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        });
        throw new Error("unreachable");
      },
    });
    expect(result).toMatchObject({ success: false, code: "SEARCH_FAILED" });
    if (result.success) throw new Error("Expected search to fail");
    expect(result.error).toContain("timed out or was cancelled");
  });
});

describe("webpage tools", () => {
  const publicUrl = "https://93.184.216.34/article";
  const scraped = {
    success: true,
    data: {
      markdown: "# Article\n\nUseful first section.\n\nA needle appears in this section.",
      metadata: {
        title: "Article title",
        description: "Article description",
        publishedTime: "2026-08-10",
        sourceURL: publicUrl,
      },
    },
  };

  test("opens a page with cleaned content and metadata", async () => {
    const result = await openWebPage({ url: publicUrl }, undefined, {
      fetch: async () => jsonResponse(scraped),
    });
    expect(result).toMatchObject({
      success: true,
      title: "Article title",
      url: publicUrl,
      source: "93.184.216.34",
      content: scraped.data.markdown,
    });
  });

  test("extracts readable page content", async () => {
    const result = await extractWebContent({ url: publicUrl }, undefined, {
      fetch: async () => jsonResponse(scraped),
    });
    expect(result).toMatchObject({
      success: true,
      description: "Article description",
      publishedAt: "2026-08-10",
      content: scraped.data.markdown,
    });
  });

  test("rejects invalid and internal URLs", async () => {
    await expect(validateWebUrl("file:///etc/passwd")).rejects.toThrow("Only HTTP and HTTPS");
    await expect(validateWebUrl("http://127.0.0.1/admin")).rejects.toThrow("internal network");
    await expect(validateWebUrl("http://[::1]/admin")).rejects.toThrow("internal network");
    const result = await openWebPage({ url: "http://localhost/admin" });
    expect(result).toMatchObject({ success: false, code: "RETRIEVAL_FAILED" });
  });
});

test("findOnPage returns matching sections with context", () => {
  const result = findOnPage({
    content: "Introduction paragraph.\n\nThe release includes a new bundler and faster tests.\n\nClosing paragraph.",
    query: "bundler",
    limit: 5,
  });
  expect(result.matches).toEqual([{ section: 2, snippet: "The release includes a new bundler and faster tests." }]);
});

test("slash commands select their matching web tool", () => {
  expect(getSlashWebTool("/search latest Bun release")).toBe("searchWeb");
  expect(getSlashWebTool("/open https://bun.sh/blog")).toBe("openWebPage");
  expect(getSlashWebTool("/read https://bun.sh/blog")).toBe("extractWebContent");
  expect(getSlashWebTool("/find performance improvements")).toBe("findOnPage");
  expect(getSlashWebTool("/open")).toBeUndefined();
  expect(getSlashWebTool("Please open https://bun.sh/blog")).toBeUndefined();
});

test("web API keys are not referenced by CLI source", async () => {
  const cliFiles = [
    "../../../cli/src/hooks/use-chat.ts",
    "../../../cli/src/lib/local-tools.ts",
    "../../../cli/.env.example",
  ];
  const contents = await Promise.all(cliFiles.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  expect(contents.join("\n")).not.toContain("TAVILY_API_KEY");
  expect(contents.join("\n")).not.toContain("FIRECRAWL_API_KEY");
});
