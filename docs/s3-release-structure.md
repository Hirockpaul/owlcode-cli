# OwlCode CLI release and installation architecture

OwlCode publishes signed CLI archives to the private S3 bucket
`owlcode-cli-releases-441870953577-ap-south-1-an` in `ap-south-1`. Block Public
Access remains enabled. Users never receive AWS credentials and do not download
directly from a public bucket.

## Release objects

```text
owlcode-cli-releases-441870953577-ap-south-1-an/
├── install.sh
├── owlcode-signing-key.asc
├── version.txt
└── releases/v<VERSION>/
    ├── owlcode_<VERSION>_linux_x64.tar.gz
    ├── owlcode_<VERSION>_linux_arm64.tar.gz
    ├── owlcode_<VERSION>_windows_x64.zip
    ├── owlcode_<VERSION>_macos_x64.tar.gz
    ├── owlcode_<VERSION>_macos_arm64.tar.gz
    ├── release-manifest.json
    └── release-manifest.json.asc
```

`release-manifest.json` records the version plus the filename, byte size, and
SHA-256 digest of each of the five archives. Its detached `.asc` signature is
created by the configured private GPG key. Only the public key is distributed.

## Publishing

The release workflow runs for `v*` tags and verifies that the tag exactly
matches root `package.json` (`v1.0.2` ↔ `1.0.2`). It builds all targets,
generates and signs the manifest, then publishes to `releases/v<VERSION>/`.

Normal releases are immutable: if any object exists in that prefix, publishing
fails. A manual workflow dispatch may replace only that prefix after both
`force: true` and exact `confirm_release_tag` confirmation. Do not remove this
guard. Only after the immutable upload is verified does the workflow update the
three root objects. Those root objects are the current distribution files:
the source-controlled installer, the public signing key, and the unprefixed
release version (for example, `1.0.2`, never `v1.0.2`).

GitHub Actions authenticates with the `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` repository secrets for account `441870953577`. The
workflow uses `ap-south-1` and requires only `contents: read`; do not expose
these secrets in logs, the installer, or committed files.

The IAM identity associated with those secrets should be limited to
`s3:ListBucket`, `s3:GetObject`, and
`s3:PutObject` for the bucket/release prefix. `s3:DeleteObject` is permitted
only for the explicit force-release path. Do not grant `s3:*` or `Resource: *`.

That IAM identity also needs `s3:PutObject` for the three root distribution
objects (`install.sh`, `owlcode-signing-key.asc`, and `version.txt`). The
server runtime role needs only `s3:GetObject` for those objects and
`releases/*` in order to presign downloads.

## Download API

The deployed OwlCode server has these public routes:

```text
GET /downloads/owlcode-signing-key.asc
GET /downloads/releases/:version/release-manifest.json
GET /downloads/releases/:version/release-manifest.json.asc
GET /downloads/releases/:version/:filename
```

The server normalizes `v1.0.2` to `1.0.2`, accepts only strict SemVer releases,
and accepts only the two metadata files or one of the five generated archive
names for that version. It constructs the S3 key internally, generates a
five-minute `GetObject` presigned URL, and returns a `307` redirect. The API
never proxies archive bytes and has no arbitrary-S3-key endpoint.

Server configuration:

```text
AWS_REGION=ap-south-1
S3_BUCKET=owlcode-cli-releases-441870953577-ap-south-1-an
```

The deployed server must receive AWS credentials through its IAM role or other
server-side temporary credential mechanism. Never configure these credentials
in the CLI, installer, release manifest, or public repository.

## Installer

The Linux/macOS shell installer downloads through the API, verifies the public
key's full 40-character fingerprint in an isolated `GNUPGHOME`, verifies the
detached manifest signature, validates artifact name/size/SHA-256, validates
the archive contains only the expected executable, verifies `owlcode
--version`, and atomically installs it.

```bash
DOWNLOAD_BASE="https://<deployed-owlcode-api>/downloads" \
OWLCODE_GPG_KEY_FINGERPRINT="<actual-40-character-fingerprint>" \
./install.sh 1.0.2
```

`DOWNLOAD_BASE` is the only distribution URL required by the installer. The
installed CLI uses `OWLCODE_API_URL` for normal runtime API calls. S3 is only
release storage; the runtime CLI does not use it.

The public signing-key fingerprint must be copied from the actual configured
release key before publishing. Do not substitute a short key ID or an invented
fingerprint. Windows releases remain available, but Windows installation needs
a separate PowerShell installer; do not run this Bash installer in PowerShell.
