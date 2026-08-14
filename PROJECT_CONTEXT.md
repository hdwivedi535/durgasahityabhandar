# Project context (for a fresh Agent chat)

B2B religious book **catalogue + enquiry CRM**. Not e-commerce. Repo is the source of truth.

**Read first:** `README.md` (setup, Vercel, roadmap) and this file. Architecture detail: `docs/PHASE-1-ARCHITECTURE.md`. Do not reconstruct old chat history.

## Git / deploy snapshot (2026-08-14)

- Branch: `main`.
- Phase 4 CRM implemented: customers, enquiries, append-only timeline, dedupe, public form, admin inbox.
- Phase 5 slice 1 **Checkpoint 3 (Enquiry AI summary) complete** — mock/injected adapter only; `crm_ai` still off; no live provider calls.
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
| 5 CRM Intelligence (first slice) | In progress — CP1–CP3 done |
| Later | User management, communication, tracking — **do not start** until approved |

Architecture-doc Phase 5 (users/teams) is deferred. Product Phase 5 is CRM intelligence on top of Phase 4.

## Phase 4 in repo (do not re-implement)

- Canonical phone: E.164 `phone` + `phoneNormalized` + `phoneCountry` + `phoneDialCode`. Business/location `country` is a **separate** ISO field and must never be inferred from the phone (or vice versa).
- Duplicate detection uses normalized E.164 `phoneNormalized`, not business country. Ambiguous public submit creates a **new** `needsReview` record (no silent merge).
- Enquiry statuses: New → Contacted → Follow-up Required → Quotation Sent → Negotiation → Won / Lost / Closed. Quotation Sent is a **status only**.
- Enquiry priorities: `low`, `normal`, `high` (never `medium`).
- Append-only `enquirymessages`, `enquiryevents`, `customerevents`.
- Public `POST /api/v1/public/enquiries` (feature toggle + IP rate limit 10/min).
- Admin customers/enquiries with explicit permissions; errors use `{ error: { code, message, details? } }`.

**Customer/business country and phone country/dial code are independent fields and must never be inferred from one another.** Nepal location + India (+91) phone is valid; India location + Nepal (+977) phone is valid. Future WhatsApp must use `phoneCountry` / E.164, not business `country`.

Tests: `phone`, `customer-match`, `country-phone`, `crm-config-defaults`, `crm-service`, `public-enquiry-rate-limit`, `lead-score`, `lead-score-service`, `enquiry-ai-summary`, plus existing catalogue and AI foundation tests.

## Phase 5 first slice (approved)

Checkpoints: **1 Foundation** → **2 Heuristic lead scoring** → **3 Enquiry AI summary** → **6 Admin UI (enquiry score + summary only)**. Stop after each for approval.

**CP1 done:** permission `enquiries.generate_ai`; `crm_ai` default off; env placeholders; AI DTOs/models/budget helpers; tests `ai-foundation`, `ai-storage`.

**CP2 done:**

- Pure `scoreEnquiry` helper maps existing CRM fields to 0–100 and **suggested** `low` / `normal` / `high` (never `medium`).
- Does **not** overwrite agent `priorityId`. Default create priority remains `normal`.
- Stores `enquiry.leadScore` `{ score, suggestedPriority, reasons, calculatedAt }` on create/update/status/assign/follow-up.
- GET/list compute a score if the field is missing (legacy rows).
- Inbox sort unchanged. No AI generate routes until CP3. `crm_ai` stays disabled.

Rules (base 30): review +20; overdue follow-up +25; missing follow-up +8 (new/contacted/follow-up-required); status new +12; follow-up-required +15; unassigned +10; 2+ open enquiries +8; interested books/categories +8; long requirement +6; terminal −40 (skips other signals). Bands: low 0–39, normal 40–69, high 70–100.

**CP3 done (enquiry AI summary):**

- `POST /api/v1/admin/enquiries/:id/ai/summary` — auth + `enquiries.generate_ai`.
- Flow: `crm_ai` on → provider available → daily budget → mock/injected adapter → `AiRun` (append) + `AiInsight` (upsert `enquiry_summary`) → `{ data: { summary, run } }`.
- Enquiry row is not modified. Missing fields are omitted from the fact payload; the prompt forbids invention.
- Failures: `AI_DISABLED` (403), `AI_NOT_CONFIGURED` (503), `AI_BUDGET_EXCEEDED` (429). No outbound HTTP client is wired; `resolveProductionAdapter` always returns null.
- Defaults unchanged: `crm_ai` off, `AI_PROVIDER=none`, `AI_DAILY_TOKEN_BUDGET=0`.
- Detail GET may include stored `aiSummary` from `AiInsight` (no admin UI in this checkpoint).
- Tests (`enquiry-ai-summary`) use mocks only.

**Remaining this slice:** CP6 enquiry detail UI for score + summary.

**Next slice (not this work):** customer summaries, reply/follow-up/priority suggestions, inbox score sorting.

## Out of scope (do not add yet)

WhatsApp send/webhooks, email, quotation generation, orders, payments, autonomous AI actions, analytics, macros, automations, SLA engine, attachments, public tracking tokens, teams, CAPTCHA.

`/track` remains a placeholder.

## Constraints

- Do not commit secrets. Backend Vercel: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `NODE_ENV`. Do not set a real `AI_API_KEY` until approved.
- Seed Atlas after pulling Phase 5 CP1 (`npm run seed`) so `enquiries.generate_ai` and `crm_ai` exist.
- Password special characters in Atlas URIs must be URL-encoded.

## Next task

Wait for approval before Checkpoint 6 (admin UI for enquiry score + summary only).
