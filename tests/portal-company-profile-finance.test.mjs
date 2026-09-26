import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(path.join(root, file), "utf8");

test("company login uses a one-time smart portal landing", () => {
  const login = source("app/api/auth/login/route.ts");
  const portal = source("app/(portal)/portal/page.tsx");
  const actions = source("app/(portal)/portal/actions.ts");

  assert.match(login, /destination: "\/portal\?landing=1"/);
  assert.match(portal, /params\.landing === "1"/);
  assert.match(portal, /administration\?\.is_company_admin/);
  assert.match(portal, /redirect\("\/portal\/company-profile"\)/);
  assert.match(portal, /name="landing" value="1"/);
  assert.match(actions, /openProfile/);
  assert.match(actions, /getCompanyPortalAdministration\(\)\)\.is_company_admin/);
  assert.match(actions, /openProfile \? "\/portal\/company-profile" : "\/portal"/);
});

test("company profile finance is scoped to the authenticated selected company admin", () => {
  const profile = source("app/(portal)/portal/company-profile/page.tsx");

  assert.match(profile, /getCompanyPortalContext/);
  assert.match(profile, /getCompanyPortalAdministration/);
  assert.match(profile, /administration\?\.is_company_admin/);
  assert.match(profile, /administration\.company_id === selected\.company_id/);
  assert.match(profile, /getLatestCompanyFinanceSnapshot\(selected\.company_id, selected\.reference\)/);
  assert.match(profile, /getCompanyFinanceVisibility\(selected\.company_id\)/);
  assert.doesNotMatch(profile, /searchParams/);
  assert.doesNotMatch(profile, /getCompanyFinanceForDisplay/);
});

test("portal finance respects Admin visibility settings and remains read-only", () => {
  const profile = source("app/(portal)/portal/company-profile/page.tsx");

  for (const setting of [
    "show_year_to_date",
    "show_last_7_days",
    "show_last_30_days",
    "show_last_3_months",
    "show_last_6_months",
    "show_last_365_days",
  ]) {
    assert.match(profile, new RegExp(setting));
  }

  assert.match(profile, /Financial overview/);
  assert.match(profile, /Order activity/);
  assert.match(profile, /not the accounting ledger balance/);
  assert.match(profile, /Awaiting source support/);
  assert.match(profile, /No local financial snapshot is available yet/);
});

test("company profile content leads and finance follows underneath", () => {
  const profile = source("app/(portal)/portal/company-profile/page.tsx");

  const companyLayout = profile.indexOf("className={styles.layout}");
  const financeSection = profile.indexOf("className={styles.financeSection}");

  assert.ok(companyLayout >= 0);
  assert.ok(financeSection > companyLayout);
});

test("portal financial overview includes monthly spend from the local snapshot", () => {
  const profile = source("app/(portal)/portal/company-profile/page.tsx");
  const css = source("components/portal/portal-company-profile.module.css");

  assert.match(profile, /normaliseMonths\(finance\)/);
  assert.match(profile, /spend per month/);
  assert.match(profile, /monthly OGL order value/);
  assert.match(profile, /monthly\.map/);
  assert.match(profile, /formatCompactAmount/);
  assert.match(css, /\.monthlyChart/);
  assert.match(css, /\.monthFill/);
});
