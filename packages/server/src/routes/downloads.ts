import { Hono } from "hono";
import {
  createReleaseDownloadUrl,
  createSigningKeyDownloadUrl,
  isAllowedReleaseFilename,
  normalizeReleaseVersion,
} from "../lib/release-downloads";

const app = new Hono()
  .get("/owlcode-signing-key.asc", async (c) => c.redirect(await createSigningKeyDownloadUrl(), 307))
  .get("/releases/:version/:filename", async (c) => {
    const version = normalizeReleaseVersion(c.req.param("version"));
    const filename = c.req.param("filename");

    if (!version || !isAllowedReleaseFilename(version, filename)) {
      return c.json({ error: "Release file not found" }, 404);
    }

    return c.redirect(await createReleaseDownloadUrl(version, filename), 307);
  });

export default app;
