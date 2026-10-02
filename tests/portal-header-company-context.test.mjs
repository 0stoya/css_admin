import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("Portal header uses the selected Magento company name with a safe fallback", () => {
  const header = source("components/portal/portal-header.tsx");
  const layout = source("app/(portal)/layout.tsx");

  assert.match(layout, /getCompanyPortalContext\(\)/);
  assert.match(layout, /<PortalHeader context=\{context\} \/>/);
  assert.doesNotMatch(layout, /getPortalCompanyPresentation\(\)/);

  assert.match(header, /context\?\.companies\.find\(\(company\) => company\.selected\)/);
  assert.match(header, /selectedCompany\?\.name\?\.trim\(\) \|\| "Company Portal"/);
  assert.match(header, /<span className=\{styles\.brandLabel\}>\{title\}<\/span>/);
});

test("Portal header exposes the existing company memberships as a compact switcher", () => {
  const header = source("components/portal/portal-header.tsx");
  const switcher = source("components/portal/portal-header-company-switcher.tsx");
  const actions = source("app/(portal)/portal/actions.ts");
  assert.match(header, /PortalHeaderCompanySwitcher/);
  assert.match(header, /companies=\{context\.companies\}/);
  assert.match(header, /selectedCompanyId=\{context\.selected_company_id\}/);

  assert.match(switcher, /selectPortalCompanyAction/);
  assert.match(switcher, /companies\.length <= 1/);
  assert.match(switcher, /defaultValue=\{selectedCompanyId\}/);
  assert.match(switcher, /aria-label="Switch company"/);
  assert.match(switcher, /onChange=\{\(\) => formRef\.current\?\.requestSubmit\(\)\}/);
  assert.match(switcher, /company\.reference \+ " · " \+ \(company\.name/);

  // The header reuses the existing Fluid membership-checked mutation; it does
  // not derive switch permissions from the temporary structure snapshot.
  assert.match(actions, /await selectCompanyPortalCompany\(companyId\)/);
  assert.doesNotMatch(switcher, /temporary-portal-company-structure/);
});

test("Portal header company switcher stays compact on narrow screens", () => {
  const styles = source("components/portal/portal-shell.module.css");

  assert.match(styles, /\.headerCompanySwitcher/);
  assert.match(styles, /\.headerCompanySelect/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*\.brandLabel \{ display: none; \}/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*\.headerCompanySwitcher \{ display: none; \}/);
});


test("Portal overview keeps company switching in the header and gives the company title full hero width", () => {
  const page = source("app/(portal)/portal/page.tsx");
  const styles = source("components/portal/portal-dashboard.module.css");

  assert.match(page, /className=\{\`\$\{styles\.hero\} \$\{styles\.heroSingle\}\`\}/);
  assert.match(styles, /\.heroSingle \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.heroSingle h1 \{[\s\S]*max-width: 1120px/);

  const selectedHero = page.slice(page.indexOf("const accessItems"), page.indexOf("{(params.success || message)"));
  assert.doesNotMatch(selectedHero, /styles\.heroContext/);
  assert.doesNotMatch(selectedHero, /aria-label="Switch company"/);
});
