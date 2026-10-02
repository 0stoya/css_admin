import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("Portal exposes the existing Fluid add-company-user mutation", () => {
  const graphql = source("lib/graphql/company-portal.ts");

  assert.match(graphql, /export type AddCompanyPortalUserInput/);
  assert.match(graphql, /mutation CompanyPortalAddUser\(\$input: CssAddCompanyUserInput!\)/);
  assert.match(graphql, /cssAddCompanyUser\(input: \$input\)/);
  assert.match(graphql, /export async function addCompanyPortalUser/);
});

test("Portal add-user action validates input and delegates authorization to Fluid", () => {
  const actions = source("app/(portal)/portal/actions.ts");

  assert.match(actions, /export async function addPortalUserAction/);
  assert.match(actions, /await addCompanyPortalUser\(\{/);
  assert.match(actions, /email,/);
  assert.match(actions, /role_id: roleId/);
  assert.match(actions, /manager_id: managerId/);
  assert.match(actions, /approval_type: approvalType/);
  assert.match(actions, /approval_threshold: approvalThreshold/);
  assert.match(actions, /approvalThreshold !== null && approvalThreshold < 0/);
});

test("company managers with user-edit capability get an add-user panel", () => {
  const page = source("app/(portal)/portal/page.tsx");

  assert.match(page, /administration\.can_manage_users \? \(/);
  assert.match(page, /Add company user/);
  assert.match(page, /action=\{addPortalUserAction\}/);
  assert.match(page, /name="email"/);
  assert.match(page, /name="roleId"/);
  assert.match(page, /name="managerId"/);
  assert.match(page, /name="approvalType"/);
  assert.match(page, /name="approvalThreshold"/);
  assert.match(page, /customer account must already exist in Magento/i);
  assert.match(page, /Create a company role before adding another user/);
});


test("Portal user and role creation use compact modal actions instead of wide inline expanders", () => {
  const page = source("app/(portal)/portal/page.tsx");
  const styles = source("components/portal/portal-dashboard.module.css");

  assert.match(page, /AdminActionModal/);
  assert.match(page, /triggerLabel="Add user"/);
  assert.match(page, /triggerLabel="Create role"/);
  assert.match(page, /AdminFormFooter/);
  assert.doesNotMatch(page, /management-create-panel nested-card/);

  assert.match(styles, /\.managementSectionHeader/);
  assert.match(styles, /\.modalHint/);
  assert.match(styles, /\.inlineGuidance/);
});
