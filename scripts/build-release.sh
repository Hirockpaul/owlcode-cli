#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENTRYPOINT="${REPO_ROOT}/packages/cli/src/index.tsx"
DIST_DIR="${REPO_ROOT}/dist"

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: Bun is required to build OwlCode releases." >&2
  exit 1
fi

if [[ ! -f "${ENTRYPOINT}" ]]; then
  echo "Error: CLI entrypoint not found: ${ENTRYPOINT}" >&2
  exit 1
fi

if [[ ! -d "${REPO_ROOT}/node_modules" ]]; then
  echo "Error: dependencies are not installed." >&2
  echo "Run: bun install --frozen-lockfile --os='*' --cpu='*'" >&2
  exit 1
fi

required_native_packages=(
  "@opentui/core-linux-x64"
  "@opentui/core-win32-x64"
  "@opentui/core-darwin-arm64"
)

for package_name in "${required_native_packages[@]}"; do
  isolated_name="${package_name/\//+}"
  if [[ ! -f "${REPO_ROOT}/node_modules/${package_name}/package.json" ]] \
    && ! compgen -G "${REPO_ROOT}/node_modules/.bun/${isolated_name}@*/node_modules/${package_name}/package.json" >/dev/null; then
    echo "Error: required OpenTUI native package is not installed: ${package_name}" >&2
    echo "Run: bun install --frozen-lockfile --os='*' --cpu='*'" >&2
    exit 1
  fi
done

if [[ "${DIST_DIR}" != "${REPO_ROOT}/dist" || "${DIST_DIR}" == "/" ]]; then
  echo "Error: refusing to clean unexpected output directory: ${DIST_DIR}" >&2
  exit 1
fi

echo "Building OwlCode CLI releases with Bun $(bun --version)..."

rm -rf -- "${DIST_DIR}"
mkdir -p -- "${DIST_DIR}"

labels=(
  "Linux x64"
  "Windows x64"
  "macOS ARM64"
)

targets=(
  "bun-linux-x64"
  "bun-windows-x64"
  "bun-darwin-arm64"
)

outputs=(
  "owlcode_linux_x64"
  "owlcode_windows_x64.exe"
  "owlcode_macos_arm64"
)

# Planned after the initial release is stable:
#   bun-linux-arm64  -> owlcode_linux_arm64
#   bun-darwin-x64   -> owlcode_macos_x64

for index in "${!targets[@]}"; do
  label="${labels[$index]}"
  target="${targets[$index]}"
  output="${DIST_DIR}/${outputs[$index]}"

  echo "Building ${label}..."
  bun build "${ENTRYPOINT}" \
    --compile \
    --target="${target}" \
    --no-compile-autoload-dotenv \
    --outfile="${output}"

  if [[ ! -s "${output}" ]]; then
    echo "Error: expected release artifact was not created: ${output}" >&2
    exit 1
  fi

  if [[ "${target}" != "bun-windows-x64" ]]; then
    chmod +x -- "${output}"
  fi

  echo "✓ ${label}"
done

echo "Release build completed."
echo "Artifacts:"
for output in "${outputs[@]}"; do
  echo "  dist/${output}"
done
