# Durga Sahitya Bhandar

B2B religious book catalogue + enquiry CRM platform.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** Fastify, TypeScript, MongoDB
- **Shared:** Permission definitions, shared types

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB Atlas cluster (recommended) **or** Docker for local MongoDB

### MongoDB Atlas setup

The backend reads `MONGODB_URI` from `backend/.env`. Use your Atlas cluster — not `localhost`.

#### 1. Get your connection string

In [MongoDB Atlas](https://cloud.mongodb.com):

1. **Database** → your cluster → **Connect**
2. Choose **Drivers** → copy the connection string  
   Example: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/`
3. Replace `<password>` with your database user password
4. Append the database name: `/dsb`  
   Final form: `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/dsb`

#### 2. Allow network access

**Network Access** → **Add IP Address**:

- For development: **Add Current IP Address**
- Or temporarily: `0.0.0.0/0` (allow from anywhere — dev only)

#### 3. Create a database user

**Database Access** → **Add New Database User**:

- Username + password (save these)
- Role: **Atlas admin** or **Read and write to any database**

#### 4. Update `backend/.env`

```bash
# Edit backend/.env — replace MONGODB_URI:
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/dsb
```

**Password special characters** must be URL-encoded in the URI:

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |

#### 5. Seed and verify

```bash
npm run seed
npm run dev -w backend
```

Test: `curl http://localhost:4000/api/v1/health` → should return `{"data":{"status":"ok"...}}`

#### 6. Vercel (production)

In Vercel → **backend service** → **Environment Variables**, set the same `MONGODB_URI` (and other backend vars from `.env.example`).

---

### Local setup (Docker alternative)

If you prefer local MongoDB instead of Atlas:

```bash
docker compose up -d
# MONGODB_URI=mongodb://localhost:27017/dsb  (default in .env.example)
```

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

| Variable | Required | Example |
|----------|----------|---------|
| `MONGODB_URI` | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/dsb` |
| `JWT_SECRET` | Yes | 32+ char random string |
| `JWT_REFRESH_SECRET` | Yes | 32+ char random string |
| `FRONTEND_URL` | Yes | `https://your-app.vercel.app` |
| `API_PATH_PREFIX` | Yes | `/api/backend` |
| `NODE_ENV` | Yes | `production` |
| `COOKIE_SECURE` | Optional | `true` (auto in production) |

#### Frontend service

| Variable | Required | Example |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Recommended | `/api/backend/api/v1` |

> If omitted, production defaults to same-origin `/api/backend/api/v1`.

### Two separate Vercel projects (your current setup)

If you deployed **frontend** and **backend** as separate Vercel projects:

#### Backend project (`durgasahityabhandar-backend`)

**Settings → General → Root Directory:** `backend`  
**Settings → Build:** uses `backend/vercel.json` (installs from monorepo root)

**Environment Variables (required):**

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | `mongodb+srv://...@....mongodb.net/dsb` |
| `JWT_SECRET` | 32+ char random string |
| `JWT_REFRESH_SECRET` | 32+ char random string |
| `FRONTEND_URL` | `https://durgasahityabhandar-frontend.vercel.app` |
| `NODE_ENV` | `production` |

> Do **not** set `API_PATH_PREFIX` for standalone backend — leave empty or omit.

**Test after redeploy:**
```text
https://durgasahityabhandar-backend.vercel.app/api/v1/health
```
Must return `{"data":{"status":"ok"...}}` — not `FUNCTION_INVOCATION_FAILED`.

#### Frontend project (`durgasahityabhandar-frontend`)

**Settings → General → Root Directory:** `frontend`

**Environment Variables:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://durgasahityabhandar-backend.vercel.app/api/v1` |

**Test login:** `https://durgasahityabhandar-frontend.vercel.app/login`

---

### Single Vercel project (monorepo Services)

Alternatively, deploy from **repo root** using root `vercel.json` with Services preset. Then use `NEXT_PUBLIC_API_URL=/api/backend/api/v1` and set `API_PATH_PREFIX=/api/backend` on backend.

---

### Admin panel on Vercel — checklist

The admin panel is at `/login` and `/admin/*` on the **frontend** service. It needs the **backend** API working.

1. **Seed Atlas** (once): `npm run seed` locally with your Atlas `MONGODB_URI`
2. **Backend env vars** set in Vercel (see table above)
3. **Frontend env**: `NEXT_PUBLIC_API_URL=/api/backend/api/v1`
4. **Test API**: visit `https://your-app.vercel.app/api/backend/api/v1/health` → should return `{"data":{"status":"ok"}}`
5. **Login**: `https://your-app.vercel.app/login` with `admin@dsb.local` / `Admin@123456`

**Common failures:**

| Symptom | Fix |
|---------|-----|
| `FUNCTION_INVOCATION_FAILED` on `/api/backend/*` | Set `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` on backend service |
| Login page loads but sign-in fails | Check API health URL; set `NEXT_PUBLIC_API_URL` |
| Login works once then fails on refresh | Set `API_PATH_PREFIX=/api/backend` on backend service |
| CORS error | Set `FRONTEND_URL` to your exact Vercel domain |

> **If you see `FUNCTION_INVOCATION_FAILED`:** check Vercel → backend service → Logs.

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
| 2 — Foundation | Complete |
| 3 — CMS + Catalogue | Complete — categories, books, lookups, CMS pages/homepage, visibility, public catalogue |
| 4 — CRM | Complete — customers, enquiries, timeline, search, deduplication |
| 5 — CRM Intelligence | In progress — foundation, scoring, enquiry/customer summaries, admin enquiry score/summary UI (no live AI) |

See [docs/PHASE-1-ARCHITECTURE.md](docs/PHASE-1-ARCHITECTURE.md) for full architecture.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend |
| `npm run build` | Build all packages |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Seed database |
