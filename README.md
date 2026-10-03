# Consult appointment assessment

Author: Mustehsan Ali

An authenticated appointment-booking prototype with a persisted, multi-turn AI assistant and an always-available manual booking path. The browser talks to Next.js at one origin; Next.js rewrites `/api/*` to Express. Express owns identity, policy, persistence, chat coordination, and Groq access.

Project guides live locally (gitignored) under `.local/docs/` — especially `COMPLETE-GUIDE.md` and `project-guide.md`.

## Run locally

Prerequisites: Node 24+, pnpm 10+, and a Supabase PostgreSQL project.

```bash
corepack enable
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm install
pnpm --filter @appointment/api prisma generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`.

| Role          | Email               | Password           | Landing page |
| ------------- | ------------------- | ------------------ | ------------ |
| User          | `demo@example.com`  | `DemoPassword123!` | `/dashboard` |
| Administrator | `admin@example.com` | `DemoPassword123!` | `/admin`     |

Roles are stored in PostgreSQL and enforced by Express middleware. Hiding an admin link in the frontend is only a UX feature; the admin API independently returns `403` to ordinary users.

`GROQ_API_KEY` is optional. Without it, chat is visibly in safe manual-fallback mode; booking still works. Set a server-only key and a model with JSON output support to enable extraction. Never expose the database URL or Groq key to Next.js browser code.

For Supabase, set `DATABASE_URL` to the transaction-pooler URL on port 6543 and `DIRECT_URL` to the direct/session URL on port 5432. Both URLs use `schema=assessment` so this project remains isolated from other applications in the same database. URL-encode special characters in the database password. Prisma Client uses the pooled URL at runtime; Prisma migration commands use `DIRECT_URL`. The multi-file Prisma schema is organized under `apps/api/prisma/models/`, while `schema.prisma` only defines the generator and datasource.

## Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @appointment/api prisma migrate dev
```

The single resource offers 30-minute consultations, Monday–Friday 09:00–17:00 in `Asia/Karachi`, up to 30 days ahead. The API revalidates every booking and PostgreSQL arbitrates slot races. See [architecture](docs/architecture.md), [API](docs/api.md), [decisions](docs/decisions.md), [deployment](docs/deployment.md), and [demo checklist](docs/demo-checklist.md).

## Limitations

The assessment has one fixed-duration resource and no cancellation/rescheduling UI. JWT logout clears the browser cookie but does not revoke an already-copied token. Chat uses bounded synchronous HTTP rather than a worker. Pagination is bounded internally but cursor UI is intentionally omitted. A disposable PostgreSQL instance and real credentials are required for integration/E2E verification; no deployment or live URL is claimed.
