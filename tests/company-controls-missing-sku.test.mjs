import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const missingProductMessage = "The product that was requested doesn't exist. Verify the product and try again.";

function input(skus, dryRun = true) {
  return {
    format: "fluid-company-controls",
    schema_version: 2,
    company_id: 496,
    company_catalog: {
      allow_public_catalog: false,
      category_restriction: false,
      allowed_category_ids: [],
      product_restriction: true,
      allowed_product_skus: skus,
    },
    role_controls: [],
    purchase_controls: { templates: [] },
    create_missing_roles: false,
    create_missing_templates: false,
    apply_purchase_templates: false,
    dry_run: dryRun,
  };
}

function exportedBundle(existingSkus = []) {
  return {
    css_admin_company_controls_export: {
      format: "fluid-company-controls",
      schema_version: 2,
      company_id: 496,
      company_catalog: {
        allow_public_catalog: false,
        category_restriction: false,
        allowed_category_ids: [],
        product_restriction: true,
        allowed_products: existingSkus.map((sku) => ({ sku })),
      },
      role_controls: [],
      purchase_controls: { templates: [] },
    },
  };
}

function harness({ missing = [], existing = [] }) {
  const missingSet = new Set(missing.map((sku) => sku.toLowerCase()));
  const importCalls = [];
  const client = {
    graphqlRequest: async (query, variables) => {
      if (query.includes("AdminCompanyControlsExport")) {
        return exportedBundle(existing);
      }
      if (query.includes("AdminImportCompanyControls")) {
        const skus = variables.input.company_catalog.allowed_product_skus;
        importCalls.push([...skus]);
        if (skus.some((sku) => missingSet.has(sku.toLowerCase()))) {
          throw new Error(missingProductMessage);
        }
        return {
          cssAdminImportCompanyControls: {
            valid: true,
            applied: false,
          },
        };
      }
      throw new Error("Unexpected GraphQL operation in test.");
    },
  };
  const controls = load(root, "lib/graphql/company-controls.ts", {
    "@/lib/graphql/client": client,
  });
  return { controls, importCalls };
}

test("dry-run reports the exact missing company-product SKU", async () => {
  const { controls, importCalls } = harness({ missing: ["MISSING-2"], existing: ["EXISTING-1"] });

  await assert.rejects(
    () => controls.importCompanyControls(input(["EXISTING-1", "GOOD-1", "MISSING-2", "GOOD-3"])),
    /Product SKU not found: MISSING-2/,
  );

  assert.ok(importCalls.length > 1, "expected diagnostic dry-runs after the initial failure");
  assert.ok(importCalls.some((skus) => skus.length === 1 && skus[0] === "MISSING-2"));
});

test("dry-run reports all missing company-product SKUs", async () => {
  const { controls } = harness({ missing: ["MISSING-A", "MISSING-C"] });

  await assert.rejects(
    () => controls.importCompanyControls(input(["MISSING-A", "GOOD-B", "MISSING-C"])),
    /Product SKUs not found: MISSING-A, MISSING-C/,
  );
});

test("non-dry-run preserves Fluid's original missing-product error", async () => {
  const { controls, importCalls } = harness({ missing: ["MISSING-1"] });

  await assert.rejects(
    () => controls.importCompanyControls(input(["MISSING-1"], false)),
    /The product that was requested doesn't exist/,
  );
  assert.equal(importCalls.length, 1);
});
