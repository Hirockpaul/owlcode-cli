# S3 CLI release structure

OwlCode CLI releases are stored in the S3 bucket configured through the
`S3_BUCKET` GitHub variable, in the region configured by `AWS_REGION`.
The bucket name is not part of an object key.

`install.sh` downloads over HTTPS. Keep the bucket private and expose the
release objects through an appropriately secured HTTPS distribution, setting
`OWLCODE_RELEASE_BASE_URL` to its base URL. Direct S3 URLs only work when a
bucket policy intentionally permits downloads; the release IAM user's access
keys must never be distributed to installers.

## GitHub configuration

Configure these repository secrets before publishing:

```text
AWS_ACCESS_KEY_ID=<SET_IN_GITHUB_SECRETS>
AWS_SECRET_ACCESS_KEY=<SET_IN_GITHUB_SECRETS>
GPG_PRIVATE_KEY=<SET_IN_GITHUB_SECRETS>
```

Configure these repository variables:

```text
AWS_REGION=<AWS_REGION>
S3_BUCKET=<S3_BUCKET>
GPG_KEY_ID=<GPG_KEY_ID>
```

The access keys belong to a dedicated IAM user. Replace `<S3_BUCKET>` below
with the same bucket configured in the `S3_BUCKET` GitHub variable and attach
this policy to that user (not to a role):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListOwlCodeReleases",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<S3_BUCKET>",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["releases/*"]
        }
      }
    },
    {
      "Sid": "PublishOwlCodeReleases",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::<S3_BUCKET>/releases/*"
    }
  ]
}
```

The current workflow does not read uploaded objects, so the release IAM user
does not need `s3:GetObject`. Add that action, scoped to
`arn:aws:s3:::<S3_BUCKET>/releases/*`, only if a future workflow performs
post-upload reads. Do not attach `AdministratorAccess`. This workflow
intentionally does not use GitHub OIDC or an IAM role.

## Object keys

Each release uses the authoritative version from the repository root
`package.json` and the five platforms produced by
`scripts/build-release.sh`:

```text
releases/v<VERSION>/
├── owlcode_<VERSION>_linux_x64.tar.gz
├── owlcode_<VERSION>_linux_arm64.tar.gz
├── owlcode_<VERSION>_windows_x64.zip
├── owlcode_<VERSION>_macos_x64.tar.gz
├── owlcode_<VERSION>_macos_arm64.tar.gz
├── release-manifest.json
└── release-manifest.json.asc
```

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

The installer accepts an explicit version, so no mutable `latest/` objects are
required.

## Immutability and publication

Completed releases under `releases/v<VERSION>/` are write-once. The release
process uses the seven exact artifact names above to distinguish a complete
release from an interrupted upload:

1. An empty exact version prefix is uploaded normally.
2. A prefix containing all seven expected objects is complete, so publication
   fails without deleting or overwriting anything.
3. A prefix containing only a subset of the seven expected objects is an
   interrupted upload. Only those exact keys are deleted before retrying.
4. A prefix containing any unexpected key fails without deleting anything.
5. Never use S3 sync options that delete or replace versioned release objects.
6. Fix a completed release only by incrementing the root package version and
   publishing a new prefix.

`s3:DeleteObject` is needed only for interrupted-upload recovery and remains
restricted to `releases/*` by the IAM resource. The workflow further restricts
deletion to keys returned from the exact `releases/v<VERSION>/` prefix after
confirming that every returned key is an expected artifact.

Least-privilege CI permissions should enforce this workflow where practical.
S3 Object Lock would require an explicit bucket-level architecture decision;
until then, immutability is enforced by the publishing process and IAM policy.

The bucket remains private with Block Public Access enabled and ACLs disabled.
This design does not add a public bucket policy, upload objects, or create any
other AWS resource.
