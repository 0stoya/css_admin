import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Portal purchase-control pickers do not auto-search while their modal is closed", () => {
  const page = source("app/(portal)/portal/purchase-controls/page.tsx");

  const editors = [...page.matchAll(/<PurchaseRuleEditor[\s\S]*?\/>/g)].map((match) => match[0]);
  assert.equal(editors.length, 2);
  for (const editor of editors) {
    assert.match(editor, /searchMode="portal"/);
    assert.match(editor, /autoOpenProductPicker=\{false\}/);
    assert.match(editor, /allowManualSku/);
  }
});

test("Portal purchase-control editors provide an exact-SKU fallback", () => {
  const editor = source("components/purchase-rule-editor.tsx");

  assert.match(editor, /allowManualSku\?: boolean/);
  assert.match(editor, /Add by SKU/);
  assert.match(editor, /manualSku: true/);
  assert.match(editor, /resolvedCompanyId && !row\.manualSku/);
  assert.match(editor, /Enter exact product SKU/);
});

test("Portal product picker selects customer-authenticated search explicitly", () => {
  const picker = source("components/purchase-product-picker.tsx");
  const editor = source("components/purchase-rule-editor.tsx");

  assert.match(picker, /searchMode === "portal"/);
  assert.match(picker, /searchPortalPurchaseControlProducts\(query\.trim\(\)\)/);
  assert.match(picker, /searchPurchaseControlProducts\(companyId, query\.trim\(\)\)/);
  assert.match(editor, /searchMode\?: "admin" \| "portal"/);
  assert.match(editor, /searchMode=\{searchMode\}/);
});

test("Portal product search uses customer GraphQL and never the Admin catalogue client", async () => {
  const calls = [];
  let adminCalls = 0;
  const actions = load(root, "lib/actions/purchase-control-product-search.ts", {
    "@/lib/graphql/company-catalog-products": {
      getCompanyCatalogProducts: async () => {
        adminCalls += 1;
        throw new Error("Admin catalogue client must not be used by Portal search");
      },
    },
    "@/lib/graphql/customer-client": {
      customerGraphqlRequest: async (query, variables) => {
        calls.push({ query, variables: JSON.parse(JSON.stringify(variables)) });
        return {
          products: {
            total_count: 1,
            items: [{ id: 77, sku: "A4806", name: "Nitrile disposable gloves" }],
            page_info: { page_size: 50, current_page: 1, total_pages: 1 },
          },
        };
      },
    },
    "@/lib/graphql/client": {
      graphQLErrorMessage: (error) => error instanceof Error ? error.message : String(error),
    },
  });

  const result = await actions.searchPortalPurchaseControlProducts(" gloves ");

  assert.equal(adminCalls, 0);
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /\bproducts\s*\(/);
  assert.deepEqual(calls[0].variables, {
    currentPage: 1,
    pageSize: 50,
    search: "gloves",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: true,
    result: {
      total_count: 1,
      items: [{ product_id: 77, sku: "A4806", name: "Nitrile disposable gloves" }],
      page_info: { page_size: 50, current_page: 1, total_pages: 1 },
    },
  });
});
