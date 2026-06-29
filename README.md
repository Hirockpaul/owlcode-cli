# OwlCode

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
   bun run --cwd packages/database db:generate
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server
API_URL=http://localhost:3000
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/owlcode

# Authentication
JWT_SECRET=your_jwt_secret_key
CLERK_FRONTEND_API=your_clerk_frontend_api
CLERK_OAUTH_CLIENT_ID=your_client_id
CLERK_OAUTH_CLIENT_SECRET=your_client_secret
CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# AI Providers
GOOGLE_API_KEY=your_google_api_key
GROQ_API_KEY=your_groq_api_key

# Billing
POLAR_ACCESS_TOKEN=your_polar_token
POLAR_PRODUCT_ID=your_product_id
POLAR_SERVER=sandbox
POLAR_CREDITS_METER_ID=owlcode_credits
```

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
3. Copy your API keys to the `.env` file

## Billing

OwlCode meters AI usage with **Polar credits**. Each API call consumes credits from the user's account.

### Configure Your Polar Meter

| Setting | Value |
|---------|-------|
| Meter Name | `owlcode_credits` |
| Event Name | `owlcode_usage` |
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
- `GOOGLE_API_KEY`
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


