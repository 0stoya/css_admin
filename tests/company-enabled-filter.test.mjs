import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("company list GraphQL exposes status and supports backend status filtering", () => {
  const companies = source("lib/graphql/companies.ts");

  assert.match(companies, /status: boolean/);
  assert.match(companies, /\$status: Boolean/);
  assert.match(companies, /status: \$status/);
  assert.match(companies, /getAllCompanies\(pageSize = 100, status\?: boolean\)/);
});

test("companies page defaults to enabled and exposes an all-company view", () => {
  const page = source("app/(admin)/companies/page.tsx");
  const directory = source("components/company-directory.tsx");

  assert.match(page, /return value === "all" \? "all" : "enabled"/);
  assert.match(page, /filter === "enabled" \? true : undefined/);
  assert.match(directory, /href="\/companies"/);
  assert.match(directory, /href="\/companies\?status=all"/);
  assert.match(directory, />\s*Enabled\s*</);
  assert.match(directory, />\s*All\s*</);
  assert.match(directory, /Disabled/);
});
