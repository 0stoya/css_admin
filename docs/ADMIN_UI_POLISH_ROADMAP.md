# Admin UI polish roadmap

Last updated: 2026-09-12

This is the live tracker for the **Staff / Magento-admin** UI polish pass in `css_admin`.

It is intentionally separate from the functional product roadmap. Fluid/Magento remains authoritative for permissions, company scope, purchasing policy, pricing, credit, catalogue eligibility and every mutation outcome. Company Portal (`app/(portal)`) is a separate UI surface and is out of scope unless explicitly stated.

## Status legend

- ✅ **Complete** — merged into `main`; deployed/runtime acceptance recorded where applicable.
- 🟡 **Active** — current focused implementation block.
- ⬜ **Planned** — agreed direction, not implemented yet.
- 🔎 **Final acceptance** — cross-workspace accessibility/responsive regression after the focused passes.

## Current position

### ✅ Phase 0 — UI / UX foundation

Established before this pass:

- CSS Commerce brand tokens, typography, buttons, fields, cards, badges and notices;
- Admin shell, company context and company sidebar;
- responsive operational content width and visible keyboard focus;
- company directory/overview hierarchy;
- specialised Users/Roles, Catalogue, commercial, OGL and Credit-order layouts;
- Company Portal kept as a separate authenticated UI surface.

Reference: `docs/ui-ux-foundation.md`.

### ✅ Phase 1 — Purchase-control UX hardening and polish

Completed through PRs **#69–#71**:

- clearer quantity-allowance management feedback and affected-buyer reporting;
- Lucide help/edit modals;
- compact metrics, quieter operations and stronger rule hierarchy;
- specialist help for buyer allowances, periods, resets and retained history.

Purchase Controls remains the reference pattern for focused Admin editing: state first, edit in a modal when appropriate, destructive actions secondary, backend decisions authoritative.

### ✅ Phase 2 — Admin visual system and contextual help

**PR #72 merged.**

Completed:

- Lucide icons across Admin navigation;
- consistent Admin-only headings, cards, tables, searches and notices;
- selective route-aware `(i)` help for policy, identity, source-of-truth and workflow semantics;
- decisions recorded in `docs/ADMIN_UI_POLISH_AUDIT.md`;
- no generic help on Companies, Overview, Purchase Controls or Company Portal.

### ✅ Phase 3 — Users & roles + Employees interaction consistency

**PR #74 merged, deployed and visually accepted.**

Completed:

- Add/Edit User, Create/Edit Role and Add/Edit Employee use focused Admin action modals;
- protected roles remain read-only;
- Employee History stays a separate reporting flow;
- Lucide row actions and quieter destructive actions are consistent;
- practical filter/search/page state is retained around modal errors;
- GraphQL payloads, Fluid ACL decisions and Employee-vs-buyer semantics are unchanged.

### ✅ Phase 4 — Catalogue, Payment and Company settings

**PR #75 merged, deployed and visually accepted. PR #76 followed with the deployed Payment save-button contrast fix.**

Completed:

- Catalogue policy uses clearer tab/status/search/restriction/save hierarchy while retaining backend-authoritative Company/Role boundaries;
- large catalogue pickers remain full-width;
- Payment configuration uses the shared Lucide language, clearer Default/All/Specific choices, better selection feedback and pending-save protection;
- Company settings cleanly separates OGL-owned read-only identity, Magento-local settings and destructive lifecycle controls;
- long configuration forms remain full-width when width and scanning context matter;
- no GraphQL, server-action, ACL or backend-rule changes.

### ✅ Phase 5 — Commercial and operational surfaces

**PR #77 merged, deployed and visually accepted.**

Completed:

- Company Credit has denser Credit limit / Used / Available hierarchy and clearer read-only/source-of-truth treatment;
- Pricing makes OGL custom pricing vs Magento fallback obvious while keeping import health secondary;
- Finance uses denser metrics, stronger OGL provenance and a clearer definition of “spend”;
- Credit Orders has cleaner filters/rows/tabs, stronger acting-company-user context and clearer lifecycle disclosures;
- queues, reports, history and lifecycle forms remain in-page;
- Credit Order actions are still rendered only from Fluid-returned `can_*` decisions for the selected real company user.

Runtime acceptance confirmed the deployed Phase 5 presentation across the Admin application.

## 🟡 Phase 6 — OGL + import workflows

This is the **active focused implementation block**.

The interaction goal is operational confidence: make source ownership obvious, make registry/mapping actions easier to scan, and make **Choose → Preview → Apply** unmistakable without changing any import contract.

### OGL administration

- keep Companies / Rep mappings as the primary operational tabs;
- strengthen connection/import health and source-of-truth presentation;
- tighten registry filters, row actions and selected-company preview hierarchy;
- make live OGL preview visibly distinct from cached Magento company data;
- keep sync eligibility, importability, rep mappings and overrides backend-authoritative;
- keep destructive or state-changing actions visually secondary unless they are the task’s explicit primary action.

### Representative profiles

- make mapped Admin identity, rep code, affected-company count and card visibility easier to scan;
- make profile editing feel like a focused configuration surface rather than a loose form;
- align Save / Upload photo / Remove photo actions with the shared Admin action language;
- keep profile data presentation-only: it must never change which Magento administrator an OGL rep code maps to.

### Bulk import + company Import / export

- make **Choose → Preview → Apply** the dominant workflow hierarchy;
- strengthen active/completed step treatment;
- standardise download, preview and apply affordances;
- make preview counts and row results easier to scan without reducing row-level detail;
- visually isolate the Apply stage after a clean preview;
- keep Apply guarded when preview has errors or no actionable rows;
- preserve exact `company_ref` / `company_reference` routing and safety semantics;
- keep single-company and multi-company workspaces visually consistent while retaining their different routing rules.

### Phase 6 acceptance

- presentation/CSS-first changes only; no GraphQL, server-action, ACL or backend changes;
- OGL remains the source of truth for onboarding and representative assignment;
- representative profile data stays presentation-only;
- Preview remains mandatory before Apply;
- Apply remains disabled for preview errors or zero actionable changes;
- company_ref/company_reference routing semantics remain unchanged;
- check OGL enabled/disabled, importable/unavailable and imported/not-imported states;
- check rep profile visible/hidden, active/inactive Admin and photo/no-photo states;
- check all bulk-import datasets and all company-scoped import datasets;
- check 200% zoom, narrow widths, keyboard focus and Company Portal smoke regression;
- run focused Phase 6 source checks plus `yarn lint`, `yarn typecheck`, `yarn build` and live Admin regression.

## 🔎 Phase 7 — Final Admin accessibility and responsive pass

Run after Phase 6 so fixes are not repeatedly invalidated.

Check:

- keyboard-only navigation and visible focus;
- modal focus restoration and Escape/Close/Cancel behaviour;
- 200% browser zoom;
- 360–390px mobile and tablet widths;
- long company/product/user/role names;
- dense table overflow;
- empty, error and loading-state consistency;
- destructive-action labelling;
- reduced-motion behaviour;
- route/session-expiry recovery;
- representative Company Portal smoke regression proving Admin-only polish did not leak across the auth/UI boundary.

## Shared interaction rules

### Modal use

Use a modal for focused create/edit/confirmation tasks where retaining list/overview context helps. Do not move long queues, reports, history, large browsing experiences or long configuration/import flows into modals merely for consistency.

### Actions

- one obvious primary action per task;
- secondary actions stay visually quieter;
- destructive actions remain explicit and confirmed;
- row actions use a consistent right-side action area;
- icons improve scanning rather than decorate every label.

### Information hierarchy

- overview/state before editing;
- status badges describe backend-returned state, never frontend guesses;
- dense operational screens favour compact metrics over oversized dashboard cards;
- search/filter controls should look and behave consistently;
- empty states should explain what can happen next.

### Contextual `(i)` help

Add help only for non-obvious rules, ownership boundaries or workflows. Canonical route decisions remain in `docs/ADMIN_UI_POLISH_AUDIT.md`.

## Backend / product boundaries

The UI pass must **not**:

- reproduce Fluid/Magento authorization;
- add client-side purchasing, catalogue, pricing, credit or import business rules;
- turn read-only OGL/credit/pricing surfaces into unsupported write surfaces;
- change Company Portal behaviour;
- use REST shortcuts instead of accepted GraphQL contracts;
- conflate company users/buyers with beneficiary Employees.

If UI work reveals a legitimate missing capability, record it separately and extend `Css/Commerce/**` first under the project backend golden rule.

## Update discipline

After each Admin UI polish PR:

1. update the relevant phase status here;
2. add the merged PR number and outcome;
3. record intentionally deferred items;
4. keep runtime acceptance separate from source completion;
5. do not mark a phase complete until the real application passes `yarn lint`, `yarn typecheck`, `yarn build` and relevant browser/runtime checks.
