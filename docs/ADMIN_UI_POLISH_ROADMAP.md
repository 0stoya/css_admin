# Admin UI polish roadmap

Last updated: 2026-09-12

This document is the live tracker for the **Staff / Magento-admin** UI polish pass in `css_admin`.

It is deliberately separate from the functional product roadmap. The rules here are presentation and interaction rules only: Fluid/Magento remains authoritative for permissions, company scope, purchasing policy, pricing, credit, catalogue eligibility and every mutation outcome.

Company Portal (`app/(portal)`) work is tracked separately and is **out of scope** for this pass unless explicitly stated.

## Status legend

- ✅ **Complete** — merged into `main`; runtime acceptance recorded where applicable.
- 🟡 **Next / active** — the next focused implementation block.
- ⬜ **Planned** — agreed direction, not implemented yet.
- 🔎 **Final acceptance** — cross-workspace regression/accessibility work after the focused passes.

## Current position

### ✅ Phase 0 — UI / UX foundation

Established before this pass:

- CSS Commerce brand tokens, typography, buttons, fields, cards, badges and notices;
- Admin shell, company context and company sidebar;
- responsive operational content width;
- visible keyboard focus states;
- company directory and overview hierarchy;
- focused Users/Roles and Catalogue workspaces;
- specialised commercial/OGL/credit-order layouts;
- Company Portal kept as a separate authenticated UI surface.

Reference: `docs/ui-ux-foundation.md`.

### ✅ Phase 1 — Purchase-control UX hardening and polish

Recent completed work:

- **PR #69** — quantity-allowance management feedback, validation and affected-buyer reporting;
- **PR #70** — Lucide help/edit modals for purchase controls;
- **PR #71** — purchase-control visual hierarchy, compact metrics and quieter operations;
- purchase-control help remains the specialist explanation for buyer allowances, periods, resets and retained history.

The purchase-control workspace is now the reference interaction pattern for focused admin editing: concise overview first, detailed edit in a modal, destructive actions visually secondary, backend decisions left authoritative.

### ✅ Phase 2 — Admin visual system and contextual help

**PR #72** merged.

Completed:

- Lucide icons across Admin sidebar navigation;
- consistent admin-only hierarchy for headings, cards, tables, searches and notices;
- route-aware `(i)` help for screens with non-obvious policy, identity, source-of-truth or workflow semantics;
- all new visual rules scoped under `.admin-shell` so Company Portal is unaffected;
- route-by-route info-icon decisions recorded in `docs/ADMIN_UI_POLISH_AUDIT.md`.

Deliberately no generic info trigger on:

- Companies directory;
- Company overview;
- Purchase controls (already has specialist help);
- Company Portal routes.

## ✅ Phase 3 — Interaction consistency: Users & roles + Employees

**PR #74 merged, deployed and visually accepted.**

Completed:

- Add user / Create role / Edit user / Edit role use focused Admin action modals;
- protected roles use the same interaction language but remain read-only;
- Add/Edit Employee uses the shared Admin modal pattern;
- Employee History remains a separate reporting flow;
- Lucide row actions and quieter destructive actions are consistent across both workspaces;
- failed mutations can reopen the relevant modal while retaining practical search/filter/page state;
- existing GraphQL payloads, Fluid ACL decisions and Employee-vs-buyer identity semantics remain unchanged.

Runtime acceptance confirmed the new interaction model on the deployed Admin application.

## ✅ Phase 4 — Policy/configuration interactions

**PR #75 merged, deployed and visually accepted. PR #76 followed with the deployed Payment save-button contrast fix.**

Completed:

- Catalogue policy keeps Company / Role tabs and backend-authoritative boundaries while using clearer status, row-action, search, restriction and save hierarchy;
- large catalogue pickers stay full-width rather than being forced into modals;
- Payment configuration uses the shared Lucide language, clearer Default / All / Specific choices, better search/selection feedback and pending-save protection;
- Company settings clearly separates read-only synced/OGL data, editable Magento-local settings and the destructive lifecycle area;
- long local configuration remains full-width with a sticky save treatment;
- destructive company deletion remains exact-reference-confirmed and backend-authoritative;
- no GraphQL schema, server-action, ACL or backend rules were changed.

Runtime acceptance confirmed the Phase 4 interaction model and the payment-action contrast follow-up on the deployed Admin application.

## 🟡 Phase 5 — Commercial and operational surfaces

This is the **active focused implementation block**.

The emphasis here is operational clarity rather than more editing controls. Company Credit, Pricing and Finance remain read-only; Credit Orders continues to render only the actions Fluid authorizes for the selected real company-user actor.

### Company credit

- tighten the credit-limit / used / available hierarchy without turning the page into a large dashboard;
- keep over-limit policy semantics and utilization obvious;
- make the read-only/source-of-truth boundary visually explicit;
- align links into Credit orders with the shared Admin action language.

### Pricing

- reduce oversized source presentation and make OGL custom price vs Magento fallback easy to scan;
- standardise search, result rows, pagination and tier-price hierarchy;
- make import health/provenance secondary to the actual pricing source and rows;
- preserve read-only behaviour and backend-authoritative pricing.

### Finance

- align metric-card proportions with the newer Admin density;
- strengthen OGL provenance without distracting from the monthly operational chart;
- keep “spend” explicitly defined as OGL order value rather than an accounting-ledger balance;
- preserve dense chart readability and read-only behaviour.

### Credit orders

- align queue filters, status badges, row focus/hover and right-side order actions;
- make acting-company-user context visually prominent because lifecycle authorization is actor-specific;
- make read-only mode equally explicit when no actor is selected;
- strengthen detail tabs, actor context and lifecycle disclosures without hiding operational history in modals;
- never expose lifecycle actions that Fluid does not return as authorized;
- preserve the customer-owned `approved_pending_payment` boundary.

### Phase 5 acceptance

- visual/presentation changes only; no GraphQL, server-action, ACL or backend changes;
- Company Credit, Pricing and Finance remain read-only;
- Credit Orders still resolves actions exclusively from Fluid for the selected actor;
- queues, reports, history and long operational records remain in-page;
- check queue/detail behavior with no actor, approver actor and non-authorized actor;
- check pricing source/fallback and no-custom-price states;
- check credit normal/over-limit/no-account states;
- check Finance data-present and backend-unavailable states;
- run focused commercial-polish tests plus `yarn lint`, `yarn typecheck`, `yarn build` and live Admin regression.

## ⬜ Phase 6 — OGL + import workflows

### OGL administration / rep profiles

- standardise registry/mapping tabs, status strips and row actions;
- align rep-profile edit/media actions with the shared Admin interaction language;
- keep OGL as the source of truth for onboarding and representative assignment.

### Bulk import / company import-export

- make **Choose → Preview → Apply** the unmistakable workflow hierarchy;
- standardise download/upload/action icons;
- strengthen preview error/success summaries without reducing row-level detail;
- keep Apply guarded and separate from Preview;
- preserve `company_ref` routing/safety semantics.

## 🔎 Phase 7 — Final Admin accessibility and responsive pass

Run after the focused workspace PRs so fixes are not repeatedly invalidated.

Check:

- keyboard-only navigation and visible focus;
- focus restoration for every modal;
- Escape/backdrop rules;
- 200% browser zoom;
- 360–390px mobile widths and tablet widths;
- long company/product/user/role names;
- horizontal table overflow and dense operational records;
- empty, error and loading-state consistency;
- destructive-action labelling;
- reduced-motion behaviour;
- route changes and session-expiry recovery;
- representative Company Portal smoke regression to prove Admin-only changes did not leak across the auth/UI boundary.

## Shared interaction rules

These rules apply to every phase unless a screen has a documented reason to differ.

### Modal use

Use a modal when the task is a focused create/edit/confirmation action and the user benefits from retaining the list or overview context behind it.

Good candidates:

- create/edit user;
- create/edit role;
- create/edit employee;
- focused destructive confirmation;
- compact help/guidance.

Do **not** put long operational history, queues, reports, large browsing experiences or long configuration forms into a modal just for consistency.

### Actions

- one obvious primary action per task;
- secondary actions stay visually quieter;
- destructive actions use Lucide `Trash2`, `UserX` or equivalent and require explicit confirmation;
- row actions sit in a consistent right-side action area;
- use icons to improve scanning, not decorate every label.

### Information hierarchy

- overview/state before editing;
- status badges describe backend-returned state, never frontend guesses;
- compact metrics are preferred to oversized dashboard cards on dense operational screens;
- search/filter controls should look and behave consistently;
- empty states should explain what the user can do next.

### Contextual `(i)` help

Add help only when the screen contains a non-obvious rule, ownership boundary or workflow. Do not add an icon merely because a page has a title.

Canonical route decisions are in `docs/ADMIN_UI_POLISH_AUDIT.md`.

## Backend / product boundaries

The UI pass must **not**:

- reproduce Fluid/Magento authorization;
- add client-side purchasing, catalogue, pricing or credit business rules;
- turn read-only OGL/credit/pricing surfaces into write surfaces;
- change company-user Portal behaviour;
- use REST shortcuts instead of the accepted GraphQL contracts;
- conflate company users/buyers with beneficiary Employees.

If UI work reveals a missing legitimate capability, record it separately and extend `Css/Commerce/**` first under the project’s backend golden rule.

## Update discipline

After each Admin UI polish PR:

1. update the relevant phase checkbox/status here;
2. add the merged PR number and a short outcome;
3. record any intentionally deferred item;
4. keep runtime acceptance separate from source-level completion;
5. do not mark a phase complete until the real application passes `yarn lint`, `yarn typecheck`, `yarn build` and the relevant browser/runtime checks.
