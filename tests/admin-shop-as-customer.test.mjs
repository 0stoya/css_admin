import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("company users expose Shop as customer through the trusted Store origin", () => {
  const page = source("app/(admin)/companies/[id]/management/page.tsx");

  assert.match(page, /getStorefrontUrl/);
  assert.match(page, /\/api\/auth\/impersonate\/start\?companyId=/);
  assert.match(page, /userId=/);
  assert.match(page, /target="_blank"/);
  assert.match(page, />Shop as user<\/span>/);
});

test("admin impersonation uses Magento native token issuance then existing app-switch ticket", () => {
  const issuer = source("lib/graphql/customer-impersonation.ts");
  const route = source("app/api/auth/impersonate/authorize/route.ts");

  assert.match(issuer, /generateCustomerTokenAsAdmin/);
  assert.match(issuer, /customer_email: \$email/);
  assert.match(route, /getCompanyManagement\(companyId\)/);
  assert.match(route, /candidate\.user_id === userId/);
  assert.match(route, /generateCustomerTokenAsAdmin\(user\.email\)/);
  assert.match(route, /createCustomerAppSwitch\(customerToken, "STORE", challenge\)/);
  assert.match(route, /revokeCustomerToken\(customerToken\)/);
  assert.doesNotMatch(route, /searchParams\.set\(["\'](?:customer_)?token/);
});

test("admin impersonation preserves the selected company and blocks cross-company baskets", () => {
  const route = source("app/api/auth/impersonate/authorize/route.ts");
  const switcher = source("lib/graphql/customer-app-switch.ts");

  assert.match(route, /supportContext\.companyIds\.includes\(companyId\)/);
  assert.match(route, /supportContext\.selectedCompanyId !== companyId/);
  assert.match(route, /supportContext\.cartQuantity > 0/);
  assert.match(route, /selectCustomerCompany\(customerToken, companyId\)/);
  assert.match(route, /validateCompanyCustomerToken\(customerToken, user\.email, companyId\)/);
  assert.match(switcher, /customerCart \{ total_quantity \}/);
  assert.match(switcher, /cssSelectCompany\(company_id: \$companyId\)/);
});
