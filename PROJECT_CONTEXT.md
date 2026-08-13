# Project context (for a fresh Agent chat)

B2B religious book **catalogue + enquiry CRM**. Not e-commerce. Repo is the source of truth.

**Read first:** `README.md` (setup, Vercel, roadmap) and this file. Architecture detail: `docs/PHASE-1-ARCHITECTURE.md`. Do not reconstruct old chat history.

## Git / deploy snapshot (2026-08-14)

- Branch: `main`, in sync with `origin/main`, working tree clean.
- Latest: `297de1a` — include `backend/api` in `tsc` and start `dist/src/index.js` after `rootDir` became `.`.
- Recent: Phase 3 CMS/catalogue (`22af03e`), public catalogue + admin book editing, bulk import/export, Vercel serverless backend entry (`backend/api/index.ts`).

## Stack and layout

npm workspaces: `shared/` → `backend/` (Fastify + MongoDB) → `frontend/` (Next.js 15 App Router).

| Path | Role |
|------|------|
| `shared/` | Permissions, DTOs (auth, book, category, lookup, CMS, features, import/export) |
| `backend/src/` | App, routes, services, models, seed |
| `backend/api/index.ts` | Vercel serverless handler (`buildApp()` + `app.server.emit('request')`) |
| `frontend/app/(public)/` | Public site |
| `frontend/app/admin/` | Admin CRM shell |
| Root `vercel.json` | Optional single-project Services (`/api/backend` → backend) |

**Current production shape (README):** two Vercel projects — `durgasahityabhandar-frontend` (root `frontend`) and `durgasahityabhandar-backend` (root `backend`). Standalone backend: **do not** set `API_PATH_PREFIX`. Frontend: `NEXT_PUBLIC_API_URL=https://durgasahityabhandar-backend.vercel.app/api/v1`.

Local: `npm install` → `backend/.env` + `frontend/.env.local` → `npm run seed` → `npm run dev`. Atlas preferred; Docker Mongo optional.

## Roadmap

| Phase | Status |
|-------|--------|
| 1 Architecture | Complete |
| 2 Foundation (auth, RBAC, shells) | Complete |
| 3 CMS + catalogue | Feature-complete; production deployment verification pending |
| 4+ CRM | Planned — **do not start** until Phase 3 deploy is stable |

## Phase 3 in repo (do not re-implement)

- **Lookups:** pageType, bindingType, subject, tag, availability (`/admin/lookups`).
- **Categories:** tree, translations, publish/hide/archive, CSV/XLSX import.
- **Books:** CRUD, translations, SKU, physical/publishing/commercial fields, field visibility, publish/unpublish, image URLs, bulk import/export.
- **CMS:** pages (about/contact/wholesale-style) + homepage sections; public homepage from CMS config.
- **Visibility:** public catalogue strips hidden fields; pricing gated by feature toggle.
- **Public:** `/`, `/books`, `/books/[slug]`, `/categories`, `/categories/[slug]`; CMS-backed about/contact/wholesale.
- **Features:** admin toggles + `GET /api/v1/public/settings`.
- **Auth:** JWT cookies and a local seed super-admin. Use environment-managed credentials in production.
- Tests: `backend/src/__tests__/visibility.test.ts`, `catalogue-import.test.ts`.

Public `/enquiry` and `/track` and admin Customers/Enquiries are placeholders. Leave them until Phase 4 is approved.

## Known issue (current)

**Vercel backend TypeScript TS6059** (file is not under `rootDir`) during backend deploy.

Local `backend/tsconfig.json` now has `"rootDir": "."` and `"include": ["src/**/*", "api/**/*"]`; `start` is `node dist/src/index.js`. That unblocks **local** `tsc` after adding `api/index.ts`. Vercel may still typecheck/bundle from a different cwd or follow `@dsb/shared` outside `backend/`, which re-triggers TS6059.

Health check after a successful deploy: `https://durgasahityabhandar-backend.vercel.app/api/v1/health` → `{"data":{"status":"ok"...}}` (not `FUNCTION_INVOCATION_FAILED`).

## Constraints

- Do not commit secrets (`.env`). Set `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `NODE_ENV` on the backend Vercel project.
- Seed Atlas once from local (`npm run seed`) — seed is not a runtime job.
- Stay catalogue/CMS/deploy-scoped until this issue is fixed. No Phase 4 models/APIs/UI.
- Prefer fixing Vercel/tsconfig/entrypoint config over rewriting Fastify app code.
- Password special characters in Atlas URIs must be URL-encoded.

## Next task

1. Reproduce and fix **backend Vercel TS6059** so `vercel-build` / Vercel function compile succeeds.
2. Confirm health URL, then frontend login against that API.
3. Only after deploy is green: close Phase 3 and wait for approval before Phase 4.
