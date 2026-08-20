#!/usr/bin/env bash

set -euo pipefail

die() { echo "Error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }

need curl
need gpg
need python3

version="${1:-${OWLCODE_VERSION:-}}"
[[ -n "$version" ]] || die "provide a version (for example: ./install.sh 1.0.0)"
version="${version#v}"
[[ "$version" =~ ^[0-9A-Za-z][0-9A-Za-z.-]*$ ]] || die "invalid version: $version"

if [[ -n "${OWLCODE_RELEASE_BASE_URL:-}" ]]; then
  base_url="${OWLCODE_RELEASE_BASE_URL%/}"
else
  [[ -n "${S3_BUCKET:-}" && -n "${AWS_REGION:-}" ]] || \
    die "set OWLCODE_RELEASE_BASE_URL, or both S3_BUCKET and AWS_REGION"
  base_url="https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com"
fi

case "$(uname -s)" in
  Linux) os="linux" ;;
  Darwin) os="macos" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows" ;;
  *) die "unsupported operating system: $(uname -s)" ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *) die "unsupported architecture: $(uname -m)" ;;
esac
[[ "${os}-${arch}" != "windows-arm64" ]] || die "Windows ARM64 is not currently supported"

key_id="${GPG_KEY_ID:-}"
[[ -n "$key_id" ]] || die "set GPG_KEY_ID to the trusted OwlCode signing-key fingerprint"
key_id="$(printf '%s' "$key_id" | tr '[:lower:]' '[:upper:]')"
if [[ -n "${OWLCODE_GPG_PUBLIC_KEY:-}" ]]; then
  [[ -f "$OWLCODE_GPG_PUBLIC_KEY" ]] || die "public key file not found: $OWLCODE_GPG_PUBLIC_KEY"
  gpg --batch --import "$OWLCODE_GPG_PUBLIC_KEY" >/dev/null 2>&1
fi
gpg --batch --list-keys "$key_id" >/dev/null 2>&1 || \
  die "trusted signing key is not imported; set OWLCODE_GPG_PUBLIC_KEY"

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT
release_url="${base_url}/releases/v${version}"
curl --fail --silent --show-error --location \
  --output "$tmp_dir/release-manifest.json" "${release_url}/release-manifest.json"
curl --fail --silent --show-error --location \
  --output "$tmp_dir/release-manifest.json.asc" "${release_url}/release-manifest.json.asc"
valid_fingerprint="$(gpg --batch --status-fd 1 --verify "$tmp_dir/release-manifest.json.asc" \
  "$tmp_dir/release-manifest.json" 2>/dev/null | \
  awk '$2 == "VALIDSIG" { print $3; print $12; exit }')"
case "$valid_fingerprint" in
  *"${key_id}"*) ;;
  *) die "manifest signature is not from GPG_KEY_ID" ;;
esac

platform="${os}-${arch}"
artifact_data="$(python3 - "$tmp_dir/release-manifest.json" "$platform" "$version" <<'PY'
import json, re, sys
with open(sys.argv[1], encoding="utf-8") as source:
    manifest = json.load(source)
if manifest.get("version") != sys.argv[3]:
    raise SystemExit("manifest version does not match requested version")
item = manifest.get("platforms", {}).get(sys.argv[2])
if not item or not re.fullmatch(r"owlcode_[0-9A-Za-z.-]+_(linux|macos|windows)_(x64|arm64)\.(tar\.gz|zip)", item.get("file", "")):
    raise SystemExit("manifest has no valid artifact for this platform")
if not re.fullmatch(r"[0-9a-f]{64}", item.get("sha256", "")):
    raise SystemExit("manifest contains an invalid SHA-256 digest")
print(item["file"])
print(item["sha256"])
PY
)"
filename="${artifact_data%%$'\n'*}"
expected_sha="${artifact_data#*$'\n'}"
curl --fail --silent --show-error --location --output "$tmp_dir/$filename" \
  "${release_url}/${filename}"
actual_sha="$(python3 - "$tmp_dir/$filename" <<'PY'
import hashlib, sys
digest = hashlib.sha256()
with open(sys.argv[1], "rb") as source:
    for chunk in iter(lambda: source.read(1024 * 1024), b""):
        digest.update(chunk)
print(digest.hexdigest())
PY
)"
[[ "$actual_sha" == "$expected_sha" ]] || die "artifact checksum verification failed"

install_dir="${OWLCODE_INSTALL_DIR:-${HOME}/.local/bin}"
mkdir -p -- "$install_dir"
if [[ "$os" == "windows" ]]; then
  need unzip
  unzip -q "$tmp_dir/$filename" -d "$tmp_dir/extracted"
  install -m 755 "$tmp_dir/extracted/owlcode.exe" "$install_dir/owlcode.exe"
  installed="$install_dir/owlcode.exe"
else
  need tar
  mkdir -p "$tmp_dir/extracted"
  tar -xzf "$tmp_dir/$filename" -C "$tmp_dir/extracted"
  install -m 755 "$tmp_dir/extracted/owlcode" "$install_dir/owlcode"
  installed="$install_dir/owlcode"
fi

actual_version="$("$installed" --version)"
[[ "$actual_version" == "OwlCode v${version}" ]] || die "installed CLI version check failed"
echo "Installed ${actual_version} at ${installed}"
