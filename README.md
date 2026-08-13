# Durga Sahitya Bhandar

B2B religious book catalogue + enquiry CRM platform.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** Fastify, TypeScript, MongoDB
- **Shared:** Permission definitions, shared types

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local MongoDB)

### Setup

```bash
# Install dependencies
npm install

# Start MongoDB
docker compose up -d

# Configure environment
cp .env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Seed database (permissions, roles, super admin)
npm run seed

# Start development servers
npm run dev
```

- Public website: http://localhost:3000
- Admin login: http://localhost:3000/login
- API: http://localhost:4000/api/v1

**Default super admin (after seed):**
- Email: `admin@dsb.local`
- Password: `Admin@123456`

Change these in production.

## Deploying to Vercel

This repo uses Vercel **Services** (multi-service monorepo). Root `vercel.json` configures:

| Service | Root | Route |
|---------|------|-------|
| frontend | `frontend/` | `/` |
| backend | `backend/` | `/api/backend` |

### Build order

Workspace packages build in dependency order. Each service runs `prebuild` to compile `@dsb/shared` before its own build:

```text
@dsb/shared → @dsb/backend → frontend
```

From the repo root, verify locally:

```bash
npm install
npm run build
npm run typecheck
```

### Environment variables (Vercel dashboard)

Set these per service. **Do not commit real values.**

#### Backend service

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Access token secret (min 16 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret (min 16 chars) |
| `FRONTEND_URL` | Yes | Production frontend URL (e.g. `https://your-domain.vercel.app`) |
| `COOKIE_SECURE` | Yes | Set to `true` in production |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Optional | Vercel sets this automatically |
| `JWT_ACCESS_EXPIRES_IN` | Optional | Default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Optional | Default `7d` |

> **If you see `FUNCTION_INVOCATION_FAILED`:** check Vercel → backend service → Logs. The most common causes are missing `JWT_SECRET` / `JWT_REFRESH_SECRET` / `MONGODB_URI`, or MongoDB Atlas IP access not allowing Vercel.

#### Frontend service

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL. On Vercel use `/api/backend/api/v1` (same-origin rewrite) |

#### Seed-only (local / one-off — not required for runtime)

| Variable | Description |
|----------|-------------|
| `SEED_ADMIN_EMAIL` | Initial admin email for `npm run seed` |
| `SEED_ADMIN_PASSWORD` | Initial admin password for `npm run seed` |

## Project Structure

```
frontend/     Next.js public site + admin CRM
backend/      Fastify REST API
shared/       Shared types and permissions
docs/         Architecture documentation
```

## Development Phases

| Phase | Status |
|-------|--------|
| 1 — Architecture | Complete |
| 2 — Foundation | In progress |
| 3 — CMS + Catalogue | In progress — categories complete, books next |
| 4 — CRM | Planned |

See [docs/PHASE-1-ARCHITECTURE.md](docs/PHASE-1-ARCHITECTURE.md) for full architecture.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend |
| `npm run build` | Build all packages |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Seed database |
