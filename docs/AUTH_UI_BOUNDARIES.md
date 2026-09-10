# Authentication and UI boundaries

Last updated: 2026-09-10

This document is the canonical frontend contract for the two authenticated experiences hosted by `css_admin`.

## 1. One sign-in screen, two principals

Both Staff and Company users enter through `/login`.

The page is intentionally neutral and asks for **Email or username** plus password. It does not expose or ask the user to choose an account type.

Routing is automatic:

- email-shaped identifier -> Magento customer authentication -> `css_company_token` -> `/portal`
- non-email username -> Magento administrator authentication -> `css_admin_token` -> `/companies`

`/portal/login` is retained only as a compatibility redirect to `/login` so old bookmarks and links do not break.

The login API may still accept an explicit `mode` for backwards compatibility, but the primary UI does not send one.

## 2. Principal and UI boundaries remain separate after sign-in

### Staff / Magento administrator

- Credential: Magento administrator username + password
- Authentication: Magento admin token endpoint
- HttpOnly cookie: `css_admin_token`
- Destination: `/companies`
- Route group: `app/(admin)`
- GraphQL surface: Staff operations, principally `css_admin_*`
- UI shell: existing `AppHeader` / `AppSidebar`

The Staff/Admin UI is the management baseline. Company Portal UI work must not restyle or repurpose its shell.

### Company user

- Credential: Magento customer email address + password
- Authentication: Magento customer token endpoint
- HttpOnly cookie: `css_company_token`
- Destination: `/portal`
- Route group: `app/(portal)`
- GraphQL surface: customer/company operations such as `css_company_context`, `css_company_admin`, employee, catalogue and purchase-control contracts
- UI shell: `components/portal/Portal*`

Company Portal navigation is capability-driven. The frontend only renders routes/actions that Fluid authorizes and direct-route access must still fail closed at the backend.

## 3. Automatic authentication routing

`POST /api/auth/login` receives the identifier and password from the shared sign-in screen:

```json
{
  "login": "customer@example.com",
  "password": "..."
}
```

or:

```json
{
  "login": "admin-username",
  "password": "..."
}
```

Email-shaped identifiers use Magento customer authentication. Other identifiers use Magento administrator authentication. This intentionally restores the shared-login behavior that existed before the temporary split-sign-in experiment.

If the business later needs Magento administrator usernames that are email-shaped, revisit this routing rule explicitly rather than silently attempting both credential endpoints.

## 4. Session isolation

`setAdminToken()` clears the company token and `setCompanyToken()` clears the admin token. Only one principal is active in a browser session at a time.

Route boundaries are independent:

- `app/(admin)/layout.tsx` requires `css_admin_token` and redirects to `/login` when absent.
- `app/(portal)/layout.tsx` requires `css_company_token` and redirects to `/login` when absent.

A customer token must never be promoted into Staff/Admin behavior. A Magento admin token must never be used to impersonate a company user.

## 5. Logout and expiry

Both authenticated surfaces return to the same sign-in page:

- logout -> `/login`
- upstream Magento HTTP 401 -> `/login?reason=expired`

The session itself remains principal-specific before it is cleared.

## 6. UI ownership

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

### Shared sign-in files

The one neutral sign-in experience is owned by:

- `app/login/page.tsx`
- `components/login-form.tsx`
- `components/login-page.module.css`

It may be visually customer-friendly while remaining neutral about which principal will be authenticated.

## 7. Acceptance checklist for auth/UI changes

Run:

```bash
yarn lint
yarn typecheck
yarn build
```

Then verify on the real environment:

1. `/login` accepts a Magento customer email and lands on `/portal`.
2. `/login` accepts a Magento administrator username and lands on `/companies`.
3. `/portal/login` redirects to `/login`.
4. Company logout returns to `/login`.
5. Admin logout returns to `/login`.
6. Expired customer token returns to `/login?reason=expired`.
7. Expired admin token returns to `/login?reason=expired`.
8. `/companies` cannot use the customer session.
9. `/portal` cannot use the admin session.
10. Existing Staff/Admin navigation and visuals are unchanged by Portal UI work.
11. Portal navigation still follows Fluid-returned capabilities.
