#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENTRYPOINT="${REPO_ROOT}/packages/cli/src/index.tsx"
DIST_DIR="${REPO_ROOT}/dist"
VERSION="$(cd -- "${REPO_ROOT}" && bun -p 'require("./package.json").version')"

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
  "@opentui/core-linux-arm64"
  "@opentui/core-win32-x64"
  "@opentui/core-darwin-x64"
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

worker_dist="${DIST_DIR}/worker"
mkdir -p -- "${worker_dist}"
bun build "${REPO_ROOT}/packages/cli/node_modules/@opentui/core/parser.worker.js" \
  --target=node \
  --outdir="${worker_dist}" \
  --entry-naming=owlcode-parser.worker.js \
  --asset-naming=tree-sitter.wasm

for runtime_file in owlcode-parser.worker.js tree-sitter.wasm; do
  if [[ ! -s "${worker_dist}/${runtime_file}" ]]; then
    echo "Error: expected syntax-highlighting runtime was not created: ${runtime_file}" >&2
    exit 1
  fi
done

labels=(
  "Linux x64"
  "Linux ARM64"
  "Windows x64"
  "macOS x64"
  "macOS ARM64"
)

targets=(
  "bun-linux-x64"
  "bun-linux-arm64"
  "bun-windows-x64"
  "bun-darwin-x64"
  "bun-darwin-arm64"
)

outputs=(
  "owlcode"
  "owlcode"
  "owlcode.exe"
  "owlcode"
  "owlcode"
)

archives=(
  "owlcode_${VERSION}_linux_x64.tar.gz"
  "owlcode_${VERSION}_linux_arm64.tar.gz"
  "owlcode_${VERSION}_windows_x64.zip"
  "owlcode_${VERSION}_macos_x64.tar.gz"
  "owlcode_${VERSION}_macos_arm64.tar.gz"
)

for index in "${!targets[@]}"; do
  label="${labels[$index]}"
  target="${targets[$index]}"
  staging_dir="${DIST_DIR}/staging/${target}"
  output="${staging_dir}/${outputs[$index]}"

  echo "Building ${label}..."
  mkdir -p -- "${staging_dir}"
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

  cp -- "${worker_dist}/owlcode-parser.worker.js" "${staging_dir}/owlcode-parser.worker.js"
  cp -- "${worker_dist}/tree-sitter.wasm" "${staging_dir}/tree-sitter.wasm"

  echo "✓ ${label}"
done

host_arch="$(uname -m)"
case "${host_arch}" in
  x86_64|amd64) host_binary="${DIST_DIR}/staging/bun-linux-x64/owlcode" ;;
  aarch64|arm64) host_binary="${DIST_DIR}/staging/bun-linux-arm64/owlcode" ;;
  *) host_binary="" ;;
esac

if [[ -n "${host_binary}" && "$(uname -s)" == "Linux" ]]; then
  version_output="$("${host_binary}" --version)"
  if [[ "${version_output}" != "OwlCode v${VERSION}" ]]; then
    echo "Error: --version returned '${version_output}', expected 'OwlCode v${VERSION}'" >&2
    exit 1
  fi
  "${host_binary}" --check-syntax-highlighting
  echo "Verified host CLI: ${version_output}"
else
  echo "Error: release verification requires a Linux x64 or ARM64 runner." >&2
  exit 1
fi

echo "Packaging release archives..."
tar -czf "${DIST_DIR}/${archives[0]}" -C "${DIST_DIR}/staging/${targets[0]}" "${outputs[0]}" owlcode-parser.worker.js tree-sitter.wasm
tar -czf "${DIST_DIR}/${archives[1]}" -C "${DIST_DIR}/staging/${targets[1]}" "${outputs[1]}" owlcode-parser.worker.js tree-sitter.wasm
(
  cd -- "${DIST_DIR}/staging/${targets[2]}"
  zip -q "${DIST_DIR}/${archives[2]}" "${outputs[2]}" owlcode-parser.worker.js tree-sitter.wasm
)
tar -czf "${DIST_DIR}/${archives[3]}" -C "${DIST_DIR}/staging/${targets[3]}" "${outputs[3]}" owlcode-parser.worker.js tree-sitter.wasm
tar -czf "${DIST_DIR}/${archives[4]}" -C "${DIST_DIR}/staging/${targets[4]}" "${outputs[4]}" owlcode-parser.worker.js tree-sitter.wasm

for archive in "${archives[@]}"; do
  if [[ ! -s "${DIST_DIR}/${archive}" ]]; then
    echo "Error: expected release archive was not created: ${DIST_DIR}/${archive}" >&2
    exit 1
  fi
done

echo "Release build completed."
echo "Artifacts:"
for archive in "${archives[@]}"; do
  echo "  dist/${archive}"
done
