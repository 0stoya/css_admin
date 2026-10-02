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
  }
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

test("Portal product search reuses the selected company's restricted catalogue", async () => {
  let adminCalls = 0;
  let storefrontCalls = 0;
  const actions = load(root, "lib/actions/purchase-control-product-search.ts", {
    "@/lib/graphql/company-catalog-products": {
      getCompanyCatalogProducts: async () => {
        adminCalls += 1;
        throw new Error("Admin catalogue client must not be used by Portal search");
      },
    },
    "@/lib/graphql/company-portal-catalog": {
      getCompanyPortalCatalogPolicy: async () => ({
        company_id: 5437,
        allow_public_catalog: false,
        category_restriction: true,
        allowed_category_ids: [3, 4],
        allowed_categories: [],
        product_restriction: true,
        allowed_product_ids: [77, 88],
        allowed_products: [
          { product_id: 88, sku: "Z100", name: "Safety boot" },
          { product_id: 77, sku: "A4806", name: "Nitrile disposable gloves" },
        ],
      }),
    },
    "@/lib/graphql/customer-client": {
      customerGraphqlRequest: async () => {
        storefrontCalls += 1;
        throw new Error("Storefront products query must not be used for a restricted company catalogue");
      },
    },
    "@/lib/graphql/client": {
      graphQLErrorMessage: (error) => error instanceof Error ? error.message : String(error),
    },
  });

  const result = await actions.searchPortalPurchaseControlProducts(" gloves ");

  assert.equal(adminCalls, 0);
  assert.equal(storefrontCalls, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: true,
    result: {
      total_count: 1,
      items: [{ product_id: 77, sku: "A4806", name: "Nitrile disposable gloves" }],
      page_info: { page_size: 50, current_page: 1, total_pages: 1 },
    },
  });
});

test("Portal product search keeps the storefront fallback for unrestricted or catalogue-inaccessible users", async () => {
  const calls = [];
  let adminCalls = 0;
  const actions = load(root, "lib/actions/purchase-control-product-search.ts", {
    "@/lib/graphql/company-catalog-products": {
      getCompanyCatalogProducts: async () => {
        adminCalls += 1;
        throw new Error("Admin catalogue client must not be used by Portal search");
      },
    },
    "@/lib/graphql/company-portal-catalog": {
      getCompanyPortalCatalogPolicy: async () => ({
        company_id: 5437,
        allow_public_catalog: true,
        category_restriction: false,
        allowed_category_ids: [],
        allowed_categories: [],
        product_restriction: false,
        allowed_product_ids: [],
        allowed_products: [],
      }),
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
