import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("large SKU-list imports have a dedicated 200k row ceiling", () => {
  const imports = source("lib/flat-company-imports.ts");

  assert.match(imports, /const MAX_ROWS = 5000;/);
  assert.match(imports, /const MAX_PRODUCT_ROWS = 200000;/);
  assert.match(
    imports,
    /parseExactCsv\([\s\S]*?\["sku", "user_role_name", "company_ref"\][\s\S]*?MAX_PRODUCT_ROWS/,
  );
  assert.match(
    imports,
    /parseExactCsv\([\s\S]*?\["sku", "company_ref"\][\s\S]*?MAX_PRODUCT_ROWS/,
  );
});

test("large SKU-list imports deduplicate with Set rather than quadratic array scans", () => {
  const imports = source("lib/flat-company-imports.ts");

  assert.match(imports, /skus: Set<string>/);
  assert.match(imports, /skus: new Set<string>\(\)/);
  assert.match(imports, /group\.skus\.add\(sku\)/);
  assert.doesNotMatch(imports, /group\.skus\.includes\(sku\)/);
  assert.match(imports, /\[\.\.\.group\.skus\]/);
});

test("non-SKU bulk imports retain the conservative default row ceiling", () => {
  const imports = source("lib/flat-company-imports.ts");

  assert.match(imports, /maxRows = MAX_ROWS/);
});
