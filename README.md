# CSS Admin

Headless Admin application for the Fluid / CSS Commerce Magento backend.

## First vertical slice

The initial implementation is intentionally narrow:

**admin sign-in -> scoped company list -> company detail -> management-area availability**

Company scope and authorization remain authoritative in Magento/Fluid. The app does not reimplement sales-representative assignment or company ACL rules.

## Stack

- Next.js App Router
- React + TypeScript
- Server Components for authenticated admin reads
- Plain typed `fetch` for GraphQL
- HttpOnly cookie for the Magento admin bearer token

No Apollo/client cache layer is included yet.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set the Magento base URL and store code.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `/login` and sign in with a Magento admin account that has the required CSS Commerce ACLs.

## Backend contract

See [`docs/BACKEND_CONTRACT.md`](docs/BACKEND_CONTRACT.md).

The backend source of truth remains `0stoya/Fluid`, especially:

- `ROADMAP.md`
- `Css/Commerce/Test/ApiFunctional/phased/14-admin-sales-rep-scope.graphql`
- `Css/Commerce/etc/schema.graphqls`
- `Css/Commerce/Test/ApiFunctional/phased/STAGING_STATUS.md`
