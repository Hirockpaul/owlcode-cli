import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_RELEASE_BASE_URL =
  "https://owlcode-cli-releases-441870953577-ap-south-1-an.s3.ap-south-1.amazonaws.com";

export async function updateOwlCode(): Promise<number> {
  const releaseBaseUrl = (
    process.env.OWLCODE_RELEASE_BASE_URL ?? DEFAULT_RELEASE_BASE_URL
  ).replace(/\/$/, "");
  const installerUrl = `${releaseBaseUrl}/install.sh`;
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "owlcode-update-"));
  const installerPath = join(temporaryDirectory, "install.sh");

  try {
    console.log("Checking for the latest OwlCode release...");
    const response = await fetch(installerUrl, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(
        `Unable to download the updater (${response.status} ${response.statusText})`,
      );
    }

    await writeFile(installerPath, await response.bytes());
    await chmod(installerPath, 0o700);

    const updater = Bun.spawn(["bash", installerPath], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: process.env,
    });

    return await updater.exited;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
