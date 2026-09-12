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

## 🟡 Phase 3 — Interaction consistency: Users & roles + Employees

This is the **next focused implementation block**.

### Users & roles

Target interaction model:

- move **Add user** into a modal rather than an expanding page panel;
- move **Create role** into a modal;
- move **Edit user** into a focused modal opened from the row action;
- move **Edit role** into a focused modal for manageable roles;
- keep protected roles read-only and clearly labelled;
- standardise row actions with Lucide icons and right-aligned action affordances;
- keep search/role filters compact and consistent with other Admin workspaces;
- keep effective-access pills visible in the list, but move detailed editing out of the table flow;
- make Remove user / Delete role low-emphasis destructive actions that open explicit confirmation UI;
- preserve all existing server actions, GraphQL operations, ACL enforcement and redirect/session behaviour.

### Employees

Target interaction model:

- move **Add employee** into a modal;
- move **Edit employee** into a focused modal from the directory row;
- retain **View order history** as a separate reporting/history flow rather than forcing it into the edit modal;
- use consistent Lucide actions for Edit, History and Deactivate;
- make deactivation visually secondary with a clear consequence message;
- preserve employee filters, reporting date range, CSV import/export and backend-owned immutable order attribution;
- keep Employee identity distinct from company-user/buyer identity.

### Phase 3 acceptance

- no GraphQL or backend changes;
- no change to form field names or server-action payloads unless required solely for UI state restoration;
- keyboard focus returns to the invoking row/action after modal close;
- Escape and explicit Close/Cancel work consistently;
- modal forms remain usable at narrow widths and 200% zoom;
- filter/search state is preserved when practical;
- destructive confirmation stays explicit;
- run `yarn lint`, `yarn typecheck`, `yarn build` and live Admin regression.

## ⬜ Phase 4 — Policy/configuration interactions

### Catalogue policy

- retain Company / Role tabs and backend-authoritative boundaries;
- consider modal editing where it reduces long inline forms without hiding effective catalogue state;
- standardise role row actions and editor headings;
- keep category/product independence explicit;
- keep large category/product pickers viewport-bounded.

### Payment configuration

- standardise policy cards and save hierarchy;
- keep Platform default / All / Specific modes easy to distinguish;
- use modal/help only for configuration semantics that are not obvious from the page;
- never duplicate checkout/payment eligibility logic in the UI.

### Company settings

- keep Company data read-only, Local settings editable, Danger zone isolated;
- standardise tabs and destructive confirmation;
- reduce visual competition between synced/OGL-owned identity fields and editable local configuration.

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

Do **not** put long operational history, queues, reports or large browsing experiences into a modal just for consistency.

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
