# S3 CLI release structure

OwlCode CLI releases are stored in the private S3 bucket
`owlcode-cli-releases-441870955377-ap-south-1-an` in `ap-south-1`.
The bucket name is not part of an object key.

## Object keys

The initial release uses the authoritative version from the repository root
`package.json` (`1.0.0`) and the three platforms currently produced by
`scripts/build-release.sh`:

```text
releases/v1.0.0/
├── owlcode_1.0.0_linux_x64.tar.gz
├── owlcode_1.0.0_windows_x64.zip
├── owlcode_1.0.0_macos_arm64.tar.gz
├── release-manifest.json
└── release-manifest.json.asc

latest/
├── release-manifest.json
└── release-manifest.json.asc
```

Linux ARM64 and macOS x64 keys must not be published until those executables
are built and validated. S3 prefixes do not need placeholder objects, so this
step creates no empty directory objects.

For every future version `<VERSION>`, artifacts use these rules:

```text
Prefix:  releases/v<VERSION>/
Windows: owlcode_<VERSION>_<platform>_<arch>.zip
Unix:    owlcode_<VERSION>_<platform>_<arch>.tar.gz
```

The archive contains only the executable and any runtime files it actually
requires. It must not contain source files, `.env` files, credentials, private
keys, or signing keys.

## Manifest and signature

Each immutable version prefix contains `release-manifest.json`, with the
version and the filename, byte size, and SHA-256 digest calculated from every
artifact actually published. Checksums and sizes must be generated from the
final archives; placeholder values are forbidden.

`release-manifest.json.asc` is a detached signature of that exact manifest.
Signing infrastructure and trusted public-key distribution must be established
before the first upload. The private signing key must never enter S3, Git, the
CLI executable, a Docker image, or CI logs.

After a complete versioned release has been uploaded and validated, the signed
manifest and its signature may be copied to `latest/`. These two `latest/`
objects are mutable pointers to the newest release; binaries are never stored
under `latest/`.

## Immutability and publication

Objects under `releases/v<VERSION>/` are write-once by release process:

1. Fail publication if the version prefix already contains any object.
2. Upload final archives, manifest, and signature without overwriting keys.
3. Verify uploaded sizes and checksums before updating `latest/`.
4. Never use S3 sync options that delete or replace versioned release objects.
5. Fix a published release only by incrementing the root package version and
   publishing a new prefix.

Least-privilege CI permissions should enforce this workflow where practical.
S3 Object Lock would require an explicit bucket-level architecture decision;
until then, immutability is enforced by the publishing process and IAM policy.

The bucket remains private with Block Public Access enabled and ACLs disabled.
This design does not add a public bucket policy, upload objects, or create any
other AWS resource.
