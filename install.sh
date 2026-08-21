#!/usr/bin/env bash

set -euo pipefail

die() { echo "Error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }

need curl
need gpg
need python3

# Environment overrides are available for release testing, but public S3 is the
# normal distribution endpoint.
DOWNLOAD_BASE="${DOWNLOAD_BASE:-${OWLCODE_RELEASE_BASE_URL:-https://owlcode-cli-releases-441870953577-ap-south-1-an.s3.ap-south-1.amazonaws.com}}"
DOWNLOAD_BASE="${DOWNLOAD_BASE%/}"

key_fingerprint="${OWLCODE_GPG_KEY_FINGERPRINT:-1833A297413FE85ED9962B5BCF5D81AA2CF696BB}"
[[ "$key_fingerprint" =~ ^[0-9A-Fa-f]{40}$ ]] || die "OWLCODE_GPG_KEY_FINGERPRINT must be a trusted 40-character signing-key fingerprint"
key_fingerprint="${key_fingerprint^^}"

version="${1:-${OWLCODE_VERSION:-}}"
if [[ -z "$version" ]]; then
  version="$(curl --fail --silent --show-error --location "$DOWNLOAD_BASE/version.txt")"
fi
version="${version#v}"
[[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-([0-9A-Za-z-]+)(\.[0-9A-Za-z-]+)*)?$ ]] || die "invalid release version: $version"

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

tmp_dir="$(mktemp -d)"
gnupg_home="$tmp_dir/gnupg"
trap 'rm -rf -- "$tmp_dir"' EXIT
mkdir -m 700 "$gnupg_home"
export GNUPGHOME="$gnupg_home"

curl --fail --silent --show-error --location --output "$tmp_dir/owlcode-signing-key.asc" "$DOWNLOAD_BASE/owlcode-signing-key.asc"
gpg --batch --import "$tmp_dir/owlcode-signing-key.asc" >/dev/null 2>&1
imported_fingerprint="$(gpg --batch --with-colons --list-keys | awk -F: '$1 == "fpr" { print toupper($10); exit }')"
[[ "$imported_fingerprint" == "$key_fingerprint" ]] || die "downloaded signing key fingerprint does not match OWLCODE_GPG_KEY_FINGERPRINT"

release_url="$DOWNLOAD_BASE/releases/v${version}"
curl --fail --silent --show-error --location --output "$tmp_dir/release-manifest.json" "$release_url/release-manifest.json"
curl --fail --silent --show-error --location --output "$tmp_dir/release-manifest.json.asc" "$release_url/release-manifest.json.asc"
valid_fingerprint="$(gpg --batch --status-fd 1 --verify "$tmp_dir/release-manifest.json.asc" "$tmp_dir/release-manifest.json" 2>/dev/null | awk '$2 == "VALIDSIG" { print toupper($3); exit }')"
[[ "$valid_fingerprint" == "$key_fingerprint" ]] || die "manifest signature is not from the trusted OwlCode signing key"

platform="${os}-${arch}"
artifact_data="$(python3 - "$tmp_dir/release-manifest.json" "$platform" "$version" <<'PY'
import json, re, sys
with open(sys.argv[1], encoding="utf-8") as source:
    manifest = json.load(source)
if manifest.get("name") != "owlcode" or manifest.get("version") != sys.argv[3]:
    raise SystemExit("manifest does not match the requested OwlCode release")
item = manifest.get("platforms", {}).get(sys.argv[2])
pattern = r"owlcode_" + re.escape(sys.argv[3]) + r"_(linux|macos|windows)_(x64|arm64)\.(tar\.gz|zip)"
if not isinstance(item, dict) or not re.fullmatch(pattern, item.get("file", "")):
    raise SystemExit("manifest has no valid artifact for this platform")
if not re.fullmatch(r"[0-9a-f]{64}", item.get("sha256", "")):
    raise SystemExit("manifest contains an invalid SHA-256 digest")
if not isinstance(item.get("size"), int) or item["size"] <= 0:
    raise SystemExit("manifest contains an invalid artifact size")
print(item["file"])
print(item["sha256"])
print(item["size"])
PY
)"
filename="${artifact_data%%$'\n'*}"
artifact_data="${artifact_data#*$'\n'}"
expected_sha="${artifact_data%%$'\n'*}"
expected_size="${artifact_data#*$'\n'}"

curl --fail --silent --show-error --location --output "$tmp_dir/$filename" "$release_url/$filename"
actual_size="$(wc -c < "$tmp_dir/$filename" | tr -d '[:space:]')"
[[ "$actual_size" == "$expected_size" ]] || die "artifact size verification failed"
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

mkdir "$tmp_dir/extracted"
if [[ "$os" == "windows" ]]; then
  need unzip
  [[ "$(unzip -Z1 "$tmp_dir/$filename" | wc -l | tr -d '[:space:]')" == "1" ]] && unzip -Z1 "$tmp_dir/$filename" | grep -Fxq "owlcode.exe" || die "archive must contain only owlcode.exe"
  unzip -q "$tmp_dir/$filename" -d "$tmp_dir/extracted"
  binary="$tmp_dir/extracted/owlcode.exe"
  target_name="owlcode.exe"
else
  need tar
  [[ "$(tar -tzf "$tmp_dir/$filename" | wc -l | tr -d '[:space:]')" == "1" ]] && tar -tzf "$tmp_dir/$filename" | grep -Fxq "owlcode" || die "archive must contain only owlcode"
  tar -xzf "$tmp_dir/$filename" -C "$tmp_dir/extracted"
  binary="$tmp_dir/extracted/owlcode"
  target_name="owlcode"
fi
[[ -f "$binary" && ! -L "$binary" ]] || die "archive executable is not a regular file"
chmod 755 "$binary"
actual_version="$("$binary" --version)"
[[ "$actual_version" == "OwlCode v${version}" ]] || die "release binary version check failed"

install_dir="${OWLCODE_INSTALL_DIR:-${HOME}/.local/bin}"
mkdir -p -- "$install_dir"
target="$install_dir/$target_name"
temporary_target="$install_dir/.${target_name}.new.$$"
install -m 755 "$binary" "$temporary_target"
[[ ! -e "$target" ]] || mv -f -- "$target" "$target.previous"
mv -f -- "$temporary_target" "$target"
echo "Installed ${actual_version} at ${target}"
