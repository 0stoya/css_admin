# Company Portal UI roadmap

Last updated: 2026-09-12

## Cross-product status

The **Staff / Magento-admin UI polish programme is complete through PR #81** and is now the stable management baseline. See [`ADMIN_UI_POLISH_ROADMAP.md`](ADMIN_UI_POLISH_ROADMAP.md).

Company Portal remains a separate authenticated product surface. Completion of the Admin pass does **not** reopen Portal styling or make Admin patterns automatically applicable to customer-facing screens.

The next agreed functional candidate across the wider product is stacked purchase allowances for the same logical product (for example, 10 within 365 days **and** 2 within 30 days). That is a backend capability first and is not a Portal-only UI task.

## Product boundary

`css_admin` hosts two authenticated products behind one shared sign-in screen:

- **Staff / Magento Admin**: admin token, `app/(admin)/**`, completed Admin UI baseline.
- **Company Portal**: customer token, `app/(portal)/**`, customer-facing UI.

The sign-in screen may be shared, but the authenticated UI surfaces are intentionally separate. Portal presentation work must not restyle or repurpose the Admin shell.

Authentication, company scope, catalogue eligibility, employee access, purchase controls and management capabilities remain authoritative in Fluid/Magento. The Portal UI only presents functions the backend authorizes.

## Baseline already accepted

- [x] one shared `/login` entry point;
- [x] email-shaped login -> Magento customer authentication -> `/portal`;
- [x] non-email username -> Magento administrator authentication -> `/companies`;
- [x] separate HttpOnly admin/customer sessions;
- [x] separate Admin and Portal route guards;
- [x] dedicated `components/portal/**` shell so Portal styling cannot accidentally redesign Admin;
- [x] capability-driven Portal navigation.

See [`AUTH_UI_BOUNDARIES.md`](AUTH_UI_BOUNDARIES.md) for the authentication and ownership contract.

## Portal UI refinement

### Phase 1 — dashboard and company profile

Goal: turn the acceptance-oriented company management landing page into a customer-facing B2B account dashboard without removing existing management capability.

- [x] company-first landing hero;
- [x] compact multi-company switcher;
- [x] capability-driven service cards;
- [x] simple account summary rather than a raw capability matrix;
- [x] users/roles management retained lower in the page;
- [x] detailed permissions moved into a secondary `Your access` disclosure;
- [x] company profile reorganized around company identity, contact details and account manager;
- [x] responsive desktop/tablet/mobile layouts;
- [x] Portal-only CSS modules; no Admin workspace restyling.

Runtime acceptance completed on the deployed environment.

### Phase 2 — Employees

- [x] customer-facing page hierarchy and copy;
- [x] clearer employee summary, settings and data actions;
- [x] improved create/edit/deactivate presentation;
- [x] Add employee and Manage/Details use reusable Portal modals;
- [x] clearer spend reporting and date filtering;
- [x] responsive employee and order-history rows;
- [x] Portal-only employee stylesheet so Admin employee presentation remains unchanged;
- [x] preserve Fluid employee ACL and write validation exactly.

Runtime acceptance completed on the deployed environment.

### Phase 3 — Catalogue

- [x] customer-facing Catalogue hierarchy and company boundary summary;
- [x] separate company-wide catalogue policy from role-level visibility;
- [x] move company, role-category and role-product editing into reusable Portal modals;
- [x] simplify the page to company boundary -> optional role restriction -> product-access verification;
- [x] improve category/product restriction summaries and empty states;
- [x] retain effective-product search/pagination for verification;
- [x] responsive role/product layouts;
- [x] Portal-only catalogue stylesheet; no Admin catalogue restyling;
- [x] retain Fluid-backed catalogue search, validation and authorization boundaries.

Runtime acceptance completed on the deployed environment.

### Phase 4 — Purchase controls

- [x] customer-focused template and allowance overview;
- [x] focused Templates / Assignments / Allowances / History workspaces so only one task is visible at a time;
- [x] Create template, Manage template and Change assignment use reusable Portal modals;
- [x] clearer role assignment state, current allowances and consumption history;
- [x] responsive template, allowance and history presentation;
- [x] preserve view-only vs manage capabilities;
- [x] keep apply/reset/delete confirmations and backend validation unchanged;
- [x] Portal-only purchase-control stylesheet; no Admin purchase-control restyling.

Runtime acceptance completed on the deployed environment.

### Phase 5 — Portal-wide polish and regression

Implementation:

- [x] add a Portal route-level loading state;
- [x] add a Portal route-level error boundary with retry and Company overview recovery;
- [x] add a keyboard-visible skip link and explicit main-content focus target;
- [x] strengthen keyboard focus treatment across Portal navigation and interactive controls;
- [x] harden the horizontal tablet/mobile navigation and small-screen header layout;
- [x] improve modal focus visibility, close-target size, scroll containment and reduced-motion behaviour;
- [x] keep all polish scoped to `app/(portal)/**` and `components/portal/**` apart from documentation;
- [x] add a permanent live regression checklist.

Runtime acceptance remains the outstanding Portal-wide gate:

- [ ] execute the Company administrator profile;
- [ ] execute a limited/view-only Company user profile where available;
- [ ] execute a Company user without each management capability being exercised;
- [ ] execute multi-company switching where available;
- [ ] check desktop, tablet and narrow/mobile navigation and modal journeys;
- [ ] run production `yarn lint`, `yarn typecheck` and `yarn build` for the Portal acceptance slice;
- [ ] confirm representative Staff/Admin routes remain visually and functionally unchanged.

Use [`PORTAL_REGRESSION_CHECKLIST.md`](PORTAL_REGRESSION_CHECKLIST.md) as the acceptance gate for this phase and future Portal UI changes.

## Non-goals

Portal UI work must not:

- change `app/(admin)/**` purely for visual consistency;
- make customer tokens call `css_admin_*` operations;
- duplicate Fluid authorization rules in React;
- expose hidden routes/actions because they look useful;
- create a second REST integration path to Magento;
- weaken protected company-admin, role, employee, catalogue or purchase-control rules.

## Acceptance profiles

Each Portal UI phase should be checked with at least:

1. a Company administrator;
2. a role-authorized/view-only Company user where available;
3. a Company user without the management capability being exercised;
4. multi-company membership where available;
5. desktop and narrow/mobile viewport.
