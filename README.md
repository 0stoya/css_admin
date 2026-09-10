# CSS Admin

Headless CSS Commerce application for the Fluid / Magento backend.

The repository now contains **two deliberately separate authenticated UI surfaces**:

| Principal | Sign-in | Credential | Session | Route area | GraphQL authority |
| --- | --- | --- | --- | --- | --- |
| Chelmsford staff / Magento administrator | `/login` | Magento admin username + password | `css_admin_token` | `app/(admin)` -> `/companies`, `/ogl`, `/bulk-import` | `css_admin_*` operations |
| Company user | `/portal/login` | Magento customer email + password | `css_company_token` | `app/(portal)` -> `/portal` | customer/company operations |

Authentication mode is explicit. The application no longer decides the principal by checking whether a login identifier looks like an email address.

## UI boundary

The existing Staff/Admin UI is the production management baseline and should not be restyled as part of Company Portal work.

- Staff shell: `components/app-header.tsx`, `components/app-sidebar.tsx`, `app/(admin)/**`
- Company Portal shell: `components/portal/**`, `app/(portal)/**`
- Company Portal login: `app/(portal-auth)/portal/login/**`

Company Portal navigation remains capability-driven by Fluid. A customer token must never be used for `css_admin_*` operations, and a Magento admin token must never be treated as a company-user session.

See [`docs/AUTH_UI_BOUNDARIES.md`](docs/AUTH_UI_BOUNDARIES.md) for the full contract and maintenance rules.

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
5. For Staff/Admin testing, open `/login` and sign in with a Magento administrator username.
6. For Company Portal testing, open `/portal/login` and sign in with a Magento customer email address assigned to a Fluid company.

## Validation

Before merging a functional or UI slice:

```bash
yarn lint
yarn typecheck
yarn build
```

Then run the relevant live journey against the deployed Fluid GraphQL backend. Backend authorization remains authoritative.

## Backend contract

See [`docs/BACKEND_CONTRACT.md`](docs/BACKEND_CONTRACT.md).

The backend source of truth remains `0stoya/Fluid`, especially:

- `ROADMAP.md`
- `Css/Commerce/etc/schema.graphqls`
- phased/acceptance GraphQL packs under `Css/Commerce/Test/ApiFunctional`
