# Commercial & Payment Terms Engine

**Status:** Requirements locked — implementation not started  
**Engineering phase:** 6 (after CRM Intelligence)  
**Product name:** Phase 3 — Commercial & Payment Engine  

This module is a dedicated business-logic phase. It is not a small CRM field add-on. Catalogue, enquiry CRM, and CRM intelligence stay as they are. WhatsApp, voice, and autonomous AI remain later.

**Non-negotiable split:** authorised humans control commercial commitments. AI may read the latest approved customer-facing terms and explain them. AI must never decide, invent, or modify totals, discounts, advance %, credit, or payment schedules.

---

## 1. Why this is its own phase

Current enquiry status **Quotation Sent** is a workflow label only. There is no quotation amount, discount, advance, payment schedule, or credit profile in the system.

This phase adds:

- Quotations with manual financial controls
- Versioned commercial audit trail
- Customer-specific payment / credit profiles
- Payment tracking, reminders, and escalation
- Order confirmation gate

Later voice/chat AI (product Phase 5) will query this engine. It will not invent commercial terms.

---

## 2. Order / quotation financial controls

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

If someone asks “why was this order confirmed at this amount?”, Admin must see:

**Original → Negotiated → Revised → Final → who changed it → when → reason**

The current approved snapshot is what customer-facing AI and communications may read.

---

## 4. Customer-specific payment / credit profile

Company default payment policy alone is not enough. Each customer has a **Payment Profile**. Customer type does **not** automatically grant credit.

### 4.1 Profile fields

| Field | Values / notes |
|-------|----------------|
| Customer type | `new` \| `existing` \| `vip` |
| Credit status | `no_credit` \| `approved_credit` \| `credit_suspended` |
| Approved payment terms | Human-authored terms (e.g. “100% before dispatch”, “3 days after delivery”) |
| Credit limit | Optional; required when credit is approved |
| Custom payment schedule | Optional override of the default schedule shape |
| Approved by / approved on | Actor + timestamp of the current approval |
| Status | Active / inactive (or equivalent) |

### 4.2 Approval rule

- **Existing customer ≠ eligible for credit.**
- **VIP ≠ eligible for credit.**
- Eligible for credit only when: customer record exists **and** Admin / authorised Sub-Admin has **explicitly approved** credit terms.
- New / first-time customers default to **no credit**: payment before dispatch / delivery.
- AI and email communicate the **approved** profile. They do not infer terms from “I am an old customer.”

### 4.3 Illustrative policies (examples, not automatic)

These are examples of what an Admin *may* approve. They are not granted by type alone.

| Type | Typical approved terms (if Admin approved) |
|------|--------------------------------------------|
| New | 100% advance → then dispatch |
| Existing | Delivery first → payment within 3 days |
| VIP | Delivery first → payment within 15 days |

### 4.4 CRM display

The customer record must show **why** they have those terms, for example:

```
Customer: ABC Books
Customer Type: Existing
Credit Approved: YES
Credit Limit: ₹5,00,000
Payment Terms: 3 days after delivery
Approved By: Admin
Approved On: 12 Aug 2026
Status: Active
```

Profile changes keep the previous terms in history (same append-only rule as discount).

---

## 5. Payment schedules and tracking

The engine must support, as Admin-configured schedules on a quotation / order:

- Multiple partial payments
- Payment after delivery (only if the customer profile allows it)
- Advance + balance combinations
- Outstanding amounts
- Payment reminders (Admin-controlled handling — the system does not auto-commit commercial changes)
- Escalation rules when payment is overdue or terms are breached

---

## 6. Order confirmation gate

An order **cannot** be confirmed without all of:

1. Customer name
2. Quantity
3. Payment information (approved terms + schedule / advance / amounts as required by those terms)

Missing any of these blocks confirmation.

---

## 7. AI behaviour (consumes this engine; does not own it)

Voice / chat / email AI in later phases may query:

`Customer profile → approved terms → quotation → payment schedule → business rules → escalation rules`

Allowed:

- Explain **final approved** terms.
- Refuse unverified claims (“I’m an old customer, give me credit”) by checking CRM.
- If the customer asks for terms **beyond** the approved profile → treat as negotiation → live transfer to Admin. Do not grant, promise, or edit terms.

Not allowed:

- Set or change total, discount, advance %, credit status, credit limit, or schedule.
- Treat customer type as credit approval.

Example:

- Approved: “Yes, your account has approved payment-after-delivery terms. Payment is due within 3 days of delivery.”
- Not approved: “Our current terms for your account require payment before dispatch. If you’d like to request different terms, I’ll connect you with our team.” → live Admin transfer.
- “Can you give me 10 days instead?” → negotiation → immediate live transfer.

---

## 8. Authorisation (to implement when this phase starts)

Separate from enquiry edit. Exact permission keys will be added in implementation, but the product rules are:

| Action | Who |
|--------|-----|
| Enter / edit quotation total | Admin or authorised Sub-Admin |
| Set advance % | Admin or authorised Sub-Admin |
| Apply / change discount | Separately authorised (configurable) |
| Approve / change customer credit profile | Admin or authorised Sub-Admin |
| Confirm order | Only when gate fields are complete + actor is authorised |
| AI | Read latest approved snapshot only |

All commercial writes require a **reason** (except possibly the first “initial quotation” which still records reason).

---

## 9. Scope relative to the current repo

**Do not implement until this phase is explicitly started.** Until then:

- Enquiry status `quotation-sent` remains a status only.
- Customer records have no credit / payment profile.
- No quotation, order, or payment collections.

**This phase does not include:** WhatsApp send/webhooks, ElevenLabs, live transfer, autonomous AI actions, public e-commerce checkout.

**Depends on:** Phase 4 CRM customers + enquiries, existing Admin / Sub-Admin RBAC.

**Unlocks:** later AI can answer payment questions from approved data instead of improvising.

---

## 10. Suggested implementation slices (when approved)

Work in checkpoints; stop for approval after each.

1. Types, permissions, append-only commercial-history model
2. Customer payment / credit profile + history UI (no auto-grant)
3. Quotation: manual total, advance slider, calculated amounts, discount numeric + history
4. Payment schedule + outstanding tracking
5. Order confirmation gate
6. Reminder / escalation rules (Admin-controlled; no AI writes)
7. Read APIs for later AI (approved snapshot only)
