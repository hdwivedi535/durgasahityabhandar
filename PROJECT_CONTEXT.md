# Project context (for a fresh Agent chat)

B2B religious book **catalogue + enquiry CRM**. Not e-commerce. Repo is the source of truth.

**Read first:** `README.md` (setup, Vercel, roadmap) and this file. Architecture detail: `docs/PHASE-1-ARCHITECTURE.md`. Do not reconstruct old chat history.

## Git / deploy snapshot (2026-08-14)

- Branch: `main`.
- Phase 4 CRM implemented: customers, enquiries, append-only timeline, dedupe, public form, admin inbox.
- Public enquiry rate limit uses Fastify `trustProxy: true` + `request.ip` (Vercel `X-Forwarded-For`). Do not use socket remote address.

## Stack and layout

npm workspaces: `shared/` → `backend/` (Fastify + MongoDB) → `frontend/` (Next.js 15 App Router).

| Path | Role |
|------|------|
| `shared/` | Permissions, DTOs (auth, book, category, lookup, CMS, features, import/export, CRM) |
| `backend/src/` | App, routes, services, models, seed |
| `backend/api/index.ts` | Vercel serverless handler |
| `frontend/app/(public)/` | Public site including `/enquiry` |
| `frontend/app/admin/` | Admin CRM (customers, enquiries, catalogue, CMS) |

**Production:** two Vercel projects. Standalone backend: **do not** set `API_PATH_PREFIX`. Frontend: `NEXT_PUBLIC_API_URL=https://durgasahityabhandar-backend.vercel.app/api/v1`.

Local: `npm install` → `backend/.env` + `frontend/.env.local` → `npm run seed` → `npm run dev`. Re-seed after Phase 4 to ensure CRM statuses/priorities.

## Roadmap

| Phase | Status |
|-------|--------|
| 1 Architecture | Complete |
| 2 Foundation | Complete |
| 3 CMS + catalogue | Complete |
| 4 CRM | Complete |
| 5+ User management, productivity, communication, tracking | Planned — **do not start** until approved |

## Phase 4 in repo (do not re-implement)

- Canonical phone: E.164 `phone` + `phoneNormalized` + `country` (future WhatsApp uses the same field).
- Dedupe: exact `{ country, phoneNormalized }` or `emailNormalized`. Ambiguous public submit creates a **new** `needsReview` record (no silent merge).
- Enquiry statuses: New → Contacted → Follow-up Required → Quotation Sent → Negotiation → Won / Lost / Closed. Quotation Sent is a **status only**.
- Append-only `enquirymessages`, `enquiryevents`, `customerevents`.
- Public `POST /api/v1/public/enquiries` (feature toggle + IP rate limit 10/min).
- Admin customers/enquiries with explicit permissions; errors use `{ error: { code, message, details? } }`.

Tests: `phone`, `customer-match`, `crm-config-defaults`, `crm-service`, `public-enquiry-rate-limit`, plus existing catalogue tests.

## Out of scope (do not add yet)

WhatsApp send/webhooks, email, quotation generation, orders, payments, AI, analytics, macros, automations, SLA engine, attachments, public tracking tokens, teams, CAPTCHA.

`/track` remains a placeholder.

## Constraints

- Do not commit secrets. Backend Vercel: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `NODE_ENV`.
- Seed Atlas after pulling Phase 4 (`npm run seed`).
- Password special characters in Atlas URIs must be URL-encoded.

## Next task

Wait for approval before Phase 5 (users, teams, roles, scopes, audit).
