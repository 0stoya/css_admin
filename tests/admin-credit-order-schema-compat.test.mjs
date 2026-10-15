import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const creditOrderSource = readFileSync(path.join(root, "lib/graphql/admin-credit-orders.ts"), "utf8");
const detailPageSource = readFileSync(
  path.join(root, "app/(admin)/companies/[id]/credit-orders/[number]/page.tsx"),
  "utf8",
);
const compiled = ts.transpileModule(creditOrderSource, {
  fileName: "admin-credit-orders.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadWithClient(request) {
  class MockGraphQLRequestError extends Error {
    constructor(message, errors = [], status) {
      super(message);
      this.errors = errors;
      this.status = status;
    }
  }

  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(specifier) {
      assert.equal(specifier, "@/lib/graphql/client");
      return {
        GraphQLRequestError: MockGraphQLRequestError,
        graphqlRequest: (query, variables) => request(query, variables, MockGraphQLRequestError),
      };
    },
  }, { filename: "admin-credit-orders.js" });

  return exports.getAdminCreditOrder;
}

const order = { credit_order_id: 990, number: "000001005", comments: [], logs: [], actions: null };
const item = { item_id: 1, product_id: 22, sku: "BCR528/03", name: "Boot", quantity: 2, unit_price: 10, row_total: 20 };
const missingField = 'Cannot query field "css_admin_credit_order_items" on type "Query". Did you mean "css_admin_credit_order"?';

test("credit order loads frozen items with the current Fluid schema in one request", async () => {
  const calls = [];
  const getOrder = loadWithClient(async (query, variables) => {
    calls.push({ query, variables });
    return { css_admin_credit_order: order, css_admin_credit_order_items: [item] };
  });
  const result = await getOrder(5437, "000001005", 13);
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /css_admin_credit_order_items\(/);
  assert.equal(calls[0].variables.actorCompanyUserId, 13);
  assert.equal(result.items[0].sku, item.sku);
});

test("missing optional Query field retries the core detail with the same actor and company", async () => {
  const calls = [];
  const getOrder = loadWithClient(async (query, variables, GraphQLRequestError) => {
    calls.push({ query, variables });
    if (calls.length === 1) throw new GraphQLRequestError(missingField, [{ message: missingField }]);
    return { css_admin_credit_order: order };
  });
  const result = await getOrder(5437, "000001005", 19);
  assert.equal(calls.length, 2);
  assert.match(calls[0].query, /css_admin_credit_order_items\(/);
  assert.doesNotMatch(calls[1].query, /css_admin_credit_order_items/);
  assert.match(calls[1].query, /css_admin_credit_order\(/);
  assert.equal(calls[1].variables.companyId, 5437);
  assert.equal(calls[1].variables.number, "000001005");
  assert.equal(calls[1].variables.actorCompanyUserId, 19);
  assert.equal(result.items, null, "unavailable items must not be presented as an empty order");
});

test("a supported empty item list is distinct from an unsupported items field", async () => {
  const getOrder = loadWithClient(async () => ({
    css_admin_credit_order: order,
    css_admin_credit_order_items: [],
  }));
  const result = await getOrder(5437, "000001005");
  assert.ok(Array.isArray(result.items));
  assert.equal(result.items.length, 0);
});

test("authorization and unrelated GraphQL failures are not swallowed by the fallback", async () => {
  for (const messages of [
    ["The current user isn't authorized."],
    [missingField, 'Cannot query field "unknown_field" on type "Query".'],
  ]) {
    let calls = 0;
    const getOrder = loadWithClient(async (_query, _vars, GraphQLRequestError) => {
      calls++;
      throw new GraphQLRequestError(messages[0], messages.map((message) => ({ message })), 401);
    });
    await assert.rejects(getOrder(5437, "000001005"));
    assert.equal(calls, 1, "only the isolated optional-field error permits retry");
  }
});

test("network failures are not mistaken for a missing field", async () => {
  let calls = 0;
  const failure = new Error("Magento GraphQL is unavailable.");
  const getOrder = loadWithClient(async () => {
    calls++;
    throw failure;
  });
  await assert.rejects(getOrder(5437, "000001005"), (error) => error === failure);
  assert.equal(calls, 1);
});

test("detail panel distinguishes unavailable items from a genuinely empty frozen quote", () => {
  assert.match(detailPageSource, /order\.items === null/);
  assert.match(detailPageSource, /Ordered items are unavailable/);
  assert.match(detailPageSource, /No visible quote items were returned/);
  assert.match(detailPageSource, /order\.items !== null \? <span/);
});
