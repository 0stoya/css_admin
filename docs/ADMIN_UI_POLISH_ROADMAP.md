# Admin UI polish roadmap

Last updated: 2026-09-12

**Status: ✅ Complete**

This document records the completed **Staff / Magento-admin** UI polish programme in `css_admin`.

Fluid/Magento remains authoritative for permissions, company scope, purchasing policy, pricing, credit, catalogue eligibility and every mutation outcome. Company Portal (`app/(portal)`) remains a separate authenticated UI surface with its own roadmap.

## Completion summary

The Admin UI polish programme is complete through **PR #81**.

Completed outcomes:

- consistent CSS Commerce visual system and Admin shell;
- Lucide navigation/action language and selective contextual `(i)` help;
- focused modal interactions for compact create/edit tasks;
- improved Users & roles, Employees, Catalogue, Purchase controls, Payment, Settings, Credit, Pricing, Finance and Credit orders;
- clearer OGL source-of-truth treatment and representative-profile workflows;
- clearer **Choose → Preview → Apply** import hierarchy;
- denser Companies and Company overview surfaces;
- keyboard-visible skip navigation, local-nav preservation when the sidebar collapses, 200% zoom hardening, narrow-width resilience, long-content wrapping, reduced-motion handling and forced-colour fallbacks;
- no Company Portal visual redesign, GraphQL schema change, ACL change or Magento/Fluid business-rule duplication as part of the polish pass.

## Completed phases

### ✅ Phase 0 — UI / UX foundation

Established the CSS Commerce brand tokens, typography, buttons, fields, cards, badges, notices, Admin shell, company context, sidebar, responsive content width and visible focus treatment.

Reference: [`ui-ux-foundation.md`](ui-ux-foundation.md).

### ✅ Phase 1 — Purchase-control UX hardening and polish

Completed through **PRs #69–#71**.

- clearer quantity-allowance management feedback and affected-buyer reporting;
- Lucide help/edit modals;
- compact metrics, quieter operations and stronger rule hierarchy;
- specialist help for buyer allowances, periods, resets and retained history.

Purchase Controls remains the reference interaction pattern for focused Admin editing.

### ✅ Phase 2 — Admin visual system and contextual help

Completed through **PR #72**.

- Lucide icons across Admin navigation;
- consistent Admin-only headings, cards, tables, searches and notices;
- selective route-aware `(i)` help for policy, identity, source-of-truth and workflow semantics;
- route decisions recorded in [`ADMIN_UI_POLISH_AUDIT.md`](ADMIN_UI_POLISH_AUDIT.md).

### ✅ Phase 3 — Users & roles + Employees interaction consistency

Completed through **PR #74** and deployed/runtime accepted.

- Add/Edit User, Create/Edit Role and Add/Edit Employee use focused Admin modals;
- protected roles remain read-only;
- Employee History remains a separate reporting flow;
- Lucide row actions and quieter destructive actions are consistent;
- existing GraphQL payloads, Fluid ACL decisions and Employee-vs-buyer semantics remain unchanged.

### ✅ Phase 4 — Catalogue, Payment and Company settings

Completed through **PR #75**, with **PR #76** for the Payment save-action contrast follow-up.

- clearer Catalogue policy hierarchy while retaining Company/Role boundaries;
- large catalogue pickers remain full-width;
- clearer Default / All / Specific Payment configuration;
- Company settings separates OGL-owned read-only identity, Magento-local settings and destructive lifecycle controls;
- no backend-rule changes.

### ✅ Phase 5 — Commercial and operational surfaces

Completed through **PR #77** and deployed/runtime accepted.

- denser Company Credit hierarchy;
- clearer OGL custom pricing vs Magento fallback;
- stronger Finance provenance and spend definition;
- cleaner Credit-order filters, rows, tabs, actor context and lifecycle disclosures;
- lifecycle actions remain exclusively backend/actor-authoritative.

### ✅ Phase 6 — OGL + import workflows

Completed through **PR #78**, with **PR #80** landing the final Representative profiles / Companies / Company overview cleanup and Admin lint fixes.

- stronger OGL health/source-of-truth presentation;
- clearer rep identity/profile/media actions while rep profiles remain presentation-only;
- **Choose → Preview → Apply** is the dominant import workflow;
- import guards and `company_ref` / `company_reference` routing remain unchanged;
- Companies and Company overview received their final density/hierarchy cleanup.

### ✅ Phase 7 — Final Admin accessibility and responsive hardening

Completed through **PR #81** and visually accepted on the deployed application.

- keyboard-visible **Skip to main content**;
- reliable main-content focus target;
- earlier sidebar collapse for 200% zoom;
- company/OGL/import local navigation remains available after sidebar collapse;
- long names, references, labels and status text wrap safely;
- dense tables/pickers keep contained horizontal scrolling;
- narrow-width action rows remain usable;
- `prefers-reduced-motion` is honoured across Admin polish layers;
- forced-colour/high-contrast focus/boundary fallbacks are present;
- company structure controls expose clearer accessible names and state;
- representative-profile and Personalisation media controls have clearer accessible names;
- non-critical Admin preview images use lazy loading / async decoding;
- no Portal, backend or business-rule changes were introduced.

**The Staff/Admin UI polish programme is now closed.** Future Admin UI changes should be treated as targeted product work or regression fixes rather than a continuation of this redesign pass.

## Shared interaction rules retained after completion

### Modals

Use a modal for focused create/edit/confirmation tasks where retaining list or overview context helps. Do not move long queues, reports, history, browsing experiences or long configuration/import flows into modals merely for consistency.

### Actions

- one obvious primary action per task;
- secondary actions remain visually quieter;
- destructive actions stay explicit and confirmed;
- row actions use a consistent right-side action area;
- icons improve scanning rather than decorate every label.

### Information hierarchy

- overview/state before editing;
- status badges describe backend-returned state, never frontend guesses;
- dense operational screens favour compact metrics over oversized dashboard cards;
- search/filter controls remain consistent;
- empty states should explain what can happen next.

### Contextual `(i)` help

Add help only for non-obvious rules, ownership boundaries or workflows. Canonical route decisions remain in [`ADMIN_UI_POLISH_AUDIT.md`](ADMIN_UI_POLISH_AUDIT.md).

## Backend / product boundaries

Admin UI work must not:

- reproduce Fluid/Magento authorization;
- add client-side purchasing, catalogue, pricing, credit or import business rules;
- turn read-only OGL/credit/pricing surfaces into unsupported write surfaces;
- change Company Portal behaviour for visual consistency;
- use REST shortcuts instead of accepted GraphQL contracts;
- conflate company users/buyers with beneficiary Employees.

If a UI task exposes a legitimate missing capability, implement the backend contract first under the project rule that backend changes belong in `Css/Commerce/**`.

## Next product work

The completed UI pass intentionally leaves functional gaps outside its scope. The next agreed functional candidate is **stacked purchase allowances** for the same logical product, for example:

- maximum **10 within 365 days**; and
- maximum **2 within 30 days**;
- both enforced simultaneously by Fluid/Magento rather than by browser-side arithmetic.

That capability requires backend work first in `Css/Commerce/**`, then a focused `css_admin` management UI extension.

Company Portal work remains tracked separately in [`PORTAL_UI_ROADMAP.md`](PORTAL_UI_ROADMAP.md).
