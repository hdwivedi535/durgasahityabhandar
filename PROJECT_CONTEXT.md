# Project context (for a fresh Agent chat)

B2B religious book **catalogue + enquiry CRM**. Not e-commerce. Repo is the source of truth.

**Read first:** `README.md` (setup, Vercel, roadmap) and this file. Architecture detail: `docs/PHASE-1-ARCHITECTURE.md`. Do not reconstruct old chat history.

## Git / deploy snapshot (2026-08-14)

- Branch: `main`.
- Phase 4 CRM implemented: customers, enquiries, append-only timeline, dedupe, public form, admin inbox.
- Phase 5 slice 1 **Checkpoint 1 (Foundation) complete** — no generate HTTP routes, no UI, no real provider calls.
- Public enquiry rate limit uses Fastify `trustProxy: true` + `request.ip` (Vercel `X-Forwarded-For`). Do not use socket remote address.

## Stack and layout

npm workspaces: `shared/` → `backend/` (Fastify + MongoDB) → `frontend/` (Next.js 15 App Router).

| Path | Role |
|------|------|
| `shared/` | Permissions, DTOs (auth, book, category, lookup, CMS, features, import/export, CRM, AI) |
| `backend/src/` | App, routes, services, models, seed |
| `backend/api/index.ts` | Vercel serverless handler |
| `frontend/app/(public)/` | Public site including `/enquiry` |
| `frontend/app/admin/` | Admin CRM (customers, enquiries, catalogue, CMS) |

**Production:** two Vercel projects. Standalone backend: **do not** set `API_PATH_PREFIX`. Frontend: `NEXT_PUBLIC_API_URL=https://durgasahityabhandar-backend.vercel.app/api/v1`.

Local: `npm install` → `backend/.env` + `frontend/.env.local` → `npm run seed` → `npm run dev`. Re-seed after Phase 4/5 foundation to pick up `enquiries.generate_ai` and `crm_ai`.

## Roadmap

| Phase | Status |
|-------|--------|
| 1 Architecture | Complete |
| 2 Foundation | Complete |
| 3 CMS + catalogue | Complete |
| 4 CRM | Complete |
| 5 CRM Intelligence (first slice) | In progress — CP1 done |
| Later | User management, communication, tracking — **do not start** until approved |

Architecture-doc Phase 5 (users/teams) is deferred. Product Phase 5 is CRM intelligence on top of Phase 4.

## Phase 4 in repo (do not re-implement)

- Canonical phone: E.164 `phone` + `phoneNormalized` + `country` (future WhatsApp uses the same field).
- Dedupe: exact `{ country, phoneNormalized }` or `emailNormalized`. Ambiguous public submit creates a **new** `needsReview` record (no silent merge).
- Enquiry statuses: New → Contacted → Follow-up Required → Quotation Sent → Negotiation → Won / Lost / Closed. Quotation Sent is a **status only**.
- Enquiry priorities: `low`, `normal`, `high` (never `medium`).
- Append-only `enquirymessages`, `enquiryevents`, `customerevents`.
- Public `POST /api/v1/public/enquiries` (feature toggle + IP rate limit 10/min).
- Admin customers/enquiries with explicit permissions; errors use `{ error: { code, message, details? } }`.

Tests: `phone`, `customer-match`, `crm-config-defaults`, `crm-service`, `public-enquiry-rate-limit`, plus existing catalogue tests.

## Phase 5 first slice (approved)

Checkpoints: **1 Foundation** → **2 Heuristic lead scoring** → **3 Enquiry AI summary** → **6 Admin UI (enquiry score + summary only)**. Stop after each for approval.

**CP1 done:**

- Permission `enquiries.generate_ai`.
- Feature toggle `crm_ai` (default **off**).
- Env placeholders: `AI_PROVIDER=none`, empty key, `AI_DAILY_TOKEN_BUDGET=0`. Real provider calls stay off until key + budget are explicitly approved.
- Shared AI DTOs; models `AiRun`, `AiInsight`, `AiTokenCounter`; budget helper; `isRealProviderEnabled`.
- Tests: `ai-foundation`, `ai-storage` (mocks / in-memory Mongo only).

**Remaining this slice:** CP2 heuristic score; CP3 enquiry summary (mock adapter, no live LLM); CP6 enquiry detail UI for score + summary.

**Next slice (not this work):** customer summaries, reply/follow-up/priority suggestions, inbox score sorting.

## Out of scope (do not add yet)

WhatsApp send/webhooks, email, quotation generation, orders, payments, autonomous AI actions, analytics, macros, automations, SLA engine, attachments, public tracking tokens, teams, CAPTCHA.

`/track` remains a placeholder.

## Constraints

- Do not commit secrets. Backend Vercel: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `NODE_ENV`. Do not set a real `AI_API_KEY` until approved.
- Seed Atlas after pulling Phase 5 CP1 (`npm run seed`) so `enquiries.generate_ai` and `crm_ai` exist.
- Password special characters in Atlas URIs must be URL-encoded.

## Next task

Wait for approval before Checkpoint 2 (heuristic lead scoring).
