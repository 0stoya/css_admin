import { parseCsv } from "@/lib/csv";
import { getAllCompanies, type CompanySummary } from "@/lib/graphql/companies";
import { getCompanyCatalogProducts } from "@/lib/graphql/company-catalog-products";
import {
  getCompanyManagement,
  type CompanyManagement,
} from "@/lib/graphql/company-management";
import {
  applyPurchaseControlTemplate,
  assignPurchaseControlTemplate,
  getPurchaseControls,
  savePurchaseControlTemplate,
  type PurchaseControlTemplate,
  type PurchaseControlsOverview,
  type SavePurchaseControlRuleInput,
} from "@/lib/graphql/purchase-controls";
import type { FlatCompanyImportRow, ImportRowStatus } from "@/lib/import-export-types";

const MAX_ROWS = 5000;
const CSV_HEADERS = [
  "company_ref",
  "record_type",
  "template_name",
  "sku",
  "quantity_limit",
  "duration_days",
  "start_date",
  "role_name",
] as const;
const RECORD_TYPES = new Set(["purchase_template", "purchase_rule", "template_role"]);

type ResolvedCompany = CompanySummary & { reference: string };
type ParsedRule = SavePurchaseControlRuleInput & { sourceRow: number };
type ParsedTemplate = {
  companyRef: string;
  name: string;
  declarationRow: number;
  defined: boolean;
  rules: ParsedRule[];
  assignedRoleNames: string[];
};
type PlannedRow = FlatCompanyImportRow & { companyId: number | null };
type CompanyContext = {
  overview: PurchaseControlsOverview;
  management: CompanyManagement;
};
type TemplateChange = {
  row: PlannedRow;
  template: ParsedTemplate;
  existing: PurchaseControlTemplate | null;
  desiredRoleIds: number[];
};
type CompanyPlan = {
  company: ResolvedCompany;
  rows: PlannedRow[];
  changes: TemplateChange[];
};

export type BulkPurchaseControlsOptions = {
  createMissingTemplates: boolean;
  applyPurchaseTemplates: boolean;
  onlyCompanyRefs?: string[];
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function messageOf(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }
  return fallback;
}

function asStatus(status: ImportRowStatus) {
  return status;
}

function errorRow(row: number, companyRef: string, item: string, message: string): PlannedRow {
  return {
    row,
    company_ref: companyRef,
    company_name: "",
    companyId: null,
    item,
    status: asStatus("Error"),
    message,
  };
}

function plannedRow(
  row: number,
  company: ResolvedCompany,
  item: string,
  status: ImportRowStatus,
  message: string,
): PlannedRow {
  return {
    row,
    company_ref: company.reference,
    company_name: company.name,
    companyId: company.company_id,
    item,
    status,
    message,
  };
}

function publicRow(row: PlannedRow): FlatCompanyImportRow {
  return {
    row: row.row,
    company_ref: row.company_ref,
    company_name: row.company_name,
    item: row.item,
    status: row.status,
    message: row.message,
  };
}

function requiredText(value: string, label: string, row: number) {
  const text = value.trim();
  if (!text) throw new Error(`Row ${row}: ${label} is required.`);
  return text;
}

function requiredPositiveInteger(value: string, label: string, row: number) {
  const text = requiredText(value, label, row);
  const number = Number(text);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Row ${row}: ${label} must be a positive integer.`);
  }
  return number;
}

function requiredDate(value: string, row: number) {
  const text = requiredText(value, "start_date", row);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`Row ${row}: start_date must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`Row ${row}: start_date must be a valid YYYY-MM-DD date.`);
  }
  return text;
}

function parseExactCsv(source: string) {
  const rows = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!rows.length) throw new Error("The purchase-controls CSV file is empty.");
  if (rows.length - 1 > MAX_ROWS) {
    throw new Error(`Purchase-controls CSV import is limited to ${MAX_ROWS.toLocaleString()} data rows per preview.`);
  }

  const headers = rows[0].map(normalized);
  if (
    headers.length !== CSV_HEADERS.length
    || headers.some((header, index) => header !== CSV_HEADERS[index])
    || new Set(headers).size !== headers.length
  ) {
    throw new Error(`CSV headers must be exactly: ${CSV_HEADERS.join(", ")}.`);
  }
  if (rows.length === 1) throw new Error("The purchase-controls CSV file contains no data rows.");
  return rows.slice(1);
}

function sameStringSet(left: string[], right: string[]) {
  const a = [...new Set(left.map(normalized))].sort();
  const b = [...new Set(right.map(normalized))].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameRules(existing: PurchaseControlTemplate["rules"], desired: ParsedRule[]) {
  const key = (rule: {
    sku: string;
    quantity_limit: number;
    duration_days: number;
    start_date: string;
  }) => [
    normalized(rule.sku),
    String(rule.quantity_limit),
    String(rule.duration_days),
    rule.start_date.trim(),
  ].join("\u0000");
  const a = existing.map(key).sort();
  const b = desired.map(key).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function companyResolver(refs: string[]) {
  const requested = new Set(refs.map(normalized).filter(Boolean));
  const all = await getAllCompanies();
  const byRef = new Map<string, ResolvedCompany>();
  const duplicates = new Set<string>();

  all.forEach((company) => {
    const reference = company.reference?.trim();
    if (!reference) return;
    const key = normalized(reference);
    if (!requested.has(key)) return;
    if (byRef.has(key)) duplicates.add(key);
    else byRef.set(key, { ...company, reference });
  });
  duplicates.forEach((key) => byRef.delete(key));
  return byRef;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, work: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, worker));
  return results;
}

function parsePurchaseControls(source: string, options: BulkPurchaseControlsOptions) {
  const rows = parseExactCsv(source);
  const selectedRefs = options.onlyCompanyRefs?.length
    ? new Set(options.onlyCompanyRefs.map(normalized).filter(Boolean))
    : null;
  const templates = new Map<string, ParsedTemplate>();
  const errors: PlannedRow[] = [];
  const roleOwners = new Map<string, string>();

  function templateKey(companyRef: string, templateName: string) {
    return `${normalized(companyRef)}\u0000${normalized(templateName)}`;
  }

  function ensureTemplate(companyRef: string, templateName: string, row: number) {
    const key = templateKey(companyRef, templateName);
    const existing = templates.get(key);
    if (existing) return existing;
    const created: ParsedTemplate = {
      companyRef,
      name: templateName,
      declarationRow: row,
      defined: false,
      rules: [],
      assignedRoleNames: [],
    };
    templates.set(key, created);
    return created;
  }

  rows.forEach((values, index) => {
    const row = index + 2;
    const companyRef = (values[0] ?? "").trim();
    const recordType = normalized(values[1] ?? "");
    const templateName = (values[2] ?? "").trim();

    if (!companyRef) {
      errors.push(errorRow(row, "", templateName, "company_ref is required."));
      return;
    }
    if (selectedRefs && !selectedRefs.has(normalized(companyRef))) return;
    if (!RECORD_TYPES.has(recordType)) {
      errors.push(errorRow(
        row,
        companyRef,
        templateName,
        "record_type must be purchase_template, purchase_rule, or template_role.",
      ));
      return;
    }
    if (!templateName) {
      errors.push(errorRow(row, companyRef, "", "template_name is required."));
      return;
    }

    const template = ensureTemplate(companyRef, templateName, row);
    if (recordType === "purchase_template") {
      if (template.defined) {
        errors.push(errorRow(row, companyRef, templateName, "Purchase template is defined more than once for this company."));
        return;
      }
      template.defined = true;
      template.declarationRow = row;
      return;
    }

    if (recordType === "purchase_rule") {
      try {
        const sku = requiredText(values[3] ?? "", "sku", row);
        if (template.rules.some((rule) => normalized(rule.sku) === normalized(sku))) {
          throw new Error(`Row ${row}: SKU ${sku} appears more than once in purchase template “${templateName}”.`);
        }
        template.rules.push({
          sku,
          quantity_limit: requiredPositiveInteger(values[4] ?? "", "quantity_limit", row),
          duration_days: requiredPositiveInteger(values[5] ?? "", "duration_days", row),
          start_date: requiredDate(values[6] ?? "", row),
          sourceRow: row,
        });
      } catch (error) {
        errors.push(errorRow(row, companyRef, templateName, messageOf(error, "Invalid purchase rule.")));
      }
      return;
    }

    try {
      const roleName = requiredText(values[7] ?? "", "role_name", row);
      const roleKey = `${normalized(companyRef)}\u0000${normalized(roleName)}`;
      const owner = roleOwners.get(roleKey);
      if (owner && owner !== normalized(templateName)) {
        throw new Error(`Row ${row}: role “${roleName}” is assigned to more than one purchase template for this company.`);
      }
      roleOwners.set(roleKey, normalized(templateName));
      if (template.assignedRoleNames.some((name) => normalized(name) === normalized(roleName))) {
        throw new Error(`Row ${row}: role “${roleName}” is assigned more than once to purchase template “${templateName}”.`);
      }
      template.assignedRoleNames.push(roleName);
    } catch (error) {
      errors.push(errorRow(row, companyRef, templateName, messageOf(error, "Invalid template role.")));
    }
  });

  [...templates.values()].forEach((template) => {
    if (!template.defined) {
      errors.push(errorRow(
        template.declarationRow,
        template.companyRef,
        template.name,
        `Purchase template “${template.name}” is referenced without a purchase_template row.`,
      ));
    }
  });

  if (selectedRefs && !templates.size && !errors.length) {
    throw new Error("No purchase-control rows matched the companies selected for retry.");
  }

  return { templates: [...templates.values()].filter((template) => template.defined), errors };
}

async function planPurchaseControls(source: string, options: BulkPurchaseControlsOptions) {
  const parsed = parsePurchaseControls(source, options);
  const resolver = await companyResolver(parsed.templates.map((template) => template.companyRef));
  const companies = parsed.templates
    .map((template) => resolver.get(normalized(template.companyRef)))
    .filter((company): company is ResolvedCompany => Boolean(company));
  const uniqueCompanies = new Map(companies.map((company) => [company.company_id, company]));
  const contextEntries = await mapWithConcurrency([...uniqueCompanies.values()], 5, async (company) => [
    company.company_id,
    {
      overview: await getPurchaseControls(company.company_id),
      management: await getCompanyManagement(company.company_id),
    } satisfies CompanyContext,
  ] as const);
  const contexts = new Map(contextEntries);
  const availabilityCache = new Map<string, Promise<boolean>>();
  const plansByCompany = new Map<number, CompanyPlan>();
  const allRows: PlannedRow[] = [...parsed.errors];

  async function skuAvailable(companyId: number, sku: string) {
    const key = `${companyId}\u0000${normalized(sku)}`;
    let pending = availabilityCache.get(key);
    if (!pending) {
      pending = getCompanyCatalogProducts(companyId, 1, 50, sku)
        .then((result) => result.items.some((product) => normalized(product.sku) === normalized(sku)));
      availabilityCache.set(key, pending);
    }
    return pending;
  }

  for (const template of parsed.templates) {
    const company = resolver.get(normalized(template.companyRef));
    if (!company) {
      allRows.push(errorRow(
        template.declarationRow,
        template.companyRef,
        template.name,
        "company_ref was not found or is ambiguous.",
      ));
      continue;
    }

    const context = contexts.get(company.company_id)!;
    const existing = context.overview.templates.find((item) => normalized(item.name) === normalized(template.name)) ?? null;
    if (!existing && !options.createMissingTemplates) {
      allRows.push(plannedRow(
        template.declarationRow,
        company,
        template.name,
        "Error",
        "Purchase template does not exist. Enable Create missing templates to add it.",
      ));
      continue;
    }

    const rolesByName = new Map(context.management.roles.map((role) => [normalized(role.name), role]));
    const missingRoles = template.assignedRoleNames.filter((name) => !rolesByName.has(normalized(name)));
    if (missingRoles.length) {
      allRows.push(plannedRow(
        template.declarationRow,
        company,
        template.name,
        "Error",
        `Company role${missingRoles.length === 1 ? "" : "s"} not found: ${missingRoles.join(", ")}.`,
      ));
      continue;
    }

    const skuChecks = await Promise.all(template.rules.map(async (rule) => ({
      rule,
      available: await skuAvailable(company.company_id, rule.sku),
    })));
    const unavailable = skuChecks.filter((check) => !check.available).map((check) => check.rule.sku);
    if (unavailable.length) {
      allRows.push(plannedRow(
        template.declarationRow,
        company,
        template.name,
        "Error",
        `${unavailable.length === 1 ? "SKU" : "SKUs"} not available in this company catalogue: ${unavailable.join(", ")}.`,
      ));
      continue;
    }

    let plan = plansByCompany.get(company.company_id);
    if (!plan) {
      plan = { company, rows: [], changes: [] };
      plansByCompany.set(company.company_id, plan);
    }

    const existingRoleNames = existing?.assigned_roles.map((role) => role.role_name) ?? [];
    const unchanged = Boolean(existing)
      && sameRules(existing!.rules, template.rules)
      && sameStringSet(existingRoleNames, template.assignedRoleNames);
    const status: ImportRowStatus = existing
      ? (unchanged && !options.applyPurchaseTemplates ? "Skipped" : "Updated")
      : "Created";
    const message = !existing
      ? `Template will be created with ${template.rules.length} rule${template.rules.length === 1 ? "" : "s"} and ${template.assignedRoleNames.length} role assignment${template.assignedRoleNames.length === 1 ? "" : "s"}.`
      : unchanged
        ? (options.applyPurchaseTemplates
          ? "Template is unchanged; it will be reapplied to assigned users."
          : "No template changes detected.")
        : `Template rules/role assignments will be updated (${template.rules.length} rule${template.rules.length === 1 ? "" : "s"}).`;

    const row = plannedRow(template.declarationRow, company, template.name, status, message);
    plan.rows.push(row);
    allRows.push(row);
    if (status === "Created" || status === "Updated") {
      plan.changes.push({
        row,
        template,
        existing,
        desiredRoleIds: template.assignedRoleNames.map((name) => rolesByName.get(normalized(name))!.role_id),
      });
    }
  }

  return { rows: allRows, plans: [...plansByCompany.values()] };
}

function assertNoErrors(rows: PlannedRow[]) {
  if (rows.some((row) => row.status === "Error")) {
    throw new Error("Resolve every preview error before applying this import.");
  }
}

function saveRules(rules: ParsedRule[]): SavePurchaseControlRuleInput[] {
  return rules.map(({ sourceRow: _sourceRow, ...rule }) => rule);
}

async function applyPlans(plans: CompanyPlan[], options: BulkPurchaseControlsOptions) {
  for (const plan of plans) {
    for (const change of plan.changes) {
      try {
        const savedResult = await savePurchaseControlTemplate(plan.company.company_id, {
          ...(change.existing ? { template_id: change.existing.template_id } : {}),
          name: change.template.name,
          rules: saveRules(change.template.rules),
        });
        const templateId = savedResult.cssAdminSavePurchaseControlTemplate.template_id;
        const currentRoleIds = new Set(change.existing?.assigned_roles.map((role) => role.role_id) ?? []);
        const desiredRoleIds = new Set(change.desiredRoleIds);

        for (const roleId of currentRoleIds) {
          if (!desiredRoleIds.has(roleId)) {
            await assignPurchaseControlTemplate(plan.company.company_id, roleId, null, false);
          }
        }
        for (const roleId of desiredRoleIds) {
          if (!currentRoleIds.has(roleId)) {
            await assignPurchaseControlTemplate(plan.company.company_id, roleId, templateId, false);
          }
        }

        if (options.applyPurchaseTemplates) {
          const applied = await applyPurchaseControlTemplate(plan.company.company_id, templateId);
          const affected = applied.cssAdminApplyPurchaseControlTemplate.affected_users;
          change.row.message = `Applied by Fluid. ${affected} user${affected === 1 ? "" : "s"} refreshed for this template.`;
        } else {
          change.row.message = "Applied by Fluid.";
        }
      } catch (error) {
        change.row.status = "Error";
        change.row.message = `Apply failed: ${messageOf(error, "Fluid rejected the purchase-control update.")}`;
      }
    }
  }
}

export async function previewBulkPurchaseControlsCsv(source: string, options: BulkPurchaseControlsOptions) {
  const plan = await planPurchaseControls(source, options);
  return plan.rows.map(publicRow);
}

export async function applyBulkPurchaseControlsCsv(source: string, options: BulkPurchaseControlsOptions) {
  const plan = await planPurchaseControls(source, options);
  assertNoErrors(plan.rows);
  await applyPlans(plan.plans, options);
  return plan.rows.map(publicRow);
}
