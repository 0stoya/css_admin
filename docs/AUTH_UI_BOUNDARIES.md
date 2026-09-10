# Authentication and UI boundaries

Last updated: 2026-09-10

This document is the canonical frontend contract for the two authenticated experiences hosted by `css_admin`.

## 1. Two principals, two entry points

### Staff / Magento administrator

- Sign-in URL: `/login`
- Identifier: Magento administrator **username**
- Authentication: Magento admin token endpoint
- HttpOnly cookie: `css_admin_token`
- Destination: `/companies`
- Route group: `app/(admin)`
- GraphQL surface: Staff operations, principally `css_admin_*`
- UI shell: existing `AppHeader` / `AppSidebar`

The Staff/Admin UI is the current management baseline. Company Portal UI work must not restyle or repurpose its shell.

### Company user

- Sign-in URL: `/portal/login`
- Identifier: Magento customer **email address**
- Authentication: Magento customer token endpoint
- HttpOnly cookie: `css_company_token`
- Destination: `/portal`
- Route group: `app/(portal)`
- GraphQL surface: customer/company operations such as `css_company_context`, `css_company_admin`, employee, catalogue and purchase-control contracts
- UI shell: `components/portal/Portal*`

Company Portal navigation is capability-driven. The frontend only renders routes/actions that Fluid authorizes and direct-route access must still fail closed at the backend.

## 2. Explicit authentication mode

`POST /api/auth/login` requires a mode supplied by the UI:

```json
{
  "mode": "admin",
  "login": "admin-username",
  "password": "..."
}
```

or:

```json
{
  "mode": "company",
  "login": "customer@example.com",
  "password": "..."
}
```

Do not reintroduce identifier-shape inference (`@` means customer, otherwise admin). Explicit mode avoids ambiguity for administrator usernames that contain an email address and keeps the security boundary visible in code review.

## 3. Session isolation

`setAdminToken()` clears the company token and `setCompanyToken()` clears the admin token. Only one principal is active in a browser session at a time.

Route boundaries are independent:

- `app/(admin)/layout.tsx` requires `css_admin_token` and redirects to `/login` when absent.
- `app/(portal)/layout.tsx` requires `css_company_token` and redirects to `/portal/login` when absent.

A customer token must never be promoted into Staff/Admin behavior. A Magento admin token must never be used to impersonate a company user.

## 4. Logout and expiry destinations

Staff/Admin:

- logout -> `/login`
- upstream Magento HTTP 401 -> `/login?reason=expired`

Company Portal:

- logout -> `/portal/login`
- upstream Magento HTTP 401 -> `/portal/login?reason=expired`

The shared route handlers accept `mode=company` for the Company Portal destination. The existing admin shell continues to call the handlers without a mode, preserving Staff behavior.

## 5. UI ownership

### Admin-owned files

Treat these as Admin UI unless a change is explicitly intended for Staff:

- `app/(admin)/**`
- `components/app-header.tsx`
- `components/app-sidebar.tsx`
- Admin workspace CSS files under `app/*.css`

### Portal-owned files

New Company Portal presentation work belongs under:

- `app/(portal)/**`
- `components/portal/**`
- Portal-specific CSS modules

The Company Portal may reuse brand tokens from `app/globals.css`, but visual changes should prefer Portal CSS modules instead of modifying shared global selectors. This is the visual firewall that lets the customer experience evolve without changing the Magento-admin view.

## 6. Acceptance checklist for auth/UI changes

Run:

```bash
yarn lint
yarn typecheck
yarn build
```

Then verify on the real environment:

1. `/login` accepts a Magento admin username and lands on `/companies`.
2. `/portal/login` accepts a Magento customer email and lands on `/portal`.
3. Company logout returns to `/portal/login`.
4. Admin logout returns to `/login`.
5. Expired company token returns to `/portal/login?reason=expired`.
6. Expired admin token returns to `/login?reason=expired`.
7. `/companies` cannot use the customer session.
8. `/portal` cannot use the admin session.
9. Existing Staff/Admin navigation and visuals are unchanged by Portal shell work.
10. Portal navigation still follows Fluid-returned capabilities.
