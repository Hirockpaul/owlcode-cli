# OwlCode

## [Install OwlCode](https://owlcode-installation.vercel.app/)

Visit the installation website for setup instructions and downloads.

A powerful terminal-based AI coding assistant with support for multiple AI models and two distinct working modes: **Plan** (read-only analysis) and **Build** (full implementation with file editing and shell execution).

## Features

- **Dual-Mode Operation**
  - **PLAN Mode**: Read-only codebase analysis, architecture planning, and code review
  - **BUILD Mode**: Full implementation with file modifications, bash execution, and developer tools

- **Multi-Model Support**
  - Google AI (Gemini)
  - Groq AI
  - Extensible architecture for additional providers

- **Rich Terminal UI**
  - OpenTUI-based responsive interface
  - Session management and history
  - Command palette
  - Theme customization

- **Developer Tools**
  - File operations (read/write)
  - Directory traversal
  - Pattern-based search (glob)
  - Content search (grep)
  - Bash command execution

- **Enterprise Features**
  - Clerk OAuth authentication
  - Polar credit-based billing
  - Session persistence
  - Error tracking with Sentry

## Prerequisites

- **Bun** v1.2+ — JavaScript runtime and package manager
- **PostgreSQL** — Database backend
- **Clerk** account — Authentication provider
- **Polar** account — Billing and subscription management
- **API Keys** — Google and Groq AI provider keys

## Installation


1. **Install dependencies**
   ```bash
   bun install
   ```

2. **Initialize the database**
   ```bash
   bun run --cwd packages/database db:push
   bun run --cwd packages/database db:generate
   ```

## Environment Variables

Configuration is separated by runtime. Copy the relevant example files for local development:

```bash
cp packages/cli/.env.example packages/cli/.env
cp packages/server/.env.example packages/server/.env
```

The CLI file contains only public client configuration, including
`OWLCODE_API_URL`. The server file contains database, AI provider, Clerk,
Polar, and server runtime configuration. Never place server secrets in the CLI
environment.

On first start, an installed CLI fetches public production settings from the
release bucket and caches them in `~/.owlcode/config.json`. This includes the
API URL and Clerk OAuth client settings; users do not need a local `.env`.
The access token created by `/login` is stored separately in
`~/.owlcode/auth.json` with owner-only permissions.

For development, self-hosting, or an override, set `OWLCODE_API_URL`,
`CLERK_FRONTEND_API`, `CLERK_OAUTH_CLIENT_ID`, and optionally
`OWLCODE_CONFIG_URL`; or create `~/.owlcode/config.json`:

```json
{
  "apiUrl": "https://api.yourdomain.com",
  "clerk": {
    "frontendApi": "https://your-instance.clerk.accounts.dev",
    "oauthClientId": "your-public-oauth-client-id"
  }
}
```

Never add `CLERK_SECRET_KEY` to this file or any CLI configuration. It belongs
only on the OwlCode server.

Before publishing a release, set these public GitHub Actions variables:
`OWLCODE_PUBLIC_API_URL`, `CLERK_FRONTEND_API`, and
`CLERK_OAUTH_CLIENT_ID`. Set the same values as environment variables on the
API deployment to serve `/.well-known/owlcode.json` for self-hosted clients.

## Development

### Start the API Server

```bash
bun run dev:server
```

### Start the CLI

```bash
bun run dev:cli
```

### Start CLI with Hot-Reload

```bash
bun run dev
```

## Project Structure

```
owlcode/
├── packages/
│   ├── cli/              # Terminal UI (React + OpenTUI)
│   ├── server/           # Backend API (Hono)
│   ├── database/         # Database & ORM (Prisma)
│   └── shared/           # Shared types & utilities
├── Dockerfile            # Production container
├── package.json          # Root workspace config
└── tsconfig.base.json    # Shared TypeScript config
```

## Authentication

OwlCode uses **Clerk OAuth** for authentication. To set up:

1. Create a Clerk account at [clerk.com](https://clerk.com)
2. Add this redirect URI to your Clerk dashboard:
   ```
   http://localhost:3000/auth/callback
   ```
3. Add the public Clerk frontend API and OAuth client ID to `packages/cli/.env`,
   and add the Clerk server keys to `packages/server/.env`.

## Billing

OwlCode meters AI usage with **Polar credits**. Each API call consumes credits from the user's account.
New Clerk users receive a one-time 100-credit ($1) signup bonus through the
verified `/webhooks/clerk` endpoint. Configure a `user.created` Clerk webhook
to `https://your-api-domain/webhooks/clerk` and set its signing secret as
`CLERK_WEBHOOK_SIGNING_SECRET` on the API server.

### Configure Your Polar Meter

| Setting | Value |
|---------|-------|
| Meter Name | `owlcode_credits` |
| Event Name | `owlcode-usage` |
| Aggregation | Sum |
| Metadata Key | `credits` |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start CLI with hot-reload |
| `bun run dev:cli` | Start CLI development server |
| `bun run dev:server` | Start API server with hot-reload |
| `bun run build:cli` | Build the CLI executable |
| `bun run link:cli` | Build and link CLI executable |
| `bun run --cwd packages/database db:push` | Sync Prisma schema to the database |
| `bun run --cwd packages/database db:generate` | Generate Prisma client |

## Building for Production

### Build the CLI

```bash
bun run build:cli
```

### Build the Server

```bash
cd packages/server && bun run build
```

## Deployment

The project includes a Dockerfile optimized for production deployment:

```bash
docker build -t owlcode:latest .
docker run -e DATABASE_URL=<url> -e CLERK_SECRET_KEY=<key> ... -p 3000:3000 owlcode:latest
```

**Required environment variables at runtime:**
- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_FRONTEND_API` (public; used in the CLI bootstrap document)
- `CLERK_OAUTH_CLIENT_ID` (public; used in the CLI bootstrap document)
- `CLERK_WEBHOOK_SIGNING_SECRET`
- `OWLCODE_PUBLIC_API_URL` (the public HTTPS URL of this API)
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `GROQ_API_KEY`
- `POLAR_ACCESS_TOKEN`
- `PORT`

## Technology Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Frontend**: React 19, OpenTUI
- **Backend**: Hono
- **Database**: Prisma + PostgreSQL
- **AI SDK**: Vercel AI
- **Auth**: Clerk
- **Billing**: Polar
- **Monitoring**: Sentry
