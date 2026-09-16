import { parseCsv, stringifyCsv } from "@/lib/csv";
import { getAllCompanies, type CompanySummary } from "@/lib/graphql/companies";
import {
  getCompanyControlsBundle,
  importCompanyControls,
  type CompanyControlsBundle,
  type CompanyControlsImportInput,
} from "@/lib/graphql/company-controls";
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

type PurchaseTemplate = NonNullable<CompanyControlsBundle["purchase_controls"]>["templates"][number];
type ResolvedCompany = CompanySummary & { reference: string };

type ParsedTemplate = PurchaseTemplate & {
  companyRef: string;
  declarationRow: number;
  defined: boolean;
};

type PlannedRow = FlatCompanyImportRow & {
  companyId: number | null;
};

type CompanyPlan = {
  company: ResolvedCompany;
  bundle: CompanyControlsBundle;
  rows: PlannedRow[];
};

export type BulkPurchaseControlsOptions = {
  createMissingTemplates: boolean;
  applyPurchaseTemplates: boolean;
  onlyCompanyRefs?: string[];
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
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

function sameRules(left: PurchaseTemplate["rules"], right: PurchaseTemplate["rules"]) {
  const key = (rule: PurchaseTemplate["rules"][number]) => [
    normalized(rule.sku),
    String(rule.quantity_limit),
    String(rule.duration_days),
    rule.start_date.trim(),
  ].join("\u0000");
  const a = left.map(key).sort();
  const b = right.map(key).sort();
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

function controlsInput(
  bundle: CompanyControlsBundle,
  options: BulkPurchaseControlsOptions,
  dryRun: boolean,
): CompanyControlsImportInput {
  return {
    ...bundle,
    create_missing_roles: false,
    create_missing_templates: options.createMissingTemplates,
    apply_purchase_templates: options.applyPurchaseTemplates,
    dry_run: dryRun,
  };
}

function cloneBundle(bundle: CompanyControlsBundle): CompanyControlsBundle {
  return JSON.parse(JSON.stringify(bundle)) as CompanyControlsBundle;
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
      assigned_role_names: [],
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
      template.name = templateName;
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
        });
      } catch (error) {
        errors.push(errorRow(row, companyRef, templateName, error instanceof Error ? error.message : "Invalid purchase rule."));
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
      if (template.assigned_role_names.some((name) => normalized(name) === normalized(roleName))) {
        throw new Error(`Row ${row}: role “${roleName}” is assigned more than once to purchase template “${templateName}”.`);
      }
      template.assigned_role_names.push(roleName);
    } catch (error) {
      errors.push(errorRow(row, companyRef, templateName, error instanceof Error ? error.message : "Invalid template role."));
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
  const controlEntries = await mapWithConcurrency([...uniqueCompanies.values()], 5, async (company) => [
    company.company_id,
    await getCompanyControlsBundle(company.company_id),
  ] as const);
  const controlsByCompany = new Map(controlEntries);
  const plansByCompany = new Map<number, CompanyPlan>();
  const allRows: PlannedRow[] = [...parsed.errors];

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

    const current = controlsByCompany.get(company.company_id)!;
    if (current.schema_version < 2) {
      allRows.push(plannedRow(
        template.declarationRow,
        company,
        template.name,
        "Error",
        `Fluid controls schema v${current.schema_version} does not support purchase templates.`,
      ));
      continue;
    }

    let plan = plansByCompany.get(company.company_id);
    if (!plan) {
      const bundle = cloneBundle(current);
      bundle.purchase_controls = { templates: [] };
      plan = { company, bundle, rows: [] };
      plansByCompany.set(company.company_id, plan);
    }

    const existing = current.purchase_controls?.templates.find((item) => normalized(item.name) === normalized(template.name));
    if (!existing && !options.createMissingTemplates) {
      const row = plannedRow(
        template.declarationRow,
        company,
        template.name,
        "Error",
        "Purchase template does not exist. Enable Create missing templates to add it.",
      );
      plan.rows.push(row);
      allRows.push(row);
      continue;
    }

    const unchanged = Boolean(existing)
      && sameRules(existing!.rules, template.rules)
      && sameStringSet(existing!.assigned_role_names, template.assigned_role_names);
    const status: ImportRowStatus = existing
      ? (unchanged && !options.applyPurchaseTemplates ? "Skipped" : "Updated")
      : "Created";
    const message = !existing
      ? `Template will be created with ${template.rules.length} rule${template.rules.length === 1 ? "" : "s"} and ${template.assigned_role_names.length} role assignment${template.assigned_role_names.length === 1 ? "" : "s"}.`
      : unchanged
        ? (options.applyPurchaseTemplates
          ? "Template is unchanged; it will be reapplied to assigned users."
          : "No template changes detected.")
        : `Template rules/role assignments will be updated (${template.rules.length} rule${template.rules.length === 1 ? "" : "s"}).`;

    const row = plannedRow(template.declarationRow, company, template.name, status, message);
    plan.bundle.purchase_controls!.templates.push({
      name: template.name,
      rules: template.rules,
      assigned_role_names: template.assigned_role_names,
    });
    plan.rows.push(row);
    allRows.push(row);
  }

  return { rows: allRows, plans: [...plansByCompany.values()] };
}

async function dryRunPlans(plans: CompanyPlan[], options: BulkPurchaseControlsOptions) {
  for (const plan of plans) {
    const actionable = plan.rows.filter((row) => row.status === "Created" || row.status === "Updated");
    if (!actionable.length) continue;
    try {
      const result = await importCompanyControls(controlsInput(plan.bundle, options, true));
      if (!result.valid) throw new Error("Fluid did not accept the dry run.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fluid rejected the dry run.";
      actionable.forEach((row) => {
        row.status = "Error";
        row.message = `Dry run rejected: ${message}`;
      });
    }
  }
}

function assertNoErrors(rows: PlannedRow[]) {
  if (rows.some((row) => row.status === "Error")) {
    throw new Error("Resolve every preview error before applying this import.");
  }
}

async function applyPlans(plans: CompanyPlan[], options: BulkPurchaseControlsOptions) {
  for (const plan of plans) {
    const actionable = plan.rows.filter((row) => row.status === "Created" || row.status === "Updated");
    if (!actionable.length) continue;

    try {
      const dryRun = await importCompanyControls(controlsInput(plan.bundle, options, true));
      if (!dryRun.valid) throw new Error("Fluid did not accept the dry run.");
      const result = await importCompanyControls(controlsInput(plan.bundle, options, false));
      if (!result.applied) throw new Error("Fluid did not report the import as applied.");

      actionable.forEach((row, index) => {
        row.message = index === 0 && options.applyPurchaseTemplates
          ? `Applied by Fluid. ${result.purchase_template_users_applied} user${result.purchase_template_users_applied === 1 ? "" : "s"} refreshed for this company.`
          : "Applied by Fluid.";
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fluid rejected the import.";
      actionable.forEach((row) => {
        row.status = "Error";
        row.message = `Apply failed: ${message}`;
      });
    }
  }
}

export async function previewBulkPurchaseControlsCsv(source: string, options: BulkPurchaseControlsOptions) {
  const plan = await planPurchaseControls(source, options);
  await dryRunPlans(plan.plans, options);
  return plan.rows.map(publicRow);
}

export async function applyBulkPurchaseControlsCsv(source: string, options: BulkPurchaseControlsOptions) {
  const plan = await planPurchaseControls(source, options);
  assertNoErrors(plan.rows);
  await applyPlans(plan.plans, options);
  return plan.rows.map(publicRow);
}

function csvWithBom(rows: Array<Array<string | number>>) {
  return `\uFEFF${stringifyCsv(rows)}\r\n`;
}

export function exampleBulkPurchaseControlsCsv(primaryCompanyRef = "ABC001") {
  return csvWithBom([
    [...CSV_HEADERS],
    [primaryCompanyRef, "purchase_template", "Monthly PPE", "", "", "", "", ""],
    [primaryCompanyRef, "purchase_rule", "Monthly PPE", "PPE-GLOVE-M", 4, 30, "2026-09-01", ""],
    [primaryCompanyRef, "purchase_rule", "Monthly PPE", "PPE-MASK-01", 10, 30, "2026-09-01", ""],
    [primaryCompanyRef, "template_role", "Monthly PPE", "", "", "", "", "Buyer"],
    ["XYZ002", "purchase_template", "Standard Allowance", "", "", "", "", ""],
    ["XYZ002", "purchase_rule", "Standard Allowance", "STATIONERY-01", 2, 14, "2026-09-01", ""],
    ["XYZ002", "template_role", "Standard Allowance", "", "", "", "", "Employee"],
  ]);
}

export async function exportBulkPurchaseControlsCsv() {
  const companies = (await getAllCompanies())
    .filter((company): company is ResolvedCompany => Boolean(company.reference?.trim()))
    .map((company) => ({ ...company, reference: company.reference!.trim() }));
  const data = await mapWithConcurrency(companies, 5, async (company) => ({
    company,
    controls: await getCompanyControlsBundle(company.company_id),
  }));
  const rows: Array<Array<string | number>> = [[...CSV_HEADERS]];

  data.forEach(({ company, controls }) => {
    controls.purchase_controls?.templates.forEach((template) => {
      rows.push([company.reference, "purchase_template", template.name, "", "", "", "", ""]);
      template.rules.forEach((rule) => {
        rows.push([
          company.reference,
          "purchase_rule",
          template.name,
          rule.sku,
          rule.quantity_limit,
          rule.duration_days,
          rule.start_date,
          "",
        ]);
      });
      template.assigned_role_names.forEach((roleName) => {
        rows.push([company.reference, "template_role", template.name, "", "", "", "", roleName]);
      });
    });
  });

  return csvWithBom(rows);
}
