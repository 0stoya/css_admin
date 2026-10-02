import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const forms = load(root, "lib/purchase-control-forms.ts");
const labels = load(root, "lib/purchase-product-label.ts");

class Navigation extends Error {
  constructor(location) {
    super(location);
    this.location = location;
  }
}

const templateFixture = () => ({
  company_id: 12,
  templates: [{
    template_id: 7,
    name: "Welfare Agency",
    assigned_roles: [],
    rules: [
      {
        rule_id: 81,
        product_id: 1001,
        sku: "A4806",
        product_name: "A4806 Nitrile disposable gloves",
        quantity_limit: 24,
        duration_days: 365,
        start_date: "2026-08-21",
        short_term_quantity_limit: null,
        short_term_duration_days: null,
      },
      {
        rule_id: 82,
        product_id: 1002,
        sku: "E2103",
        product_name: "Smoke Lens Safety Spectacle",
        quantity_limit: 4,
        duration_days: 365,
        start_date: "2026-08-21",
        short_term_quantity_limit: 2,
        short_term_duration_days: 7,
      },
    ],
  }],
});

function actionHarness() {
  const calls = [];
  const api = {
    getCompanyPortalPurchaseControls: async () => templateFixture(),
    saveCompanyPortalPurchaseControlTemplate: async (input) => {
      calls.push(JSON.parse(JSON.stringify(input)));
      return { cssSaveCompanyPurchaseControlTemplate: { template_id: 7, name: input.name } };
    },
  };
  const actions = load(root, "app/(portal)/portal/purchase-controls/actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": {
      redirect: (location) => { throw new Navigation(location); },
      unstable_rethrow: (error) => { if (error instanceof Navigation) throw error; },
    },
    "@/lib/graphql/client": { graphQLErrorMessage: (error) => error.message },
    "@/lib/graphql/company-portal-purchase-controls": new Proxy(api, {
      get: (target, key) => target[key] ?? (async () => ({})),
    }),
    "@/lib/purchase-control-forms": forms,
  });
  return { actions, calls };
}

async function redirected(work) {
  try {
    await work();
    assert.fail("expected redirect");
  } catch (error) {
    assert.ok(error instanceof Navigation, String(error));
    return error.location;
  }
}

test("Portal template view is current-rule first with focused edit delete add and rename controls", () => {
  const page = source("app/(portal)/portal/purchase-controls/page.tsx");

  assert.match(page, /Current template rules/);
  assert.match(page, /Products are shown as SKU — name/);
  assert.match(page, /purchaseProductLabel\(rule\.sku, rule\.product_name\)/);
  assert.match(page, /action=\{updatePortalPurchaseControlRuleAction\}/);
  assert.match(page, /formAction=\{deletePortalPurchaseControlRuleAction\}/);
  assert.ok(page.includes("Delete rule"));
  assert.match(page, />Save rule<\/button>/);
  assert.match(page, /action=\{addPortalPurchaseControlRulesAction\}/);
  assert.match(page, /<strong>Add products<\/strong>/);
  assert.match(page, /action=\{renamePortalPurchaseControlTemplateAction\}/);
  assert.match(page, /<summary>Edit name<\/summary>/);
  assert.doesNotMatch(page, /Add\/remove products or rename template/);
  assert.doesNotMatch(page, /Save structural changes/);
});

test("line edit reloads the current template and preserves every other SKU", async () => {
  const { actions, calls } = actionHarness();
  const data = new FormData();
  data.set("templateId", "7");
  data.set("ruleId", "81");
  data.set("quantityLimit", "30");
  data.set("durationDays", "365");
  data.set("shortQuantityLimit", "5");
  data.set("shortDurationDays", "7");
  data.set("startDate", "2026-08-21");

  const location = await redirected(() => actions.updatePortalPurchaseControlRuleAction(data));
  assert.match(location, /section=templates/);
  assert.match(location, /Rule\+A4806\+updated|Rule%20A4806%20updated/);
  assert.deepEqual(calls, [{
    template_id: 7,
    name: "Welfare Agency",
    rules: [
      {
        sku: "A4806",
        quantity_limit: 30,
        duration_days: 365,
        start_date: "2026-08-21",
        short_term_quantity_limit: 5,
        short_term_duration_days: 7,
      },
      {
        sku: "E2103",
        quantity_limit: 4,
        duration_days: 365,
        start_date: "2026-08-21",
        short_term_quantity_limit: 2,
        short_term_duration_days: 7,
      },
    ],
  }]);
});

test("delete removes only the selected current rule", async () => {
  const { actions, calls } = actionHarness();
  const data = new FormData();
  data.set("templateId", "7");
  data.set("ruleId", "81");

  const location = await redirected(() => actions.deletePortalPurchaseControlRuleAction(data));
  assert.match(location, /deleted/);
  assert.deepEqual(calls, [{
    template_id: 7,
    name: "Welfare Agency",
    rules: [{
      sku: "E2103",
      quantity_limit: 4,
      duration_days: 365,
      start_date: "2026-08-21",
      short_term_quantity_limit: 2,
      short_term_duration_days: 7,
    }],
  }]);
});

test("add products merges new rules without changing existing rules", async () => {
  const { actions, calls } = actionHarness();
  const data = new FormData();
  data.set("templateId", "7");
  data.set("rules", "WS615 | 1 | 365 | 2026-08-21");

  const location = await redirected(() => actions.addPortalPurchaseControlRulesAction(data));
  assert.match(location, /1\+product\+rule|1%20product%20rule/);
  assert.equal(calls[0].rules.length, 3);
  assert.deepEqual(calls[0].rules.at(-1), {
    sku: "WS615",
    quantity_limit: 1,
    duration_days: 365,
    start_date: "2026-08-21",
  });
});

test("add products rejects an SKU already present in the template", async () => {
  const { actions, calls } = actionHarness();
  const data = new FormData();
  data.set("templateId", "7");
  data.set("rules", "a4806 | 1 | 365 | 2026-08-21");

  const location = await redirected(() => actions.addPortalPurchaseControlRulesAction(data));
  assert.match(location, /already\+in\+this\+template|already%20in%20this%20template/);
  assert.equal(calls.length, 0);
});

test("rename changes only the template name and preserves current rules", async () => {
  const { actions, calls } = actionHarness();
  const data = new FormData();
  data.set("templateId", "7");
  data.set("name", "Welfare Main");

  const location = await redirected(() => actions.renamePortalPurchaseControlTemplateAction(data));
  assert.match(location, /Welfare\+Main|Welfare%20Main/);
  assert.equal(calls[0].name, "Welfare Main");
  assert.equal(calls[0].rules.length, 2);
  assert.equal(calls[0].rules[0].sku, "A4806");
  assert.equal(calls[0].rules[1].sku, "E2103");
});

test("catalogue-backed add editor keeps SKU and product name but defers search until requested", () => {
  const editor = source("components/purchase-rule-editor.tsx");
  const page = source("app/(portal)/portal/purchase-controls/page.tsx");
  const styles = source("app/purchase-controls.css");

  assert.match(editor, /product_name\?: string \| null/);
  assert.match(editor, /productNameWithoutLeadingSku\(rule\.sku, rule\.product_name\)/);
  assert.match(editor, /productNameWithoutLeadingSku\(product\.sku, product\.name\)/);
  assert.match(editor, /autoOpenProductPicker = true/);
  assert.match(page, /autoOpenProductPicker=\{false\}/);
  assert.match(editor, /purchase-rule-product-identity/);
  assert.match(styles, /\.purchase-rule-product-identity/);
});

test("Portal picker shows existing template SKUs as disabled rather than hiding them", () => {
  const page = source("app/(portal)/portal/purchase-controls/page.tsx");
  const editor = source("components/purchase-rule-editor.tsx");
  const picker = source("components/purchase-product-picker.tsx");
  const pickerStyles = source("app/purchase-product-picker.css");
  const modal = source("components/portal/portal-modal.tsx");

  assert.match(page, /excludedSkus=\{template\.rules\.map\(\(rule\) => rule\.sku\)\}/);
  assert.match(page, /size="wide"/);
  assert.match(editor, /excludedSkus\?: string\[\]/);
  assert.match(editor, /\.\.\.excludedSkus, \.\.\.rows\.map\(\(row\) => row\.sku\)/);
  assert.match(picker, /Already added/);
  assert.match(picker, /disabled=\{isExcluded\}/);
  assert.match(picker, /selectableItems\.forEach/);
  assert.match(picker, /is-selected/);
  assert.match(modal, /size\?: "default" \| "wide"/);
  assert.doesNotMatch(pickerStyles, /max-height:\s*430px/);
  assert.doesNotMatch(pickerStyles, /overflow:\s*auto/);
});

test("product labels do not repeat an SKU already prefixed to Magento product name", () => {
  assert.equal(
    labels.purchaseProductLabel("A4806", "A4806 Nitrile disposable gloves, powder free version"),
    "A4806 — Nitrile disposable gloves, powder free version",
  );
  assert.equal(
    labels.purchaseProductLabel("A6202", "A6202 - Red PVC fully coated cotton lined knitwrist glove"),
    "A6202 — Red PVC fully coated cotton lined knitwrist glove",
  );
  assert.equal(
    labels.purchaseProductLabel("E2103", "Smoke Lens Safety Spectacle"),
    "E2103 — Smoke Lens Safety Spectacle",
  );
});
