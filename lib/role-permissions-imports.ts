import { parseCsv } from "@/lib/csv";
import { getCompanies, getCompany, type CompanySummary } from "@/lib/graphql/companies";
import {
  getCompanyManagement,
  type CompanyAdminResource,
  type CompanyAdminRole,
  type CompanyManagement,
} from "@/lib/graphql/company-management";
import {
  importCompanyControls,
  type CompanyControlsBundle,
  type CompanyControlsImportInput,
} from "@/lib/graphql/company-controls";
import type { FlatCompanyImportRow, ImportRowStatus } from "@/lib/import-export-types";

const MAX_ROWS = 5000;
const TRUE_VALUES = new Set(["1", "true", "yes", "y"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", ""]);
const ROLE_CONTROLS_FORMAT = "fluid-company-role-controls";

type ScopedImportOptions = {
  lockedCompanyId?: number | null;
};

export type RoleImportOptions = ScopedImportOptions & {
  createMissingRoles: boolean;
};

type ResolvedCompany = CompanySummary & { reference: string };
type RoleControl = CompanyControlsBundle["role_controls"][number];

type PlannedRow = FlatCompanyImportRow & {
  companyId: number | null;
};

type RoleCompanyPlan = {
  company: ResolvedCompany;
  management: CompanyManagement;
  roleControls: RoleControl[];
  rows: PlannedRow[];
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function normalizedRef(value: string) {
  return normalized(value);
}

function asStatus(status: ImportRowStatus) {
  return status;
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

function changedRow(
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

function ensureRowLimit(rows: string[][]) {
  if (rows.length - 1 > MAX_ROWS) {
    throw new Error(`CSV import is limited to ${MAX_ROWS.toLocaleString()} data rows per preview.`);
  }
}

async function getAllCompanies() {
  const companies: CompanySummary[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await getCompanies(page, 100);
    companies.push(...result.items);
    totalPages = result.page_info.total_pages;
    page += 1;
  } while (page <= totalPages);
  return companies;
}

async function companyResolver(refs: string[], lockedCompanyId?: number | null) {
  const byRef = new Map<string, ResolvedCompany>();
  if (lockedCompanyId) {
    const company = await getCompany(lockedCompanyId);
    if (!company.reference?.trim()) {
      throw new Error("This company does not have a company reference and cannot use reference-keyed imports.");
    }
    byRef.set(normalizedRef(company.reference), { ...company, reference: company.reference.trim() });
    return byRef;
  }

  const requested = new Set(refs.map(normalizedRef).filter(Boolean));
  const all = await getAllCompanies();
  const duplicates = new Set<string>();
  all.forEach((company) => {
    const reference = company.reference?.trim();
    if (!reference) return;
    const key = normalizedRef(reference);
    if (!requested.has(key)) return;
    if (byRef.has(key)) duplicates.add(key);
    else byRef.set(key, { ...company, reference });
  });
  duplicates.forEach((key) => byRef.delete(key));
  return byRef;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  work: (item: T) => Promise<R>,
) {
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

async function managementContextsForCompanies(companies: ResolvedCompany[]) {
  const unique = new Map(companies.map((company) => [company.company_id, company]));
  const entries = await mapWithConcurrency([...unique.values()], 5, async (company) => [
    company.company_id,
    { company, management: await getCompanyManagement(company.company_id) },
  ] as const);
  return new Map(entries);
}

function roleByName(roles: CompanyAdminRole[]) {
  return new Map(roles.map((role) => [normalized(role.name), role]));
}

function sameStringSet(left: string[], right: string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export type RolePermissionColumn = {
  header: string;
  resourceId: string;
};

export function rolePermissionColumns(resources: CompanyAdminResource[]): RolePermissionColumn[] {
  const byId = new Map(resources.map((resource) => [resource.resource_id, resource]));
  const base = resources.filter((resource) => resource.assignable).map((resource) => {
    const titles: string[] = [];
    let current: CompanyAdminResource | undefined = resource;
    const visited = new Set<string>();
    while (current && !visited.has(current.resource_id)) {
      visited.add(current.resource_id);
      titles.unshift(current.title.trim());
      current = current.parent_resource_id ? byId.get(current.parent_resource_id) : undefined;
    }
    if (titles.length > 1 && normalized(titles[0]) === "all") titles.shift();
    return {
      resourceId: resource.resource_id,
      baseHeader: titles.filter(Boolean).join(" > ") || resource.title,
    };
  });
  const counts = new Map<string, number>();
  base.forEach((column) => counts.set(column.baseHeader, (counts.get(column.baseHeader) ?? 0) + 1));
  return base.map((column) => ({
    resourceId: column.resourceId,
    header: (counts.get(column.baseHeader) ?? 0) > 1
      ? `${column.baseHeader} [${column.resourceId}]`
      : column.baseHeader,
  }));
}

function permissionBoolean(value: string, header: string, row: number) {
  const key = normalized(value);
  if (TRUE_VALUES.has(key)) return true;
  if (FALSE_VALUES.has(key)) return false;
  throw new Error(`Row ${row}: permission “${header}” must be 1/0, true/false, yes/no, or blank.`);
}

function parseSortOrder(value: string, row: number) {
  const text = value.trim();
  if (!text) return 0;
  const number = Number(text);
  if (!Number.isInteger(number)) {
    throw new Error(`Row ${row}: sort_order must be an integer or blank.`);
  }
  return number;
}

function roleOnlyInput(
  plan: RoleCompanyPlan,
  dryRun: boolean,
  createMissingRoles: boolean,
): CompanyControlsImportInput {
  return {
    format: ROLE_CONTROLS_FORMAT,
    schema_version: 1,
    company_id: plan.company.company_id,
    // Required by the shared GraphQL input shape, but deliberately ignored by
    // Fluid for the role-only format so catalogue state is never revalidated.
    company_catalog: {
      allow_public_catalog: false,
      category_restriction: false,
      allowed_category_ids: [],
      product_restriction: false,
      allowed_product_skus: [],
    },
    role_controls: plan.roleControls,
    create_missing_roles: createMissingRoles,
    create_missing_templates: false,
    apply_purchase_templates: false,
    dry_run: dryRun,
  };
}

async function planRolesPermissions(source: string, options: RoleImportOptions) {
  const raw = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!raw.length) throw new Error("The roles CSV file is empty.");
  ensureRowLimit(raw);

  const headers = raw[0].map((value) => value.trim());
  const normalizedHeaders = headers.map(normalized);
  const fixed = ["user_role", "company_ref", "sort_order"];
  if (
    normalizedHeaders.length < fixed.length + 1
    || fixed.some((header, index) => normalizedHeaders[index] !== header)
  ) {
    throw new Error(
      "Roles CSV must start with: user_role, company_ref, sort_order, followed by Fluid permission columns.",
    );
  }
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new Error("Roles CSV contains duplicate column names.");
  }

  const permissionHeaders = headers.slice(3);
  const data = raw.slice(1);
  if (!data.length) throw new Error("The roles CSV contains no role rows.");

  const parsed = data.map((values, index) => {
    const row = index + 2;
    const roleName = (values[0] ?? "").trim();
    const companyRef = (values[1] ?? "").trim();
    let parseError: string | null = null;
    let sortOrder = 0;
    if (!roleName) parseError = "user_role is required.";
    else if (!companyRef) parseError = "company_ref is required.";
    try {
      sortOrder = parseSortOrder(values[2] ?? "", row);
    } catch (error) {
      parseError = error instanceof Error ? error.message : "Invalid sort_order.";
    }
    return { row, roleName, companyRef, sortOrder, values, parseError };
  });

  const resolver = await companyResolver(
    parsed.map((row) => row.companyRef),
    options.lockedCompanyId,
  );
  const resolvedCompanies = parsed
    .map((row) => resolver.get(normalizedRef(row.companyRef)))
    .filter((company): company is ResolvedCompany => Boolean(company));
  const contexts = await managementContextsForCompanies(resolvedCompanies);
  const plansByCompany = new Map<number, RoleCompanyPlan>();
  const allRows: PlannedRow[] = [];
  const duplicateKeys = new Map<string, number>();

  parsed.forEach((row) => {
    const key = `${normalizedRef(row.companyRef)}\u0000${normalized(row.roleName)}`;
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  });

  for (const parsedRow of parsed) {
    if (parsedRow.parseError) {
      allRows.push(errorRow(parsedRow.row, parsedRow.companyRef, parsedRow.roleName, parsedRow.parseError));
      continue;
    }

    const company = resolver.get(normalizedRef(parsedRow.companyRef));
    if (!company) {
      allRows.push(errorRow(
        parsedRow.row,
        parsedRow.companyRef,
        parsedRow.roleName,
        "company_ref was not found or is ambiguous.",
      ));
      continue;
    }
    if (options.lockedCompanyId && company.company_id !== options.lockedCompanyId) {
      allRows.push(errorRow(
        parsedRow.row,
        parsedRow.companyRef,
        parsedRow.roleName,
        "company_ref does not match the company currently open.",
      ));
      continue;
    }

    const duplicateKey = `${normalizedRef(parsedRow.companyRef)}\u0000${normalized(parsedRow.roleName)}`;
    if ((duplicateKeys.get(duplicateKey) ?? 0) > 1) {
      allRows.push(changedRow(
        parsedRow.row,
        company,
        parsedRow.roleName,
        "Error",
        "Role appears more than once for this company.",
      ));
      continue;
    }

    const context = contexts.get(company.company_id)!;
    const columns = rolePermissionColumns(context.management.resources);
    if (
      columns.length !== permissionHeaders.length
      || columns.some((column, index) => column.header !== permissionHeaders[index])
    ) {
      allRows.push(changedRow(
        parsedRow.row,
        company,
        parsedRow.roleName,
        "Error",
        "Permission columns do not exactly match this company’s current Fluid resource tree. Download a fresh roles example/export.",
      ));
      continue;
    }

    let selected: string[] = [];
    try {
      selected = columns
        .filter((column, index) => permissionBoolean(
          parsedRow.values[index + 3] ?? "",
          column.header,
          parsedRow.row,
        ))
        .map((column) => column.resourceId);
    } catch (error) {
      allRows.push(changedRow(
        parsedRow.row,
        company,
        parsedRow.roleName,
        "Error",
        error instanceof Error ? error.message : "Invalid permission value.",
      ));
      continue;
    }

    let plan = plansByCompany.get(company.company_id);
    if (!plan) {
      plan = {
        company,
        management: context.management,
        roleControls: [],
        rows: [],
      };
      plansByCompany.set(company.company_id, plan);
    }

    const existing = roleByName(context.management.roles).get(normalized(parsedRow.roleName));
    if (existing && !existing.manageable) {
      const row = changedRow(
        parsedRow.row,
        company,
        parsedRow.roleName,
        "Error",
        "Fluid marks this role as protected/non-manageable.",
      );
      plan.rows.push(row);
      allRows.push(row);
      continue;
    }
    if (!existing && !options.createMissingRoles) {
      const row = changedRow(
        parsedRow.row,
        company,
        parsedRow.roleName,
        "Error",
        "Role does not exist. Enable Create missing roles to add it.",
      );
      plan.rows.push(row);
      allRows.push(row);
      continue;
    }

    const assignable = new Set(columns.map((column) => column.resourceId));
    const protectedExisting = (existing?.allowed_resources ?? [])
      .filter((resourceId) => !assignable.has(resourceId));
    const desiredResources = [...new Set([...protectedExisting, ...selected])];
    const unchanged = Boolean(existing)
      && existing!.sort_order === parsedRow.sortOrder
      && sameStringSet(existing!.allowed_resources, desiredResources);
    const status: ImportRowStatus = existing ? (unchanged ? "Skipped" : "Updated") : "Created";

    const row = changedRow(
      parsedRow.row,
      company,
      parsedRow.roleName,
      status,
      existing
        ? (unchanged ? "No changes detected." : "Role permissions will be updated.")
        : "Missing role will be created.",
    );
    plan.rows.push(row);
    allRows.push(row);

    if (status === "Created" || status === "Updated") {
      plan.roleControls.push({
        role_name: parsedRow.roleName,
        sort_order: parsedRow.sortOrder,
        allowed_resources: desiredResources,
        selected_category_ids: [],
        preselect_all_products: false,
        allowed_product_skus: [],
      });
    }
  }

  return { rows: allRows, plans: [...plansByCompany.values()] };
}

async function dryRunRolePlans(plans: RoleCompanyPlan[], createMissingRoles: boolean) {
  for (const plan of plans) {
    const actionable = plan.rows.filter(
      (row) => row.status === "Created" || row.status === "Updated",
    );
    if (!actionable.length) continue;

    try {
      const result = await importCompanyControls(roleOnlyInput(plan, true, createMissingRoles));
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

async function applyRolePlans(plans: RoleCompanyPlan[], createMissingRoles: boolean) {
  for (const plan of plans) {
    const actionable = plan.rows.filter(
      (row) => row.status === "Created" || row.status === "Updated",
    );
    if (!actionable.length) continue;

    try {
      const dryRun = await importCompanyControls(roleOnlyInput(plan, true, createMissingRoles));
      if (!dryRun.valid) throw new Error("Fluid did not accept the dry run.");
      const result = await importCompanyControls(roleOnlyInput(plan, false, createMissingRoles));
      if (!result.applied) throw new Error("Fluid did not report the import as applied.");
      actionable.forEach((row) => {
        row.message = row.status === "Created" ? "Created by Fluid." : "Updated by Fluid.";
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

function assertNoErrors(rows: PlannedRow[]) {
  if (rows.some((row) => row.status === "Error")) {
    throw new Error("Resolve every preview error before applying this import.");
  }
}

export async function previewRolesPermissionsCsv(source: string, options: RoleImportOptions) {
  const plan = await planRolesPermissions(source, options);
  await dryRunRolePlans(plan.plans, options.createMissingRoles);
  return plan.rows.map(publicRow);
}

export async function applyRolesPermissionsCsv(source: string, options: RoleImportOptions) {
  const plan = await planRolesPermissions(source, options);
  assertNoErrors(plan.rows);
  await applyRolePlans(plan.plans, options.createMissingRoles);
  return plan.rows.map(publicRow);
}
