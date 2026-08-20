#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, readFile, rename, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = dirname(scriptDirectory);
const distributionDirectory = join(repositoryRoot, "dist");
const packagePath = join(repositoryRoot, "package.json");
const outputPath = join(distributionDirectory, "release-manifest.json");
const temporaryOutputPath = `${outputPath}.tmp`;

const packageMetadata = JSON.parse(await readFile(packagePath, "utf8"));
const version = packageMetadata.version;

if (typeof version !== "string" || !/^[0-9A-Za-z][0-9A-Za-z.-]*$/.test(version)) {
  throw new Error(`Invalid release version in ${packagePath}`);
}

const artifacts = [
  {
    platform: "windows-x64",
    filename: `owlcode_${version}_windows_x64.zip`,
  },
  {
    platform: "linux-x64",
    filename: `owlcode_${version}_linux_x64.tar.gz`,
  },
  {
    platform: "linux-arm64",
    filename: `owlcode_${version}_linux_arm64.tar.gz`,
  },
  {
    platform: "macos-x64",
    filename: `owlcode_${version}_macos_x64.tar.gz`,
  },
  {
    platform: "macos-arm64",
    filename: `owlcode_${version}_macos_arm64.tar.gz`,
  },
];

async function sha256(filePath) {
  const hash = createHash("sha256");

  await new Promise((resolve, reject) => {
    const input = createReadStream(filePath);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("error", reject);
    input.on("end", resolve);
  });

  return hash.digest("hex");
}

const platforms = {};

for (const artifact of artifacts) {
  const artifactPath = join(distributionDirectory, artifact.filename);
  let fileStats;

  try {
    fileStats = await lstat(artifactPath);
    await access(artifactPath, constants.R_OK);
  } catch (error) {
    throw new Error(`Missing or unreadable release artifact: ${artifactPath}`, {
      cause: error,
    });
  }

  if (!fileStats.isFile()) {
    throw new Error(`Release artifact is not a regular file: ${artifactPath}`);
  }

  if (fileStats.size === 0) {
    throw new Error(`Release artifact is empty: ${artifactPath}`);
  }

  platforms[artifact.platform] = {
    file: artifact.filename,
    size: fileStats.size,
    sha256: await sha256(artifactPath),
  };
}

const manifest = {
  name: String(packageMetadata.name).toLowerCase(),
  version,
  platforms,
};
const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;

await writeFile(temporaryOutputPath, serializedManifest, "utf8");
await rename(temporaryOutputPath, outputPath);

const generatedManifest = JSON.parse(await readFile(outputPath, "utf8"));
if (generatedManifest.version !== version) {
  throw new Error("Generated manifest version does not match package.json");
}

for (const artifact of artifacts) {
  const manifestArtifact = generatedManifest.platforms[artifact.platform];
  const artifactPath = join(distributionDirectory, artifact.filename);
  if (
    manifestArtifact?.file !== artifact.filename ||
    manifestArtifact.sha256 !== (await sha256(artifactPath))
  ) {
    throw new Error(`Generated manifest validation failed for ${artifact.platform}`);
  }
}

console.log(`Generated ${outputPath}`);
