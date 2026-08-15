# Product Phase 3 — Commercial & Payment Terms Engine

**Product phase:** 3  
**Status:** P3.1 complete — stop until P3.2 is approved  
**Do not call this Engineering Phase 6.** Historical repo “Phase 3” still means CMS + catalogue. This document is the **product** Commercial Engine.

This module is a dedicated business-logic phase. It is not a small CRM field add-on. Catalogue, enquiry CRM, and CRM intelligence (AI **CP1–CP6**) stay as they are. WhatsApp, voice, and autonomous AI remain later product phases.

**Non-negotiable split:** authorised humans control commercial commitments. Future AI may read the latest approved customer-facing terms and explain them. AI must never decide, invent, or modify totals, discounts, advance %, credit, payment dates, or payment schedules.

---

## Product roadmap vs AI checkpoints

| Kind | Name | Meaning |
|------|------|---------|
| Product Phase 3 | Commercial & Payment Terms Engine | This work |
| P3.1 … P3.8 | Product Phase 3 checkpoints | Slices of this engine |
| AI CP1–CP6 | CRM Intelligence (repo Phase 5) | Completed; do not renumber |

| Checkpoint | Scope | Status |
|------------|--------|--------|
| P3.1 | Customer Credit Profile + History | Complete |
| P3.2 | Quotations & Commercial Amounts | Not started |
| P3.3 | Discount + Discount History | Not started |
| P3.4 | Advance Payment + Balance | Not started |
| P3.5 | Payment Schedules & Tracking | Not started |
| P3.6 | Commercial Approval + Order Confirmation | Not started |
| P3.7 | Payment Reminders + Escalation | Not started |
| P3.8 | Commercial UI + Audit Review | Not started |

---

## Permanent rule — payment-date extension

A customer requesting a later payment date does **not** change the approved date.

```
Customer request
→ payment-extension request detected
→ Admin escalation / live transfer (later phases)
→ Admin reviews
→ Admin approves or rejects
→ if approved, Admin manually enters the NEW date
→ new date becomes effective
→ previous date remains in history
```

- Customer request ≠ approval.
- AI acknowledgement ≠ approval.
- Only authorised Admin / Sub-Admin approval **plus** a recorded new date can change `approvedPaymentDueOn`.

P3.1 records requests and authorised decisions. It does **not** implement voice/AI transfer.

---

## 1. Why this is its own product phase

Current enquiry status **Quotation Sent** is a workflow label only. There is no quotation amount, discount, advance, payment schedule, or credit profile in the system.

This phase adds:

- Quotations with manual financial controls (P3.2+)
- Versioned commercial audit trail
- Customer-specific payment / credit profiles (**P3.1**)
- Payment tracking, reminders, and escalation (later P3 checkpoints)
- Order confirmation gate (P3.6)

Later voice/chat AI (product Phase 5) will query this engine. It will not invent commercial terms.

---

## 2. Order / quotation financial controls (P3.2–P3.4 — not P3.1)

### 2.1 Total amount

- Must be entered manually.
- Only Admin or an authorised Sub-Admin may enter or edit it.
- AI cannot set or change it.
- The customer cannot change it (public/customer-facing surfaces are read-only).

### 2.2 Advance payment %

- Must be selected manually by Admin or an authorised Sub-Admin.
- Allowed range: **0%–100%**.
- UI is a slider or discrete select — not free text.
- The system calculates amounts from the manually entered total:

```
Total = ₹2,00,000
Advance = 30%
Advance amount = ₹60,000
Balance = ₹1,40,000
```

### 2.3 Discount %

- Custom numeric input (not a dropdown). Any applicable percentage is allowed (examples: 2.5, 7, 12.75).
- Who may apply or change a discount is a separate authorisation (not the same as “can edit enquiry”).
- Changing discount **never overwrites** the previous value. History is append-only.

Discount history example (current discount = 6%; all prior versions remain visible):

| Version | Discount | Changed by | Date | Reason |
|---------|----------|------------|------|--------|
| 1 | 5% | Admin A | 15 Aug 2026 | Initial quotation |
| 2 | 8% | Admin B | 16 Aug 2026 | Customer negotiation |
| 3 | 6% | Admin A | 17 Aug 2026 | Revised commercial terms |

Each history row must store at least: version number, percentage, actor, timestamp, reason (required on change).

---

## 3. Versioned commercial terms (same principle)

The following are versioned / audited. Old values are never silently replaced:

- Price / line totals (when quotations have lines)
- Total amount
- Discount %
- Advance %
- Payment schedule
- Negotiated terms (free-text commercial notes that were approved)
- Customer credit profile and approved payment date (P3.1)

If someone asks “why was this order confirmed at this amount?”, Admin must see:

**Original → Negotiated → Revised → Final → who changed it → when → reason**

The current approved snapshot is what customer-facing AI and communications may read.

---

## 4. Customer-specific payment / credit profile (P3.1)

Company default payment policy alone is not enough. Each customer has a **Payment Profile**. Customer type does **not** automatically grant credit.

### 4.1 Profile fields

| Field | Values / notes |
|-------|----------------|
| Customer relationship type | `new` \| `existing` \| `vip` |
| Credit status | `no_credit` \| `approved_credit` \| `credit_suspended` |
| Approved payment terms | Human-authored; structured summary + flags. Not inferred from type. |
| Credit limit | Integer minor units (paise) + currency; required when credit is approved |
| Approved payment due date | Optional; only changed by authorised approval of a new date |
| Approved by / approved on | Actor + timestamp of the current commercial approval |
| Active / inactive | Current profile in force or not |
| Review / expiry | Optional review and expiry timestamps |

### 4.2 Approval rule

- **Existing customer ≠ eligible for credit.**
- **VIP ≠ eligible for credit.**
- Eligible for credit only when: customer record exists **and** Admin / authorised Sub-Admin has **explicitly approved** credit terms (`customers.manage_credit`).
- New / first-time customers default to **no credit**: payment before dispatch / delivery.
- Do not infer credit from customer age, order count, VIP flag, enquiry history, AI, or customer claims.
- AI and email communicate the **approved** profile. They do not infer terms from “I am an old customer.”

### 4.3 Illustrative policies (examples, not automatic)

These are examples of what an Admin *may* approve. They are not granted by type alone.

| Type | Typical approved terms (if Admin approved) |
|------|--------------------------------------------|
| New | 100% advance → then dispatch |
| Existing | Delivery first → payment within 3 days |
| VIP | Delivery first → payment within 15 days |

### 4.4 History

Profile changes keep the previous terms in the existing customer timeline (`CustomerEvent`). Do not silently overwrite. Each change stores previous snapshot, next snapshot, actor, timestamp, reason, and version.

---

## 5. Payment schedules and tracking (P3.5 / P3.7)

The engine must support, as Admin-configured schedules on a quotation / order:

- Multiple partial payments
- Payment after delivery (only if the customer profile allows it)
- Advance + balance combinations
- Outstanding amounts
- Payment reminders (Admin-controlled handling — the system does not auto-commit commercial changes)
- Escalation rules when payment is overdue or terms are breached

---

## 6. Order confirmation gate (P3.6)

An order **cannot** be confirmed without all of:

1. Customer name
2. Quantity
3. Payment information (approved terms + schedule / advance / amounts as required by those terms)

Missing any of these blocks confirmation.

---

## 7. AI behaviour (later product phases; not P3.1)

Voice / chat / email AI in later phases may query:

`Customer profile → approved terms → quotation → payment schedule → business rules → escalation rules`

Allowed:

- Explain **final approved** terms.
- Refuse unverified claims (“I’m an old customer, give me credit”) by checking CRM.
- If the customer asks for terms **beyond** the approved profile → treat as negotiation / payment-date extension → live transfer to Admin. Do not grant, promise, or edit terms.

Not allowed:

- Set or change total, discount, advance %, credit status, credit limit, schedule, or payment date.
- Treat customer type as credit approval.

P3.1 keeps `crm_ai` off by default, `AI_PROVIDER=none`, `AI_DAILY_TOKEN_BUDGET=0`. No commercial AI writes.

---

## 8. Authorisation

| Action | Who | Permission (when implemented) |
|--------|-----|-------------------------------|
| Approve / change customer credit profile | Admin or authorised Sub-Admin | `customers.manage_credit` (P3.1) |
| Approve a new payment date | Same | `customers.manage_credit` (P3.1) |
| Record a payment-date *request* (does not change the date) | Staff logging a request; future AI may call the same service | Does not grant credit |
| Enter / edit quotation total | Admin or authorised Sub-Admin | Later checkpoint |
| Set advance % | Admin or authorised Sub-Admin | Later checkpoint |
| Apply / change discount | Separately authorised | Later checkpoint |
| Confirm order | Gate + authorised actor | Later checkpoint |
| AI | Read latest approved snapshot only | Never writes |

All commercial writes require a **reason**.

---

## 9. Scope relative to the current repo

**P3.1 implements** customer credit/payment profile + append-only history on existing `Customer` / `CustomerEvent`.

**P3.1 does not implement:** quotations, totals, discount, advance/balance, payment collection, reminders, order gate, WhatsApp, ElevenLabs, AI negotiation.

Enquiry status `quotation-sent` remains a status only until P3.2.

**Depends on:** CRM customers + enquiries, existing Admin / Sub-Admin RBAC.

**Unlocks:** later AI can answer payment questions from approved data instead of improvising.
