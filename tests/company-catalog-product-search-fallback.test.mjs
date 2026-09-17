import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function harness(policy) {
  const calls = [];
  const module = load(root, "lib/graphql/company-catalog-products.ts", {
    "@/lib/graphql/catalog-policy": {
      getCompanyCatalogPolicy: async (companyId) => {
        assert.equal(companyId, 1455);
        return policy;
      },
    },
    "@/lib/graphql/client": {
      graphqlRequest: async (query, variables) => {
        calls.push({ query, variables: plain(variables) });
        if (query.includes("css_admin_company_catalog_products")) {
          throw new Error("legacy custom company product query must not be used");
        }
        return {
          products: {
            total_count: 1,
            items: [{ id: 77, sku: "PUBLIC-77", name: "Public Product" }],
            page_info: { page_size: 50, current_page: 1, total_pages: 1 },
          },
        };
      },
    },
  });
  return { module, calls };
}

test("restricted company product search is served from the existing catalog policy", async () => {
  const { module, calls } = harness({
    product_restriction: true,
    allowed_products: [
      { product_id: 2, sku: "BETA-2", name: "Beta Product" },
      { product_id: 1, sku: "ALPHA-1", name: "Alpha Product" },
    ],
  });

  const result = await module.getCompanyCatalogProducts(1455, 1, 50, "alpha");

  assert.deepEqual(plain(result), {
    total_count: 1,
    items: [{ product_id: 1, sku: "ALPHA-1", name: "Alpha Product" }],
    page_info: { page_size: 50, current_page: 1, total_pages: 1 },
  });
  assert.equal(calls.length, 0);
});

test("unrestricted company product search falls back to Magento's existing products query", async () => {
  const { module, calls } = harness({
    product_restriction: false,
    allowed_products: [],
  });

  const result = await module.getCompanyCatalogProducts(1455, 1, 50, "public");

  assert.deepEqual(plain(result), {
    total_count: 1,
    items: [{ product_id: 77, sku: "PUBLIC-77", name: "Public Product" }],
    page_info: { page_size: 50, current_page: 1, total_pages: 1 },
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /\bproducts\s*\(/);
  assert.doesNotMatch(calls[0].query, /css_admin_company_catalog_products/);
  assert.deepEqual(calls[0].variables, { currentPage: 1, pageSize: 50, search: "public" });
});
