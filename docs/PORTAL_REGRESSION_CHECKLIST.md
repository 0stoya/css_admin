# Company Portal regression checklist

Use this checklist before treating a Company Portal UI or behaviour change as production-accepted.

The Portal and Staff/Admin products share one `/login` entry point, but their sessions, routes and GraphQL authorities remain separate. Portal acceptance must therefore include both Company-user journeys and a representative Staff/Admin regression.

## 1. Build gate

Run from `css_admin`:

```bash
yarn lint
yarn typecheck
yarn build
```

Required:

- lint exits with zero errors;
- TypeScript exits successfully;
- the production build completes successfully;
- `/portal`, `/portal/company-profile`, `/portal/employees`, `/portal/catalog` and `/portal/purchase-controls` are present where expected;
- existing `@next/next/no-img-element` warnings for backend-supplied presentation images may still be reported, but no new lint error is accepted.

## 2. Shared sign-in and session boundary

### Company user

1. Open `/login`.
2. Sign in with a Magento customer email assigned to a Fluid company.
3. Confirm redirect to `/portal`.
4. Confirm the customer session cannot be used to access Staff `/companies` routes.
5. Sign out and confirm return to `/login`.
6. Expire or invalidate the customer token and confirm the session-expired path returns cleanly to `/login`.

### Staff / Magento administrator

1. Open `/login`.
2. Sign in with a Magento administrator username.
3. Confirm redirect to `/companies`.
4. Confirm the admin session is not treated as a Company Portal session.
5. Sign out and confirm return to `/login`.

## 3. Company administrator profile

Using a Company administrator with all available management capabilities:

### Dashboard and profile

- selected company name/reference/status are correct;
- multi-company switcher changes the selected Fluid company when applicable;
- service cards match backend capabilities;
- Company profile renders company details and presentation content;
- account-manager contacts appear only when the backend allows them;
- Users/Roles management still honours protected company-admin and protected-role rules.

### Employees

- employee configuration reads correctly;
- Add employee modal opens, closes with Escape/X/backdrop, and creation persists;
- Manage modal opens the correct employee and update/deactivate still persist;
- employee search/status/date filters and pagination work;
- CSV import/export/template links still work;
- spend totals and employee order history match backend data.

### Catalogue

- company catalogue status matches Fluid;
- Edit catalogue modal saves and reloads the same company policy;
- role selection uses only backend-returned control roles;
- category/product restrictions cannot broaden the company catalogue;
- Remove restriction restores inheritance correctly;
- effective-product search/pagination matches backend-authorized access.

### Purchase controls

- Templates / Assignments / Allowances / History switch independently;
- Create and Manage template modals preserve rule editing;
- Apply to assigned users still requires explicit overwrite confirmation;
- Reset usage counters still requires explicit confirmation;
- delete remains blocked while assigned and requires the exact template name;
- role assignment supports assign/unassign and optional immediate apply;
- allowance and history searches return unchanged backend data.

## 4. Limited / view-only Company user

Where a suitable Fluid role exists:

- navigation contains only authorized areas;
- direct restricted routes fail closed rather than revealing write controls;
- Employees shows Details rather than Manage when only view access exists;
- Purchase controls hides Assignments and all mutation controls when manage access is absent;
- role/company-admin protected operations remain unavailable;
- no frontend-only permission guess grants access the backend did not return.

## 5. No-management-capability Company user

Using a company member without the relevant management capability:

- `/portal` remains usable for the selected company context;
- unavailable management areas are absent from navigation/service cards;
- direct visits to protected management pages render a restricted/unavailable state or are rejected by Fluid;
- the user never gains access to `css_admin_*` operations.

## 6. Multi-company regression

Where the customer belongs to more than one company:

1. Switch from company A to company B.
2. Confirm dashboard identity changes.
3. Confirm Employees, Catalogue and Purchase Controls all follow company B.
4. Confirm role/template/user/employee data from company A is not shown or writable in company B.
5. Switch back and confirm the original context is restored correctly.

## 7. Keyboard and accessibility pass

- pressing Tab from the top of a Portal page reveals `Skip to main content`;
- activating the skip link moves focus to the main content target;
- header, sidebar, buttons, links, fields and summaries have a visible keyboard focus indicator;
- every Portal modal receives focus when opened and keeps keyboard interaction inside the native modal dialog;
- Escape closes a modal;
- the X close control is keyboard reachable;
- focus returns sensibly to the invoking control after modal close;
- loading state announces that the Company Portal is loading;
- unexpected route errors present retry and Company overview recovery actions;
- no essential meaning depends only on colour.

## 8. Responsive pass

Check at minimum around 1440px, 1024px, 768px and 360–390px widths.

- desktop sidebar remains sticky without covering content;
- at tablet/mobile widths navigation becomes horizontally scrollable and every authorized item remains reachable;
- active navigation remains visually clear;
- header logo and Sign out do not collide on narrow screens;
- cards and data rows do not force page-level horizontal scrolling;
- modal content scrolls inside the viewport and the close button remains reachable;
- destructive confirmation controls remain usable on mobile.

## 9. Staff/Admin regression

After Portal acceptance, sign in as Staff and spot-check:

- `/companies`;
- one `/companies/[id]` overview;
- `/companies/[id]/employees`;
- `/companies/[id]/catalog`;
- `/companies/[id]/purchase-controls`;
- `/ogl` or another Staff-only route.

Confirm navigation, styling and core actions remain unchanged. A Portal-only PR should not need to modify `app/(admin)/**`, `components/app-header.tsx`, `components/app-sidebar.tsx`, or Staff workspace styles.

## Acceptance record

For a production release, record:

- commit/PR tested;
- Fluid/Magento environment;
- Company-admin account profile used;
- limited/no-capability profiles used where available;
- viewport coverage;
- `yarn lint`, `yarn typecheck`, `yarn build` result;
- any known non-blocking warnings;
- any skipped profile and why it was unavailable.
