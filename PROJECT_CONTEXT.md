# Project context (for a fresh Agent chat)

B2B religious book **catalogue + enquiry CRM**. Not e-commerce. Repo is the source of truth.

**Read first:** `README.md` (setup, Vercel, roadmap) and this file. Architecture detail: `docs/PHASE-1-ARCHITECTURE.md`. Do not reconstruct old chat history.

## Git / deploy snapshot (2026-08-14)

- Branch: `main`.
- Phase 4 CRM implemented: customers, enquiries, append-only timeline, dedupe, public form, admin inbox.
- Phase 5 slice 1 **Checkpoint 6 (Admin UI for score + summary) complete** — consumes CP2/CP3 APIs; `crm_ai` still off; no live provider calls.
- Phase 5 **Checkpoint 4 (Customer AI summary) complete** — backend generate + AiInsight storage; `crm_ai` still off; no live provider; no customer AI UI in CP4.
- Phase 5 **Checkpoint 5 (Customer AI summary admin UI) complete** — customer detail card consumes CP4 API; `crm_ai` still off; no live provider calls.
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

Local: `npm install` → `backend/.env` + `frontend/.env.local` → `npm run seed` → `npm run dev`. Re-seed after Phase 4/5 foundation to pick up `enquiries.generate_ai`, `customers.generate_ai`, and `crm_ai`.

## Product roadmap (do not mix with AI CP numbers)

| Product phase | Status |
|---------------|--------|
| 1 Multilingual B2B website + catalogue | Complete |
| 2 CRM + enquiries + Admin/Sub-Admin | Complete |
| 3 Commercial & Payment Terms Engine | **P3.1 complete** — wait for approval before P3.2 (`docs/COMMERCIAL-PAYMENT-ENGINE.md`) |
| 4 WhatsApp + enquiry consolidation | Later |
| 5 ElevenLabs voice + human transfer | Later |
| 6 AI qualification + escalation | Later |
| 7 Advanced automation + analytics/BI | Later |

Product Phase 3 checkpoints: **P3.1** credit profile → P3.2 quotations → P3.3 discount → P3.4 advance → P3.5 schedules → P3.6 order confirmation → P3.7 reminders → P3.8 commercial UI. Stop after each.

## Historical engineering / architecture phases (do not rename)

These labels already exist in the repo (architecture doc, CMS, CRM). They are **not** the product roadmap numbers above.

| Label in repo | Status |
|---------------|--------|
| Architecture Phase 1 | Complete |
| Foundation Phase 2 | Complete |
| CMS + catalogue (historical “Phase 3”) | Complete |
| CRM (historical “Phase 4”) | Complete |
| CRM Intelligence (historical “Phase 5”, AI **CP1–CP6**) | First slice done — do not renumber CP1–CP6 |

Architecture-doc Phase 5 (users/teams) is deferred. Product Phase 5 is ElevenLabs, **not** CRM intelligence. Do not call the Commercial Engine “Engineering Phase 6”.

## Phase 4 in repo (do not re-implement)

- Canonical phone: E.164 `phone` + `phoneNormalized` + `phoneCountry` + `phoneDialCode`. Business/location `country` is a **separate** ISO field and must never be inferred from the phone (or vice versa).
- Duplicate detection uses normalized E.164 `phoneNormalized`, not business country. Ambiguous public submit creates a **new** `needsReview` record (no silent merge).
- Enquiry statuses: New → Contacted → Follow-up Required → Quotation Sent → Negotiation → Won / Lost / Closed. Quotation Sent is a **status only**.
- Enquiry priorities: `low`, `normal`, `high` (never `medium`).
- Append-only `enquirymessages`, `enquiryevents`, `customerevents`.
- Public `POST /api/v1/public/enquiries` (feature toggle + IP rate limit 10/min).
- Admin customers/enquiries with explicit permissions; errors use `{ error: { code, message, details? } }`.

**Customer/business country and phone country/dial code are independent fields and must never be inferred from one another.** Nepal location + India (+91) phone is valid; India location + Nepal (+977) phone is valid. Future WhatsApp must use `phoneCountry` / E.164, not business `country`.

Tests: `phone`, `customer-match`, `country-phone`, `crm-config-defaults`, `crm-service`, `public-enquiry-rate-limit`, `lead-score`, `lead-score-service`, `enquiry-ai-summary`, `customer-ai-summary`, `customer-credit-profile`, plus existing catalogue and AI foundation tests.

## Phase 5 first slice (approved)

Checkpoints: **1 Foundation** → **2 Heuristic lead scoring** → **3 Enquiry AI summary** → **6 Admin UI (enquiry score + summary only)** → **4 Customer AI summary (backend)** → **5 Customer AI summary admin UI**. Stop after each for approval.

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

**CP6 done (admin UI, enquiry score + summary only):**

- Enquiry detail shows CRM `priority` separately from heuristic `leadScore` (score, suggested band, reasons). Does not write `priorityId`.
- Stored `aiSummary` from GET; generate/regenerate calls existing `POST /api/v1/admin/enquiries/:id/ai/summary`.
- Button requires `enquiries.generate_ai` (super-admin included). Frontend never calls a provider; errors map `403`, `AI_DISABLED`, `AI_NOT_CONFIGURED`, `AI_BUDGET_EXCEEDED`, provider failure.
- Defaults unchanged: `crm_ai` off, `AI_PROVIDER=none`, `AI_DAILY_TOKEN_BUDGET=0`.

**CP4 — Customer AI Summary (approved, backend only):**

- Scope: generate a customer summary from **existing Customer fields only**. Missing/empty fields are omitted; the prompt forbids invention (no fabricated contact, location, interests, order/enquiry history, or preferences).
- Endpoint: `POST /api/v1/admin/customers/:id/ai/summary` — auth + `customers.generate_ai` (new; not `enquiries.generate_ai`).
- Storage: `AiRun` kind `customer_summary` (append) + `AiInsight` upsert `{ kind: customer_summary, targetType: customer }`. Customer document is not written. Repeat generation appends a run and upserts the insight.
- GET customer detail may include stored `aiSummary` from `AiInsight` (no admin UI in this checkpoint).
- Flow reuses CP1/CP3: `crm_ai` on → provider available → daily budget → mock/injected adapter. Failures: `AI_DISABLED` (403), `AI_NOT_CONFIGURED` (503), `AI_BUDGET_EXCEEDED` (429). `resolveProductionAdapter` stays null.
- Defaults unchanged: `crm_ai` off, `AI_PROVIDER=none`, `AI_DAILY_TOKEN_BUDGET=0`.
- Tests (`customer-ai-summary`) use mocks only.
- Exclusions for CP4: no customer AI UI, reply/follow-up/priority suggestions, inbox sorting, or live provider.

**CP5 done (admin UI, customer summary only):**

- Customer detail shows stored `aiSummary` from GET; generate/regenerate calls existing `POST /api/v1/admin/customers/:id/ai/summary` (no new backend).
- Button requires `customers.generate_ai` (super-admin included). Frontend never calls a provider; errors map `FORBIDDEN`, `AI_DISABLED`, `AI_NOT_CONFIGURED`, `AI_BUDGET_EXCEEDED`, `NOT_FOUND`, network/API failure via existing `getAiActionMessage`.
- Does not write customer fields. Country and phone country remain independent.
- Defaults unchanged: `crm_ai` off, `AI_PROVIDER=none`, `AI_DAILY_TOKEN_BUDGET=0`.
- Tests (`customer-ai-summary-ui`) use mocked API responses only.
- Exclusions: reply/follow-up/priority suggestions, inbox score sorting, customer recommendations, live provider.

**Remaining this slice:** none until a later checkpoint is approved.

**Later (not this work):** reply/follow-up/priority suggestions, inbox score sorting.

## Product Phase 3 — Commercial & Payment Engine

Spec: `docs/COMMERCIAL-PAYMENT-ENGINE.md`. **P3.1** is the only approved slice: customer credit/payment profile + history. Do not start P3.2+ until approved.

Locked rules:

- Humans (Admin / authorised Sub-Admin with `customers.manage_credit`) own credit status, limit, payment terms, and approved payment dates. AI never writes them.
- Customer relationship type (new / existing / VIP) does **not** grant credit. Credit requires explicit approval.
- New customers default to no credit / 100% advance before dispatch.
- Commercial changes are append-only on the existing customer timeline (who / when / reason / previous → next). Never overwrite history.
- Payment-date extension: customer request is recorded only. The approved date changes only when authorised staff approve **and** manually enter the new date.
- No order confirmation without customer name + quantity + payment information (P3.6, not P3.1).

## Out of scope (do not add yet)

WhatsApp send/webhooks, email, quotation generation, orders, payments, autonomous AI actions, analytics, macros, automations, SLA engine, attachments, public tracking tokens, teams, CAPTCHA. Product Phase 3 after P3.1 (quotations, discount, advance, schedules, reminders, commercial UI) is **not started**.

`/track` remains a placeholder.

## Constraints

- Do not commit secrets. Backend Vercel: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `NODE_ENV`. Do not set a real `AI_API_KEY` until approved.
- Seed Atlas after pulling P3.1 (`npm run seed`) so `customers.manage_credit` exists, along with existing `enquiries.generate_ai`, `customers.generate_ai`, and `crm_ai`.
- Password special characters in Atlas URIs must be URL-encoded.

## Next task

**P3.1 is complete. STOP.** Do not start P3.2 (quotations) or any later Product Phase 3 checkpoint until explicitly approved. Do not start WhatsApp, ElevenLabs, or new AI work.
