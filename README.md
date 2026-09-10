# CSS Admin

Headless CSS Commerce application for the Fluid / Magento backend.

The repository contains two deliberately separate authenticated UI surfaces behind one sign-in screen:

| Principal | Sign-in | Credential | Session | Route area | GraphQL authority |
| --- | --- | --- | --- | --- | --- |
| Chelmsford staff / Magento administrator | `/login` | Magento admin username + password | `css_admin_token` | `app/(admin)` -> `/companies`, `/ogl`, `/bulk-import` | `css_admin_*` operations |
| Company user | `/login` | Magento customer email + password | `css_company_token` | `app/(portal)` -> `/portal` | customer/company operations |

The sign-in UI is intentionally neutral. Email-shaped identifiers use Magento customer authentication and non-email usernames use Magento administrator authentication. The authenticated sessions, route boundaries and GraphQL clients remain separate after sign-in.

`/portal/login` is retained only as a compatibility redirect to `/login`.

## UI boundary

The existing Staff/Admin UI is the production management baseline and should not be restyled as part of Company Portal work.

- Staff shell: `components/app-header.tsx`, `components/app-sidebar.tsx`, `app/(admin)/**`
- Company Portal shell: `components/portal/**`, `app/(portal)/**`
- Shared sign-in screen: `app/login/**`, `components/login-form.tsx`, `components/login-page.module.css`

Company Portal navigation remains capability-driven by Fluid. A customer token must never be used for `css_admin_*` operations, and a Magento admin token must never be treated as a company-user session.

See [`docs/AUTH_UI_BOUNDARIES.md`](docs/AUTH_UI_BOUNDARIES.md) for the full authentication/ownership contract, [`docs/PORTAL_UI_ROADMAP.md`](docs/PORTAL_UI_ROADMAP.md) for the customer-facing UI refinement plan, and [`docs/PORTAL_REGRESSION_CHECKLIST.md`](docs/PORTAL_REGRESSION_CHECKLIST.md) for the live Company Portal acceptance gate.

## Stack

- Next.js App Router
- React + TypeScript
- Server Components for authenticated reads
- Plain typed `fetch` for GraphQL
- Separate HttpOnly cookies for Magento admin and customer bearer tokens

No Apollo/client cache layer is included.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set the Magento base URL and store code.
3. Run `yarn install`.
4. Run `yarn dev`.
5. Open `/login`.
6. Sign in with either a Magento customer email address assigned to a Fluid company or a Magento administrator username.

## Validation

Before merging a functional or UI slice:

```bash
yarn lint
yarn typecheck
yarn build
```

Then run the relevant live journey against the deployed Fluid GraphQL backend. Backend authorization remains authoritative.

For Company Portal work, run the profile and responsive checks in [`docs/PORTAL_REGRESSION_CHECKLIST.md`](docs/PORTAL_REGRESSION_CHECKLIST.md) before treating the slice as production-accepted.

## Backend contract

See [`docs/BACKEND_CONTRACT.md`](docs/BACKEND_CONTRACT.md).

The backend source of truth remains `0stoya/Fluid`, especially:

- `ROADMAP.md`
- `Css/Commerce/etc/schema.graphqls`
- phased/acceptance GraphQL packs under `Css/Commerce/Test/ApiFunctional`
