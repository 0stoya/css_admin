import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const forms = load(root, "lib/purchase-control-forms.ts");

class Navigation extends Error {
  constructor(location) {
    super(location);
    this.location = location;
  }
}

test("Portal template modal shows SKU — name and edits one current rule at a time", () => {
  const page = source("app/(portal)/portal/purchase-controls/page.tsx");

  assert.match(page, /Current template rules/);
  assert.match(page, /Products are shown as SKU — name/);
  assert.match(page, /rule\.sku} — \{rule\.product_name/);
  assert.match(page, /action=\{updatePortalPurchaseControlRuleAction\}/);
  assert.match(page, /name="ruleId"/);
  assert.match(page, /name="quantityLimit"/);
  assert.match(page, /name="durationDays"/);
  assert.match(page, /name="shortQuantityLimit"/);
  assert.match(page, /name="shortDurationDays"/);
  assert.match(page, /name="startDate"/);
  assert.match(page, />Save rule<\/button>/);
  assert.match(page, /Add\/remove products or rename template/);
});

test("line edit reloads the current template and preserves every other SKU", async () => {
  const calls = [];
  const navigation = new Navigation("/sentinel");
  const api = {
    getCompanyPortalPurchaseControls: async () => ({
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
            product_name: "Nitrile disposable gloves",
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
    }),
    saveCompanyPortalPurchaseControlTemplate: async (input) => {
      calls.push(input);
      return { cssSaveCompanyPurchaseControlTemplate: { template_id: 7, name: "Welfare Agency" } };
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

  const data = new FormData();
  data.set("templateId", "7");
  data.set("ruleId", "81");
  data.set("quantityLimit", "30");
  data.set("durationDays", "365");
  data.set("shortQuantityLimit", "5");
  data.set("shortDurationDays", "7");
  data.set("startDate", "2026-08-21");

  try {
    await actions.updatePortalPurchaseControlRuleAction(data);
    assert.fail("expected redirect");
  } catch (error) {
    assert.ok(error instanceof Navigation);
    assert.match(error.location, /section=templates/);
    assert.match(error.location, /Rule\+A4806\+updated|Rule%20A4806%20updated/);
  }

  assert.equal(calls.length, 1);
  // The action module is evaluated in the TypeScript test helper's VM realm,
  // so normalise the returned input before a strict structural comparison.
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
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
  });
});

test("bulk structural editor keeps product names alongside catalogue SKUs", () => {
  const editor = source("components/purchase-rule-editor.tsx");
  const styles = source("app/purchase-controls.css");

  assert.match(editor, /product_name\?: string \| null/);
  assert.match(editor, /productName: rule\.product_name\?\.trim\(\) \?\? ""/);
  assert.match(editor, /productName: product\.name/);
  assert.match(editor, /purchase-rule-product-identity/);
  assert.match(editor, /Product name unavailable/);
  assert.match(styles, /\.purchase-rule-product-identity/);
});
