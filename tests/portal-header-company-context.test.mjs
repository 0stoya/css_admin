import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("Portal header uses configured Portal Title with a safe fallback", () => {
  const header = source("components/portal/portal-header.tsx");
  const layout = source("app/(portal)/layout.tsx");

  assert.match(layout, /getPortalCompanyPresentation\(\)/);
  assert.match(layout, /presentationResult\.value\.portal_title/);
  assert.match(layout, /<PortalHeader context=\{context\} portalTitle=\{portalTitle\}/);

  assert.match(header, /portalTitle\?\.trim\(\) \|\| "Company Portal"/);
  assert.match(header, /<span className=\{styles\.brandLabel\}>\{title\}<\/span>/);
  assert.doesNotMatch(header, />Company Portal<\/span>/);
});

test("Portal header exposes the existing company memberships as a compact switcher", () => {
  const header = source("components/portal/portal-header.tsx");
  const switcher = source("components/portal/portal-header-company-switcher.tsx");
  const actions = source("app/(portal)/portal/actions.ts");
  const layout = source("app/(portal)/layout.tsx");

  assert.match(header, /PortalHeaderCompanySwitcher/);
  assert.match(header, /companies=\{context\.companies\}/);
  assert.match(header, /selectedCompanyId=\{context\.selected_company_id\}/);

  assert.match(switcher, /selectPortalCompanyAction/);
  assert.match(switcher, /companies\.length <= 1/);
  assert.match(switcher, /defaultValue=\{selectedCompanyId\}/);
  assert.match(switcher, /aria-label="Switch company"/);
  assert.match(switcher, /onChange=\{\(\) => formRef\.current\?\.requestSubmit\(\)\}/);
  assert.match(switcher, /portalTitles\[String\(company\.company_id\)\]/);
  assert.match(switcher, /destinationTitle/);
  assert.match(switcher, /company\.reference \+ " · " \+ destinationLabel/);

  // The header reuses the existing Fluid membership-checked mutation; it does
  // not derive switch permissions from the temporary structure snapshot.
  assert.match(actions, /await selectCompanyPortalCompany\(companyId\)/);
  assert.doesNotMatch(switcher, /temporary-portal-company-structure/);
  assert.match(layout, /getTemporaryPortalCompanyStructure\(context\.selected_company_id\)/);
});

test("Portal header company switcher stays compact on narrow screens", () => {
  const styles = source("components/portal/portal-shell.module.css");

  assert.match(styles, /\.headerCompanySwitcher/);
  assert.match(styles, /\.headerCompanySelect/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*\.brandLabel \{ display: none; \}/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*\.headerCompanySwitcher \{ display: none; \}/);
});
