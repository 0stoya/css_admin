# Admin UI polish roadmap

Last updated: 2026-09-12

This is the live tracker for the **Staff / Magento-admin** UI polish pass in `css_admin`.

It is intentionally separate from the functional product roadmap. Fluid/Magento remains authoritative for permissions, company scope, purchasing policy, pricing, credit, catalogue eligibility and every mutation outcome. Company Portal (`app/(portal)`) is a separate UI surface and remains out of scope unless explicitly stated.

## Status legend

- ✅ **Complete** — merged into `main`; deployed/runtime acceptance recorded where applicable.
- 🟡 **Active** — current focused implementation block.
- ⬜ **Planned** — agreed direction, not implemented yet.

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
- no GraphQL, server-action, ACL or backend-rule changes.

### ✅ Phase 5 — Commercial and operational surfaces

**PR #77 merged, deployed and visually accepted.**

Completed:

- Company Credit has denser Credit limit / Used / Available hierarchy and clearer read-only/source-of-truth treatment;
- Pricing makes OGL custom pricing vs Magento fallback obvious while keeping import health secondary;
- Finance uses denser metrics, stronger OGL provenance and a clearer definition of “spend”;
- Credit Orders has cleaner filters/rows/tabs, stronger acting-company-user context and clearer lifecycle disclosures;
- Credit Order actions are still rendered only from Fluid-returned `can_*` decisions for the selected real company user.

### ✅ Phase 6 — OGL + import workflows

**PR #78 merged and deployed. PR #80 landed the final Representative profiles / Companies / Company overview cleanup and fixed the Admin lint blockers found during real-server validation.**

Completed:

- OGL Companies / Rep mappings use stronger source-of-truth and operational health presentation;
- Live OGL preview is visually distinct from Magento company state;
- Representative profiles have clearer rep identity, profile controls and media actions while remaining presentation-only;
- Bulk import and company Import / export make **Choose → Preview → Apply** the dominant workflow;
- preview/apply guardrails and `company_ref` / `company_reference` routing are unchanged;
- Companies and Company overview received a final density/hierarchy cleanup;
- real-server `yarn lint`, typecheck/build validation was green after #80.

No GraphQL, ACL or backend business rules changed during this phase.

## 🟡 Phase 7 — Final Admin accessibility and responsive hardening

This is the **active final Admin UI block**.

The goal is not another redesign. It is to make the now-consistent Admin interface robust under keyboard-only use, browser zoom, narrow viewports, long content and accessibility preferences.

### Navigation and focus

- add a keyboard-visible **Skip to main content** link;
- make the main content a reliable skip-link focus target;
- keep the full company/OGL/import local navigation reachable when the desktop sidebar collapses;
- collapse the desktop sidebar earlier so 200% zoom does not squeeze operational content into an unusable column;
- retain visible focus and `aria-current` state throughout navigation.

### Responsive and content resilience

- support 200% browser zoom and approximately 360–390px mobile widths;
- keep cards/forms/table wrappers shrinkable with `min-width: 0` where appropriate;
- allow long names, references, status text and errors to wrap instead of forcing horizontal page overflow;
- preserve intentional horizontal scrolling inside dense tables/pickers rather than the whole page;
- keep action rows usable when labels wrap.

### Motion and high-contrast preferences

- honor `prefers-reduced-motion` across Admin transitions/animations;
- retain focus and surface boundaries under forced-colour/high-contrast modes;
- do not remove state indicators that are conveyed by text/badges as well as colour.

### Modal and workflow regression

- verify native dialog focus containment/restoration;
- verify Escape, Close and Cancel behavior, including pending-save protection;
- verify route/session-expiry recovery still rethrows navigation rather than converting redirects to inline mutation errors;
- keep destructive confirmations explicit.

### Phase 7 acceptance

Before marking the Admin UI pass complete:

- `yarn lint` passes with no errors;
- `yarn typecheck` passes;
- `yarn build` passes;
- focused Phase 7 source tests pass;
- keyboard-only navigation reaches top-level and local company/OGL/import navigation;
- skip-link focus lands on the main Admin content;
- modal focus returns to its trigger after close;
- 200% zoom remains usable on Companies, Overview, Users/Roles, Employees, Purchase Controls, Payment, Credit Orders, OGL and imports;
- 360–390px widths do not create page-level horizontal overflow;
- long company/product/user/role names remain readable;
- reduced-motion and forced-colour checks are acceptable;
- representative Company Portal smoke regression confirms Admin-only styles did not leak across the auth/UI boundary.

When those checks pass on the deployed application, mark **Phase 7 complete** and the Admin UI polish programme complete.

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
