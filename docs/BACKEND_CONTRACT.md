# Backend contract

## Target

This Admin application consumes the accepted Fluid / CSS Commerce Magento API from `0stoya/Fluid`.

Initial frontend target:

- accepted backend baseline recorded by `Css/Commerce/Test/ApiFunctional/phased/STAGING_STATUS.md`: `main` through PR #54 / `a211a913cc7746f602769813764482f61bbd6390`;
- application-delivery direction from merged roadmap PR #56;
- Phase 14 sales-representative scoping is part of the accepted server contract.

PR #56 is documentation-only and does not change the GraphQL API.

## Authoritative backend references

1. `ROADMAP.md` — delivery order and repository boundaries.
2. `Css/Commerce/Test/ApiFunctional/phased/14-admin-sales-rep-scope.graphql` — first Admin implementation contract and server-accepted operations.
3. `Css/Commerce/etc/schema.graphqls` — authoritative full GraphQL schema. Note Magento uses the `.graphqls` filename.
4. `Css/Commerce/Test/ApiFunctional/phased/STAGING_STATUS.md` — staging acceptance evidence and caveats.

## Authentication

The app obtains a Magento admin bearer token server-side using Magento's native admin integration token endpoint:

`POST /rest/V1/integration/admin/token`

Credentials are sent from the browser only to this Next.js application's `/api/auth/login` route. The route exchanges them for the Magento token and stores that token in an HttpOnly, same-site session cookie. The bearer token is not persisted in `localStorage` or exposed to Client Components.

`MAGENTO_ADMIN_TOKEN_URL` can override the native endpoint when an environment routes admin authentication differently.

## GraphQL request contract

Authenticated GraphQL requests are sent server-side to `/graphql` with:

```text
Authorization: Bearer <admin-token>
Store: <MAGENTO_STORE_CODE>
Content-Type: application/json
```

The app currently uses plain typed `fetch` with `cache: "no-store"`.

## Implemented Admin surface

Current read operations include:

- `css_admin_companies`
- `css_admin_company`
- `css_admin_company_management`
- `css_admin_company_customer_candidates`
- `css_admin_company_catalog_policy`
- `css_admin_purchase_controls`
- `css_admin_company_payment_configuration`
- `css_admin_credit_orders`

Company Management uses its real schema fields for users, roles and ACL resources. Its write path uses the existing Magento-admin mutations:

- `cssAdminAddCompanyUser`
- `cssAdminUpdateCompanyUser`
- `cssAdminRemoveCompanyUser`
- `cssAdminSaveCompanyRole`
- `cssAdminDeleteCompanyRole`

The frontend performs only basic form-shape validation and confirmation prompts. Company scope, ACL authorization, valid role/resource assignment, manager rules, approval rules and mutation validity remain authoritative in Fluid/Magento. Returned `manageable`, `assignable`, `is_company_admin`, role counts and candidate membership state may be reflected in the UI, but are not treated as a substitute for backend enforcement.

The remaining catalogue, purchase-control, commercial and credit-order areas are still availability probes and will become detailed screens as separate focused slices.

## Authorization rule

Do not reproduce Magento/Fluid sales-representative scoping in React or TypeScript.

The server contract is authoritative:

- scoped sales representatives receive only assigned companies in `css_admin_companies`;
- unassigned company detail/management access is rejected by GraphQL authorization;
- higher-privilege admins retain unrestricted behavior according to Magento ACLs;
- filtered counts and pagination come from the backend;
- all Company Management writes are submitted with an explicit `company_id` and must still pass backend admin ACL and company-scope checks.

The UI may reflect access returned by the API, but it must not attempt to calculate or expand that access itself.

## Backend-change rule

If frontend implementation uncovers a real missing capability, authorization gap or contract defect, fix and accept it in `0stoya/Fluid` first. Do not create a parallel business-rule implementation in this repository.
