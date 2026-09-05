import { parseCsv, stringifyCsv } from "@/lib/csv";
import type { CompanyControlsBundle } from "@/lib/graphql/company-controls";

const CSV_HEADERS = [
  "record_type",
  "name",
  "sort_order",
  "resource",
  "category_id",
  "sku",
  "quantity_limit",
  "duration_days",
  "start_date",
  "role_name",
  "allow_public_catalog",
  "category_restriction",
  "product_restriction",
  "preselect_all_products",
  "source_company_id",
] as const;

type Header = (typeof CSV_HEADERS)[number];
type CsvValue = string | number;
type RoleControl = CompanyControlsBundle["role_controls"][number];
type PurchaseTemplate = NonNullable<CompanyControlsBundle["purchase_controls"]>["templates"][number];

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function csvRow(values: Partial<Record<Header, CsvValue>>) {
  return CSV_HEADERS.map((header) => values[header] ?? "");
}

function requiredText(value: string, label: string, row: number) {
  const text = value.trim();
  if (!text) throw new Error(`Controls CSV row ${row}: ${label} is required.`);
  return text;
}

function optionalPositiveInteger(value: string, label: string, row: number) {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Controls CSV row ${row}: ${label} must be a positive integer or blank.`);
  }
  return number;
}

function requiredInteger(value: string, label: string, row: number, minimum = 0) {
  const text = requiredText(value, label, row);
  const number = Number(text);
  if (!Number.isInteger(number) || number < minimum) {
    throw new Error(`Controls CSV row ${row}: ${label} must be an integer of ${minimum} or greater.`);
  }
  return number;
}

function requiredBoolean(value: string, label: string, row: number) {
  const text = normalized(requiredText(value, label, row));
  if (text === "true") return true;
  if (text === "false") return false;
  throw new Error(`Controls CSV row ${row}: ${label} must be true or false.`);
}

function pushUnique<T>(items: T[], value: T) {
  if (!items.includes(value)) items.push(value);
}

function roleKey(name: string) {
  return normalized(name);
}

export function parseCompanyControlsCsv(
  source: string,
  companyId: number,
  targetBundle: CompanyControlsBundle,
) {
  const rows = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!rows.length) throw new Error("The controls CSV file is empty.");

  const headers = rows[0].map(normalized);
  const unknownHeaders = headers.filter((header) => !CSV_HEADERS.includes(header as Header));
  const missingHeaders = CSV_HEADERS.filter((header) => !headers.includes(header));
  if (unknownHeaders.length || missingHeaders.length || new Set(headers).size !== headers.length) {
    throw new Error(`Controls CSV headers must be exactly: ${CSV_HEADERS.join(", ")}.`);
  }

  const dataRows = rows.slice(1);
  if (!dataRows.length) throw new Error("The controls CSV file contains no control rows.");
  if (dataRows.length > 2000) throw new Error("Controls CSV import is limited to 2,000 rows per preview.");

  const column = Object.fromEntries(headers.map((header, index) => [header, index])) as Record<Header, number>;
  const value = (values: string[], header: Header) => values[column[header]] ?? "";

  let companyCatalog: CompanyControlsBundle["company_catalog"] | null = null;
  let sourceCompanyId: number | null = null;
  const allowedCategoryIds: number[] = [];
  const allowedProductSkus: string[] = [];
  const roles = new Map<string, RoleControl>();
  const definedRoles = new Set<string>();
  const templates = new Map<string, PurchaseTemplate>();
  const definedTemplates = new Set<string>();
  let sawPurchaseRows = false;

  function ensureRole(name: string) {
    const key = roleKey(name);
    const existing = roles.get(key);
    if (existing) return existing;
    const created: RoleControl = {
      role_name: name,
      sort_order: 0,
      allowed_resources: [],
      selected_category_ids: [],
      preselect_all_products: false,
      allowed_product_skus: [],
    };
    roles.set(key, created);
    return created;
  }

  function ensureTemplate(name: string) {
    const key = roleKey(name);
    const existing = templates.get(key);
    if (existing) return existing;
    const created: PurchaseTemplate = { name, rules: [], assigned_role_names: [] };
    templates.set(key, created);
    return created;
  }

  dataRows.forEach((values, index) => {
    const row = index + 2;
    const recordType = normalized(value(values, "record_type"));

    if (recordType === "company_catalog") {
      if (companyCatalog) throw new Error(`Controls CSV row ${row}: company_catalog may appear only once.`);
      companyCatalog = {
        allow_public_catalog: requiredBoolean(value(values, "allow_public_catalog"), "allow_public_catalog", row),
        category_restriction: requiredBoolean(value(values, "category_restriction"), "category_restriction", row),
        allowed_category_ids: allowedCategoryIds,
        product_restriction: requiredBoolean(value(values, "product_restriction"), "product_restriction", row),
        allowed_product_skus: allowedProductSkus,
      };
      sourceCompanyId = optionalPositiveInteger(value(values, "source_company_id"), "source_company_id", row);
      return;
    }

    if (recordType === "catalog_category") {
      pushUnique(allowedCategoryIds, requiredInteger(value(values, "category_id"), "category_id", row, 1));
      return;
    }

    if (recordType === "catalog_product") {
      pushUnique(allowedProductSkus, requiredText(value(values, "sku"), "sku", row));
      return;
    }

    if (recordType === "role") {
      const name = requiredText(value(values, "name"), "name", row);
      const key = roleKey(name);
      if (definedRoles.has(key)) throw new Error(`Controls CSV row ${row}: role “${name}” is defined more than once.`);
      const role = ensureRole(name);
      role.role_name = name;
      role.sort_order = requiredInteger(value(values, "sort_order"), "sort_order", row);
      role.preselect_all_products = requiredBoolean(value(values, "preselect_all_products"), "preselect_all_products", row);
      definedRoles.add(key);
      return;
    }

    if (recordType === "role_resource" || recordType === "role_category" || recordType === "role_product") {
      const name = requiredText(value(values, "name"), "name", row);
      const role = ensureRole(name);
      if (recordType === "role_resource") {
        pushUnique(role.allowed_resources, requiredText(value(values, "resource"), "resource", row));
      } else if (recordType === "role_category") {
        pushUnique(role.selected_category_ids, requiredInteger(value(values, "category_id"), "category_id", row, 1));
      } else {
        pushUnique(role.allowed_product_skus, requiredText(value(values, "sku"), "sku", row));
      }
      return;
    }

    if (recordType === "purchase_template") {
      sawPurchaseRows = true;
      const name = requiredText(value(values, "name"), "name", row);
      const key = roleKey(name);
      if (definedTemplates.has(key)) {
        throw new Error(`Controls CSV row ${row}: purchase template “${name}” is defined more than once.`);
      }
      ensureTemplate(name).name = name;
      definedTemplates.add(key);
      return;
    }

    if (recordType === "purchase_rule" || recordType === "template_role") {
      sawPurchaseRows = true;
      const name = requiredText(value(values, "name"), "name", row);
      const template = ensureTemplate(name);
      if (recordType === "purchase_rule") {
        template.rules.push({
          sku: requiredText(value(values, "sku"), "sku", row),
          quantity_limit: requiredInteger(value(values, "quantity_limit"), "quantity_limit", row),
          duration_days: requiredInteger(value(values, "duration_days"), "duration_days", row, 1),
          start_date: requiredText(value(values, "start_date"), "start_date", row),
        });
      } else {
        pushUnique(template.assigned_role_names, requiredText(value(values, "role_name"), "role_name", row));
      }
      return;
    }

    throw new Error(
      `Controls CSV row ${row}: record_type must be company_catalog, catalog_category, catalog_product, role, role_resource, role_category, role_product, purchase_template, purchase_rule, or template_role.`,
    );
  });

  if (!companyCatalog) throw new Error("Controls CSV requires one company_catalog row.");

  const undefinedRole = [...roles.entries()].find(([key]) => !definedRoles.has(key));
  if (undefinedRole) {
    throw new Error(`Controls CSV references role “${undefinedRole[1].role_name}” without a role row.`);
  }

  const undefinedTemplate = [...templates.entries()].find(([key]) => !definedTemplates.has(key));
  if (undefinedTemplate) {
    throw new Error(`Controls CSV references purchase template “${undefinedTemplate[1].name}” without a purchase_template row.`);
  }

  if (sawPurchaseRows && targetBundle.schema_version < 2) {
    throw new Error(`Target controls schema v${targetBundle.schema_version} does not support purchase templates.`);
  }

  const bundle: CompanyControlsBundle = {
    format: targetBundle.format,
    schema_version: targetBundle.schema_version,
    company_id: companyId,
    company_catalog: companyCatalog,
    role_controls: [...roles.values()],
    ...(targetBundle.schema_version >= 2
      ? { purchase_controls: { templates: [...templates.values()] } }
      : {}),
  };

  return { bundle, sourceCompanyId };
}

export function exportCompanyControlsCsv(bundle: CompanyControlsBundle) {
  const rows: Array<Array<string | number>> = [CSV_HEADERS.slice()];
  rows.push(csvRow({
    record_type: "company_catalog",
    allow_public_catalog: String(bundle.company_catalog.allow_public_catalog),
    category_restriction: String(bundle.company_catalog.category_restriction),
    product_restriction: String(bundle.company_catalog.product_restriction),
    source_company_id: bundle.company_id,
  }));

  bundle.company_catalog.allowed_category_ids.forEach((categoryId) => {
    rows.push(csvRow({ record_type: "catalog_category", category_id: categoryId }));
  });
  bundle.company_catalog.allowed_product_skus.forEach((sku) => {
    rows.push(csvRow({ record_type: "catalog_product", sku }));
  });

  bundle.role_controls.forEach((role) => {
    rows.push(csvRow({
      record_type: "role",
      name: role.role_name,
      sort_order: role.sort_order,
      preselect_all_products: String(role.preselect_all_products),
    }));
    role.allowed_resources.forEach((resource) => {
      rows.push(csvRow({ record_type: "role_resource", name: role.role_name, resource }));
    });
    role.selected_category_ids.forEach((categoryId) => {
      rows.push(csvRow({ record_type: "role_category", name: role.role_name, category_id: categoryId }));
    });
    role.allowed_product_skus.forEach((sku) => {
      rows.push(csvRow({ record_type: "role_product", name: role.role_name, sku }));
    });
  });

  bundle.purchase_controls?.templates.forEach((template) => {
    rows.push(csvRow({ record_type: "purchase_template", name: template.name }));
    template.rules.forEach((rule) => {
      rows.push(csvRow({
        record_type: "purchase_rule",
        name: template.name,
        sku: rule.sku,
        quantity_limit: rule.quantity_limit,
        duration_days: rule.duration_days,
        start_date: rule.start_date,
      }));
    });
    template.assigned_role_names.forEach((roleName) => {
      rows.push(csvRow({ record_type: "template_role", name: template.name, role_name: roleName }));
    });
  });

  return `\uFEFF${stringifyCsv(rows)}\r\n`;
}

export function exampleCompanyControlsCsv() {
  const bundle: CompanyControlsBundle = {
    format: "example",
    schema_version: 2,
    company_id: 1000,
    company_catalog: {
      allow_public_catalog: false,
      category_restriction: true,
      allowed_category_ids: [12, 34],
      product_restriction: true,
      allowed_product_skus: ["PPE-GLOVE-M", "PPE-MASK-01"],
    },
    role_controls: [
      {
        role_name: "Buyer",
        sort_order: 10,
        allowed_resources: ["Magento_Sales::place_order"],
        selected_category_ids: [12],
        preselect_all_products: false,
        allowed_product_skus: ["PPE-GLOVE-M"],
      },
      {
        role_name: "Approver",
        sort_order: 20,
        allowed_resources: ["Magento_Sales::all"],
        selected_category_ids: [12, 34],
        preselect_all_products: true,
        allowed_product_skus: [],
      },
    ],
    purchase_controls: {
      templates: [
        {
          name: "Monthly PPE",
          rules: [{ sku: "PPE-GLOVE-M", quantity_limit: 4, duration_days: 30, start_date: "2026-09-01" }],
          assigned_role_names: ["Buyer"],
        },
      ],
    },
  };
  return exportCompanyControlsCsv(bundle);
}
