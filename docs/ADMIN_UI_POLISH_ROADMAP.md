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

## 🟡 Phase 4 — Policy/configuration interactions

This is the **active focused implementation block**.

A deliberate interaction choice for this phase: large catalogue pickers and long company-local configuration forms stay in the page flow rather than being moved into modals merely for consistency. They need width, scanning context and long-form usability. Compact create/edit tasks continue to use modals where appropriate.

### Catalogue policy

- retain Company / Role tabs and backend-authoritative boundaries;
- standardise tab, status-card, row-action, search and save hierarchy with the wider Admin visual language;
- keep company and role editors collapsible/full-width rather than squeezing category/product browsing into a modal;
- make edit/restriction/reset actions easier to scan with Lucide-style affordances;
- keep category/product independence explicit;
- keep large category/product pickers viewport-bounded;
- keep effective-product verification secondary to the actual policy editor.

### Payment configuration

- standardise policy cards and save hierarchy;
- replace bespoke mode glyphs with the installed Lucide icon language;
- keep Platform default / All / Specific modes easy to distinguish;
- improve search/select/clear affordances and selection feedback;
- add pending save feedback to prevent accidental repeat submits;
- use modal/help only for configuration semantics that are not obvious from the page;
- never duplicate checkout/payment eligibility logic in the UI.

### Company settings

- keep Company data read-only, Local settings editable, Danger zone isolated;
- standardise tabs with clear data/local/danger iconography;
- make synced/OGL-owned identity and hierarchy source-of-truth blocks easier to scan;
- use compact summary cards rather than one heavy strip;
- keep the long Local settings form full-width and give its save action the same sticky operational treatment as Payment configuration;
- quieten the Danger zone surface while retaining exact-reference destructive confirmation.

### Phase 4 acceptance

- no GraphQL schema, server-action or backend changes;
- no change to the meaning of catalogue, payment or company-setting form fields;
- large policy editors remain usable at 200% zoom and narrow widths;
- payment save visibly enters a pending state;
- destructive company deletion remains explicitly confirmed and backend-authoritative;
- run focused policy-polish tests plus `yarn lint`, `yarn typecheck`, `yarn build` and live Admin regression.

## ⬜ Phase 5 — Commercial and operational surfaces

### Company credit

- refine metric/action hierarchy without turning read-only credit data into editable controls;
- keep credit-limit / used / available / over-limit policy semantics explicit;
- align links into Credit orders with the shared action language.

### Pricing

- standardise search/filter/pagination and product identity cells;
- keep OGL custom price vs Magento fallback source highly visible;
- preserve read-only behaviour and tier-price clarity.

### Finance

- align metric-card proportions and source/provenance treatment;
- keep “spend” definition and OGL source unambiguous;
- preserve dense operational chart readability.

### Credit orders

- align queue filters, row actions, status badges and detail tabs;
- keep selected acting company user prominent because authorization is actor-specific;
- standardise lifecycle action disclosures/confirmations;
- never expose actions that Fluid does not return as authorized.

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
