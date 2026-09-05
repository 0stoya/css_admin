import { parseCsv, stringifyCsv } from "@/lib/csv";
import { getCompanies, getCompany, type CompanySummary } from "@/lib/graphql/companies";
import {
  addCompanyUser,
  getCompanyCustomerCandidates,
  getCompanyManagement,
  updateCompanyUser,
  type CompanyAdminResource,
  type CompanyAdminRole,
  type CompanyAdminUser,
  type CompanyManagement,
} from "@/lib/graphql/company-management";
import {
  getCompanyControlsBundle,
  importCompanyControls,
  type CompanyControlsBundle,
} from "@/lib/graphql/company-controls";
import type { FlatCompanyImportRow, ImportRowStatus } from "@/lib/import-export-types";

const MAX_ROWS = 5000;
const TRUE_VALUES = new Set(["1", "true", "yes", "y"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", ""]);

type ScopedImportOptions = {
  lockedCompanyId?: number | null;
};

type RoleImportOptions = ScopedImportOptions & {
  createMissingRoles: boolean;
};

type ResolvedCompany = CompanySummary & { reference: string };

type CompanyContext = {
  company: ResolvedCompany;
  management: CompanyManagement;
  controls: CompanyControlsBundle;
};

type PlannedRow = FlatCompanyImportRow & {
  companyId: number | null;
};

type ControlsCompanyPlan = {
  context: CompanyContext;
  bundle: CompanyControlsBundle;
  rows: PlannedRow[];
};

type UserPlannedRow = PlannedRow & {
  email: string;
  roleId: number | null;
  customerId: number | null;
  userId: number | null;
  managerId: number | null;
  approvalType: string;
  approvalThreshold: number | null;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

function normalizedRef(value: string) {
  return normalized(value);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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
  if (rows.length - 1 > MAX_ROWS) throw new Error(`CSV import is limited to ${MAX_ROWS.toLocaleString()} data rows per preview.`);
}

function parseExactCsv(source: string, expectedHeaders: readonly string[]) {
  const rows = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!rows.length) throw new Error("The CSV file is empty.");
  ensureRowLimit(rows);
  const headers = rows[0].map(normalized);
  const expected = expectedHeaders.map(normalized);
  if (
    headers.length !== expected.length
    || headers.some((header, index) => header !== expected[index])
    || new Set(headers).size !== headers.length
  ) {
    throw new Error(`CSV headers must be exactly: ${expectedHeaders.join(", ")}.`);
  }
  if (rows.length === 1) throw new Error("The CSV file contains no data rows.");
  return rows.slice(1);
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
    if (!company.reference?.trim()) throw new Error("This company does not have a company reference and cannot use reference-keyed imports.");
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

async function loadContext(company: ResolvedCompany): Promise<CompanyContext> {
  const [management, controls] = await Promise.all([
    getCompanyManagement(company.company_id),
    getCompanyControlsBundle(company.company_id),
  ]);
  return { company, management, controls };
}

async function contextsForCompanies(companies: ResolvedCompany[]) {
  const unique = new Map(companies.map((company) => [company.company_id, company]));
  const entries = await mapWithConcurrency([...unique.values()], 5, async (company) => [company.company_id, await loadContext(company)] as const);
  return new Map(entries);
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

function roleByName(roles: CompanyAdminRole[]) {
  return new Map(roles.map((role) => [normalized(role.name), role]));
}

function roleControlByName(bundle: CompanyControlsBundle) {
  return new Map(bundle.role_controls.map((role) => [normalized(role.role_name), role]));
}

function cloneBundle(bundle: CompanyControlsBundle): CompanyControlsBundle {
  return structuredClone(bundle);
}

function sameStringSet(left: string[], right: string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function controlsInput(bundle: CompanyControlsBundle, dryRun: boolean, createMissingRoles = false) {
  return {
    ...bundle,
    create_missing_roles: createMissingRoles,
    create_missing_templates: false,
    apply_purchase_templates: false,
    dry_run: dryRun,
  };
}

async function dryRunControlsPlans(plans: ControlsCompanyPlan[], createMissingRoles = false) {
  for (const plan of plans) {
    const actionable = plan.rows.filter((row) => row.status === "Created" || row.status === "Updated");
    if (!actionable.length) continue;
    try {
      const result = await importCompanyControls(controlsInput(plan.bundle, true, createMissingRoles));
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

async function applyControlsPlans(plans: ControlsCompanyPlan[], createMissingRoles = false) {
  for (const plan of plans) {
    const actionable = plan.rows.filter((row) => row.status === "Created" || row.status === "Updated");
    if (!actionable.length) continue;
    try {
      const dryRun = await importCompanyControls(controlsInput(plan.bundle, true, createMissingRoles));
      if (!dryRun.valid) throw new Error("Fluid did not accept the dry run.");
      const result = await importCompanyControls(controlsInput(plan.bundle, false, createMissingRoles));
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
    return { resourceId: resource.resource_id, baseHeader: titles.filter(Boolean).join(" > ") || resource.title };
  });
  const counts = new Map<string, number>();
  base.forEach((column) => counts.set(column.baseHeader, (counts.get(column.baseHeader) ?? 0) + 1));
  return base.map((column) => ({
    resourceId: column.resourceId,
    header: (counts.get(column.baseHeader) ?? 0) > 1 ? `${column.baseHeader} [${column.resourceId}]` : column.baseHeader,
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
  if (!Number.isInteger(number)) throw new Error(`Row ${row}: sort_order must be an integer or blank.`);
  return number;
}

async function planRolesPermissions(source: string, options: RoleImportOptions) {
  const raw = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ""));
  if (!raw.length) throw new Error("The roles CSV file is empty.");
  ensureRowLimit(raw);
  const headers = raw[0].map((value) => value.trim());
  const normalizedHeaders = headers.map(normalized);
  const fixed = ["user_role", "company_ref", "sort_order"];
  if (normalizedHeaders.length < fixed.length + 1 || fixed.some((header, index) => normalizedHeaders[index] !== header)) {
    throw new Error("Roles CSV must start with: user_role, company_ref, sort_order, followed by Fluid permission columns.");
  }
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new Error("Roles CSV contains duplicate column names.");
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
    try { sortOrder = parseSortOrder(values[2] ?? "", row); } catch (error) { parseError = error instanceof Error ? error.message : "Invalid sort_order."; }
    return { row, roleName, companyRef, sortOrder, values, parseError };
  });

  const resolver = await companyResolver(parsed.map((row) => row.companyRef), options.lockedCompanyId);
  const resolvedCompanies = parsed.map((row) => resolver.get(normalizedRef(row.companyRef))).filter((company): company is ResolvedCompany => Boolean(company));
  const contexts = await contextsForCompanies(resolvedCompanies);
  const plansByCompany = new Map<number, ControlsCompanyPlan>();
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
      allRows.push(errorRow(parsedRow.row, parsedRow.companyRef, parsedRow.roleName, "company_ref was not found or is ambiguous."));
      continue;
    }
    if (options.lockedCompanyId && company.company_id !== options.lockedCompanyId) {
      allRows.push(errorRow(parsedRow.row, parsedRow.companyRef, parsedRow.roleName, "company_ref does not match the company currently open."));
      continue;
    }
    const duplicateKey = `${normalizedRef(parsedRow.companyRef)}\u0000${normalized(parsedRow.roleName)}`;
    if ((duplicateKeys.get(duplicateKey) ?? 0) > 1) {
      allRows.push(changedRow(parsedRow.row, company, parsedRow.roleName, "Error", "Role appears more than once for this company."));
      continue;
    }
    const context = contexts.get(company.company_id)!;
    const columns = rolePermissionColumns(context.management.resources);
    if (columns.length !== permissionHeaders.length || columns.some((column, index) => column.header !== permissionHeaders[index])) {
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
      selected = columns.filter((column, index) => permissionBoolean(parsedRow.values[index + 3] ?? "", column.header, parsedRow.row)).map((column) => column.resourceId);
    } catch (error) {
      allRows.push(changedRow(parsedRow.row, company, parsedRow.roleName, "Error", error instanceof Error ? error.message : "Invalid permission value."));
      continue;
    }

    let plan = plansByCompany.get(company.company_id);
    if (!plan) {
      plan = { context, bundle: cloneBundle(context.controls), rows: [] };
      plansByCompany.set(company.company_id, plan);
    }
    const roles = roleByName(context.management.roles);
    const existing = roles.get(normalized(parsedRow.roleName));
    if (existing && !existing.manageable) {
      const row = changedRow(parsedRow.row, company, parsedRow.roleName, "Error", "Fluid marks this role as protected/non-manageable.");
      plan.rows.push(row); allRows.push(row); continue;
    }
    if (!existing && !options.createMissingRoles) {
      const row = changedRow(parsedRow.row, company, parsedRow.roleName, "Error", "Role does not exist. Enable Create missing roles to add it.");
      plan.rows.push(row); allRows.push(row); continue;
    }

    const bundleRoles = roleControlByName(plan.bundle);
    let control = bundleRoles.get(normalized(parsedRow.roleName));
    if (!control) {
      control = {
        role_name: parsedRow.roleName,
        sort_order: parsedRow.sortOrder,
        allowed_resources: [],
        selected_category_ids: [],
        preselect_all_products: false,
        allowed_product_skus: [],
      };
      plan.bundle.role_controls.push(control);
    }
    const assignable = new Set(columns.map((column) => column.resourceId));
    const protectedExisting = (existing?.allowed_resources ?? control.allowed_resources).filter((resourceId) => !assignable.has(resourceId));
    const desiredResources = [...new Set([...protectedExisting, ...selected])];
    const unchanged = Boolean(existing)
      && existing!.sort_order === parsedRow.sortOrder
      && sameStringSet(existing!.allowed_resources, desiredResources);
    control.role_name = parsedRow.roleName;
    control.sort_order = parsedRow.sortOrder;
    control.allowed_resources = desiredResources;
    const row = changedRow(
      parsedRow.row,
      company,
      parsedRow.roleName,
      existing ? (unchanged ? "Skipped" : "Updated") : "Created",
      existing ? (unchanged ? "No changes detected." : "Role permissions will be updated.") : "Missing role will be created.",
    );
    plan.rows.push(row); allRows.push(row);
  }

  return { rows: allRows, plans: [...plansByCompany.values()] };
}

export async function previewRolesPermissionsCsv(source: string, options: RoleImportOptions) {
  const plan = await planRolesPermissions(source, options);
  await dryRunControlsPlans(plan.plans, options.createMissingRoles);
  return plan.rows.map(publicRow);
}

export async function applyRolesPermissionsCsv(source: string, options: RoleImportOptions) {
  const plan = await planRolesPermissions(source, options);
  assertNoErrors(plan.rows);
  await applyControlsPlans(plan.plans, options.createMissingRoles);
  return plan.rows.map(publicRow);
}

type ProductGroup = {
  row: number;
  companyRef: string;
  roleName?: string;
  skus: string[];
  hasAll: boolean;
  hasBlank: boolean;
};

function parseRoleProducts(source: string) {
  const rows = parseExactCsv(source, ["sku", "user_role_name", "company_ref"]);
  const groups = new Map<string, ProductGroup>();
  const errors: PlannedRow[] = [];
  rows.forEach((values, index) => {
    const row = index + 2;
    const sku = (values[0] ?? "").trim();
    const roleName = (values[1] ?? "").trim();
    const companyRef = (values[2] ?? "").trim();
    if (!roleName || !companyRef) {
      errors.push(errorRow(row, companyRef, roleName || sku, !companyRef ? "company_ref is required." : "user_role_name is required."));
      return;
    }
    const key = `${normalizedRef(companyRef)}\u0000${normalized(roleName)}`;
    const group = groups.get(key) ?? { row, companyRef, roleName, skus: [], hasAll: false, hasBlank: false };
    if (sku === "*") group.hasAll = true;
    else if (!sku) group.hasBlank = true;
    else if (!group.skus.includes(sku)) group.skus.push(sku);
    groups.set(key, group);
  });
  return { groups: [...groups.values()], errors };
}

async function planRoleProducts(source: string, options: ScopedImportOptions) {
  const parsed = parseRoleProducts(source);
  const resolver = await companyResolver(parsed.groups.map((group) => group.companyRef), options.lockedCompanyId);
  const resolved = parsed.groups.map((group) => resolver.get(normalizedRef(group.companyRef))).filter((company): company is ResolvedCompany => Boolean(company));
  const contexts = await contextsForCompanies(resolved);
  const plansByCompany = new Map<number, ControlsCompanyPlan>();
  const allRows: PlannedRow[] = [...parsed.errors];

  for (const group of parsed.groups) {
    const company = resolver.get(normalizedRef(group.companyRef));
    const item = group.roleName ?? "";
    if (!company) { allRows.push(errorRow(group.row, group.companyRef, item, "company_ref was not found or is ambiguous.")); continue; }
    if (group.hasAll && (group.skus.length || group.hasBlank)) {
      allRows.push(changedRow(group.row, company, item, "Error", "SKU * must be the only row for a role; it means unrestricted/all products.")); continue;
    }
    if (group.hasBlank && group.skus.length) {
      allRows.push(changedRow(group.row, company, item, "Error", "A blank SKU must be the only row for a role; it means an explicit empty product allowlist.")); continue;
    }
    const context = contexts.get(company.company_id)!;
    const role = roleByName(context.management.roles).get(normalized(item));
    if (!role) { allRows.push(changedRow(group.row, company, item, "Error", "Role does not exist for this company.")); continue; }
    if (!role.manageable) { allRows.push(changedRow(group.row, company, item, "Error", "Fluid marks this role as protected/non-manageable.")); continue; }
    let plan = plansByCompany.get(company.company_id);
    if (!plan) { plan = { context, bundle: cloneBundle(context.controls), rows: [] }; plansByCompany.set(company.company_id, plan); }
    const control = roleControlByName(plan.bundle).get(normalized(item));
    if (!control) { const row = changedRow(group.row, company, item, "Error", "Fluid controls export did not include this role."); plan.rows.push(row); allRows.push(row); continue; }
    const desiredAll = group.hasAll;
    const desiredSkus = desiredAll || group.hasBlank ? [] : group.skus;
    const unchanged = control.preselect_all_products === desiredAll && sameStringSet(control.allowed_product_skus, desiredSkus);
    control.preselect_all_products = desiredAll;
    control.allowed_product_skus = desiredSkus;
    const row = changedRow(group.row, company, item, unchanged ? "Skipped" : "Updated", unchanged ? "No product restriction changes detected." : desiredAll ? "Role will be unrestricted across products." : `Role product allowlist will contain ${desiredSkus.length} SKU${desiredSkus.length === 1 ? "" : "s"}.`);
    plan.rows.push(row); allRows.push(row);
  }
  return { rows: allRows, plans: [...plansByCompany.values()] };
}

export async function previewRoleProductsCsv(source: string, options: ScopedImportOptions = {}) {
  const plan = await planRoleProducts(source, options);
  await dryRunControlsPlans(plan.plans);
  return plan.rows.map(publicRow);
}

export async function applyRoleProductsCsv(source: string, options: ScopedImportOptions = {}) {
  const plan = await planRoleProducts(source, options);
  assertNoErrors(plan.rows);
  await applyControlsPlans(plan.plans);
  return plan.rows.map(publicRow);
}

function parseCompanyProducts(source: string) {
  const rows = parseExactCsv(source, ["sku", "company_ref"]);
  const groups = new Map<string, ProductGroup>();
  const errors: PlannedRow[] = [];
  rows.forEach((values, index) => {
    const row = index + 2;
    const sku = (values[0] ?? "").trim();
    const companyRef = (values[1] ?? "").trim();
    if (!companyRef) { errors.push(errorRow(row, companyRef, sku, "company_ref is required.")); return; }
    const key = normalizedRef(companyRef);
    const group = groups.get(key) ?? { row, companyRef, skus: [], hasAll: false, hasBlank: false };
    if (sku === "*") group.hasAll = true;
    else if (!sku) group.hasBlank = true;
    else if (!group.skus.includes(sku)) group.skus.push(sku);
    groups.set(key, group);
  });
  return { groups: [...groups.values()], errors };
}

async function planCompanyProducts(source: string, options: ScopedImportOptions) {
  const parsed = parseCompanyProducts(source);
  const resolver = await companyResolver(parsed.groups.map((group) => group.companyRef), options.lockedCompanyId);
  const resolved = parsed.groups.map((group) => resolver.get(normalizedRef(group.companyRef))).filter((company): company is ResolvedCompany => Boolean(company));
  const contexts = await contextsForCompanies(resolved);
  const plans: ControlsCompanyPlan[] = [];
  const allRows: PlannedRow[] = [...parsed.errors];

  for (const group of parsed.groups) {
    const company = resolver.get(normalizedRef(group.companyRef));
    if (!company) { allRows.push(errorRow(group.row, group.companyRef, "Company products", "company_ref was not found or is ambiguous.")); continue; }
    if (group.hasAll && (group.skus.length || group.hasBlank)) {
      allRows.push(changedRow(group.row, company, "Company products", "Error", "SKU * must be the only row for a company; it means no company product restriction.")); continue;
    }
    if (group.hasBlank && group.skus.length) {
      allRows.push(changedRow(group.row, company, "Company products", "Error", "A blank SKU must be the only row for a company; it means product restriction enabled with an empty allowlist.")); continue;
    }
    const context = contexts.get(company.company_id)!;
    const bundle = cloneBundle(context.controls);
    const desiredRestricted = !group.hasAll;
    const desiredSkus = group.hasAll || group.hasBlank ? [] : group.skus;
    const current = bundle.company_catalog;
    const unchanged = current.product_restriction === desiredRestricted && sameStringSet(current.allowed_product_skus, desiredSkus);
    current.product_restriction = desiredRestricted;
    current.allowed_product_skus = desiredSkus;
    const row = changedRow(group.row, company, "Company products", unchanged ? "Skipped" : "Updated", unchanged ? "No company product restriction changes detected." : desiredRestricted ? `Company product allowlist will contain ${desiredSkus.length} SKU${desiredSkus.length === 1 ? "" : "s"}.` : "Company product restriction will be disabled (all products)." );
    const plan = { context, bundle, rows: [row] };
    plans.push(plan); allRows.push(row);
  }
  return { rows: allRows, plans };
}

export async function previewCompanyProductsCsv(source: string, options: ScopedImportOptions = {}) {
  const plan = await planCompanyProducts(source, options);
  await dryRunControlsPlans(plan.plans);
  return plan.rows.map(publicRow);
}

export async function applyCompanyProductsCsv(source: string, options: ScopedImportOptions = {}) {
  const plan = await planCompanyProducts(source, options);
  assertNoErrors(plan.rows);
  await applyControlsPlans(plan.plans);
  return plan.rows.map(publicRow);
}

type ParsedUserRow = {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  companyRef: string;
  parseError: string | null;
};

function parseUsers(source: string): ParsedUserRow[] {
  const rows = parseExactCsv(source, ["first_name", "last_name", "email", "role", "company_ref"]);
  return rows.map((values, index) => {
    const row = index + 2;
    const firstName = (values[0] ?? "").trim();
    const lastName = (values[1] ?? "").trim();
    const email = normalized(values[2] ?? "");
    const roleName = (values[3] ?? "").trim();
    const companyRef = (values[4] ?? "").trim();
    let parseError: string | null = null;
    if (!firstName) parseError = "first_name is required.";
    else if (!lastName) parseError = "last_name is required.";
    else if (!validEmail(email)) parseError = "Enter a valid email address.";
    else if (!roleName) parseError = "role is required.";
    else if (!companyRef) parseError = "company_ref is required.";
    return { row, firstName, lastName, email, roleName, companyRef, parseError };
  });
}

async function planUsers(source: string, options: ScopedImportOptions) {
  const parsed = parseUsers(source);
  const resolver = await companyResolver(parsed.map((row) => row.companyRef), options.lockedCompanyId);
  const resolved = parsed.map((row) => resolver.get(normalizedRef(row.companyRef))).filter((company): company is ResolvedCompany => Boolean(company));
  const uniqueCompanies = new Map(resolved.map((company) => [company.company_id, company]));
  const managementEntries = await mapWithConcurrency([...uniqueCompanies.values()], 5, async (company) => [company.company_id, await getCompanyManagement(company.company_id)] as const);
  const managementByCompany = new Map(managementEntries);
  const duplicateCounts = new Map<string, number>();
  parsed.forEach((row) => {
    const key = `${normalizedRef(row.companyRef)}\u0000${row.email}`;
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  });

  const allRows: UserPlannedRow[] = [];
  const candidateRequests: Array<{ company: ResolvedCompany; parsed: ParsedUserRow }> = [];

  for (const parsedRow of parsed) {
    const base = {
      row: parsedRow.row,
      company_ref: parsedRow.companyRef,
      company_name: "",
      companyId: null,
      item: parsedRow.email,
      status: asStatus("Error"),
      message: "",
      email: parsedRow.email,
      roleId: null,
      customerId: null,
      userId: null,
      managerId: null,
      approvalType: "all",
      approvalThreshold: null,
    } satisfies UserPlannedRow;
    if (parsedRow.parseError) { allRows.push({ ...base, message: parsedRow.parseError }); continue; }
    const company = resolver.get(normalizedRef(parsedRow.companyRef));
    if (!company) { allRows.push({ ...base, message: "company_ref was not found or is ambiguous." }); continue; }
    const duplicateKey = `${normalizedRef(parsedRow.companyRef)}\u0000${parsedRow.email}`;
    if ((duplicateCounts.get(duplicateKey) ?? 0) > 1) {
      allRows.push({ ...base, company_ref: company.reference, company_name: company.name, companyId: company.company_id, message: "Email appears more than once for this company." });
      continue;
    }
    const management = managementByCompany.get(company.company_id)!;
    const role = roleByName(management.roles).get(normalized(parsedRow.roleName));
    if (!role) {
      allRows.push({ ...base, company_ref: company.reference, company_name: company.name, companyId: company.company_id, message: `Role “${parsedRow.roleName}” was not found.` });
      continue;
    }
    const existing = management.users.find((user) => normalized(user.email) === parsedRow.email);
    if (existing?.is_company_admin) {
      allRows.push({ ...base, company_ref: company.reference, company_name: company.name, companyId: company.company_id, roleId: role.role_id, userId: existing.user_id, status: "Skipped", message: "Company administrator is protected by Fluid." });
      continue;
    }
    if (existing) {
      const sameRole = normalized(existing.roles[0]?.name ?? "") === normalized(role.name);
      allRows.push({
        ...base,
        company_ref: company.reference,
        company_name: company.name,
        companyId: company.company_id,
        roleId: role.role_id,
        customerId: existing.customer_id,
        userId: existing.user_id,
        managerId: existing.manager_user_id,
        approvalType: existing.approval_type,
        approvalThreshold: existing.approval_threshold,
        status: sameRole ? "Skipped" : "Updated",
        message: sameRole ? "User already has this role; names are informational only." : "Existing company user role will be updated; manager and approval settings will be preserved.",
      });
      continue;
    }
    candidateRequests.push({ company, parsed: parsedRow });
    allRows.push({ ...base, company_ref: company.reference, company_name: company.name, companyId: company.company_id, roleId: role.role_id, status: "Created", message: "Checking Magento customer…" });
  }

  const candidates = await mapWithConcurrency(candidateRequests, 8, async ({ company, parsed: row }) => {
    const result = await getCompanyCustomerCandidates(company.company_id, 1, 100, row.email);
    return {
      key: `${company.company_id}\u0000${row.email}`,
      candidate: result.items.find((candidate) => normalized(candidate.email) === row.email) ?? null,
      firstName: row.firstName,
      lastName: row.lastName,
    };
  });
  const candidateMap = new Map(candidates.map((entry) => [entry.key, entry]));
  allRows.forEach((row) => {
    if (row.status !== "Created" || row.companyId === null) return;
    const entry = candidateMap.get(`${row.companyId}\u0000${row.email}`);
    const candidate = entry?.candidate ?? null;
    if (!candidate) { row.status = "Error"; row.message = "Existing Magento customer was not found by email."; return; }
    if (candidate.assigned_to_company) { row.status = "Error"; row.message = "Magento customer is already assigned to this company but was not returned as a manageable company user."; return; }
    row.customerId = candidate.customer_id;
    const suppliedName = `${entry?.firstName ?? ""} ${entry?.lastName ?? ""}`.trim();
    const magentoName = `${candidate.firstname} ${candidate.lastname}`.trim();
    row.message = suppliedName && normalized(suppliedName) !== normalized(magentoName)
      ? `Existing Magento customer matched by email as ${magentoName}; CSV names are informational only.`
      : "Existing Magento customer will be linked to the company with no manager and approval type “all”.";
  });

  return allRows;
}

export async function previewCompanyUsersFlatCsv(source: string, options: ScopedImportOptions = {}) {
  return (await planUsers(source, options)).map(publicRow);
}

export async function applyCompanyUsersFlatCsv(source: string, options: ScopedImportOptions = {}) {
  const plan = await planUsers(source, options);
  assertNoErrors(plan);
  for (const row of plan) {
    if (row.status !== "Created" && row.status !== "Updated") continue;
    try {
      if (row.status === "Created") {
        await addCompanyUser(row.companyId!, {
          customer_id: row.customerId!,
          role_id: row.roleId!,
          manager_id: null,
          approval_type: "all",
          approval_threshold: null,
        });
        row.message = "Company user created from existing Magento customer.";
      } else {
        await updateCompanyUser(row.companyId!, {
          user_id: row.userId!,
          role_id: row.roleId!,
          manager_id: row.managerId,
          approval_type: row.approvalType,
          approval_threshold: row.approvalThreshold,
        });
        row.message = "Company user role updated; manager and approval settings preserved.";
      }
    } catch (error) {
      row.status = "Error";
      row.message = error instanceof Error ? error.message : "Backend rejected the company-user change.";
    }
  }
  return plan.map(publicRow);
}

function csvWithBom(rows: Array<Array<string | number>>) {
  return `\uFEFF${stringifyCsv(rows)}\r\n`;
}

export function exportUsersFlatCsv(company: ResolvedCompany | CompanySummary, users: CompanyAdminUser[]) {
  const reference = company.reference?.trim();
  if (!reference) throw new Error("Company reference is required for flat CSV exports.");
  const rows: Array<Array<string | number>> = [["first_name", "last_name", "email", "role", "company_ref"]];
  users.forEach((user) => rows.push([user.firstname, user.lastname, normalized(user.email), user.roles[0]?.name ?? "", reference]));
  return csvWithBom(rows);
}

export function exampleUsersFlatCsv(companyRef = "ABC001") {
  return csvWithBom([
    ["first_name", "last_name", "email", "role", "company_ref"],
    ["John", "Smith", "john.smith@example.com", "Buyer", companyRef],
    ["Jane", "Jones", "jane.jones@example.com", "Credit Manager", companyRef],
  ]);
}

export function exportRolesPermissionsCsv(company: CompanySummary, management: CompanyManagement) {
  const reference = company.reference?.trim();
  if (!reference) throw new Error("Company reference is required for role CSV exports.");
  const columns = rolePermissionColumns(management.resources);
  const rows: Array<Array<string | number>> = [["user_role", "company_ref", "sort_order", ...columns.map((column) => column.header)]];
  management.roles.filter((role) => role.manageable).forEach((role) => {
    const allowed = new Set(role.allowed_resources);
    rows.push([role.name, reference, role.sort_order, ...columns.map((column) => allowed.has(column.resourceId) ? 1 : 0)]);
  });
  return csvWithBom(rows);
}

export function exampleRolesPermissionsCsv(company: CompanySummary, management: CompanyManagement) {
  const reference = company.reference?.trim() || "ABC001";
  const columns = rolePermissionColumns(management.resources);
  const buyer = columns.map((column) => /sales|checkout|orders|catalog/i.test(column.header) && !/manage|approve|all company/i.test(column.header) ? 1 : 0);
  const credit = columns.map((column) => /credit|approve|orders|view/i.test(column.header) ? 1 : 0);
  return csvWithBom([
    ["user_role", "company_ref", "sort_order", ...columns.map((column) => column.header)],
    ["Example Buyer", reference, 10, ...buyer],
    ["Example Credit Manager", reference, 20, ...credit],
  ]);
}

export function exportRoleProductsCsv(company: CompanySummary, bundle: CompanyControlsBundle) {
  const reference = company.reference?.trim();
  if (!reference) throw new Error("Company reference is required for role-product CSV exports.");
  const rows: Array<Array<string | number>> = [["sku", "user_role_name", "company_ref"]];
  bundle.role_controls.forEach((role) => {
    if (role.preselect_all_products) rows.push(["*", role.role_name, reference]);
    else if (role.allowed_product_skus.length) role.allowed_product_skus.forEach((sku) => rows.push([sku, role.role_name, reference]));
    else rows.push(["", role.role_name, reference]);
  });
  return csvWithBom(rows);
}

export function exampleRoleProductsCsv(companyRef = "ABC001") {
  return csvWithBom([
    ["sku", "user_role_name", "company_ref"],
    ["CHAIR-001", "Buyer", companyRef],
    ["DESK-001", "Buyer", companyRef],
    ["*", "Sales", companyRef],
  ]);
}

export function exportCompanyProductsCsv(company: CompanySummary, bundle: CompanyControlsBundle) {
  const reference = company.reference?.trim();
  if (!reference) throw new Error("Company reference is required for company-product CSV exports.");
  const rows: Array<Array<string | number>> = [["sku", "company_ref"]];
  if (!bundle.company_catalog.product_restriction) rows.push(["*", reference]);
  else if (bundle.company_catalog.allowed_product_skus.length) bundle.company_catalog.allowed_product_skus.forEach((sku) => rows.push([sku, reference]));
  else rows.push(["", reference]);
  return csvWithBom(rows);
}

export function exampleCompanyProductsCsv(companyRef = "ABC001") {
  return csvWithBom([
    ["sku", "company_ref"],
    ["CHAIR-001", companyRef],
    ["DESK-001", companyRef],
  ]);
}

export async function firstReferencedCompany() {
  const companies = await getAllCompanies();
  const company = companies.find((item) => item.reference?.trim());
  if (!company || !company.reference) throw new Error("No company with a reference is available for the bulk example.");
  return { ...company, reference: company.reference.trim() } as ResolvedCompany;
}

export async function exportBulkUsersCsv() {
  const companies = (await getAllCompanies()).filter((company): company is ResolvedCompany => Boolean(company.reference?.trim())).map((company) => ({ ...company, reference: company.reference!.trim() }));
  const data = await mapWithConcurrency(companies, 5, async (company) => ({ company, management: await getCompanyManagement(company.company_id) }));
  const rows: Array<Array<string | number>> = [["first_name", "last_name", "email", "role", "company_ref"]];
  data.forEach(({ company, management }) => management.users.forEach((user) => rows.push([user.firstname, user.lastname, normalized(user.email), user.roles[0]?.name ?? "", company.reference])));
  return csvWithBom(rows);
}

export async function exportBulkRolesCsv() {
  const companies = (await getAllCompanies()).filter((company): company is ResolvedCompany => Boolean(company.reference?.trim())).map((company) => ({ ...company, reference: company.reference!.trim() }));
  if (!companies.length) throw new Error("No referenced companies are available.");
  const data = await mapWithConcurrency(companies, 5, async (company) => ({ company, management: await getCompanyManagement(company.company_id) }));
  const canonical = rolePermissionColumns(data[0].management.resources);
  data.forEach(({ management }) => {
    const columns = rolePermissionColumns(management.resources);
    if (columns.length !== canonical.length || columns.some((column, index) => column.header !== canonical[index].header)) {
      throw new Error("Company permission trees differ; export roles per company instead of using one bulk roles file.");
    }
  });
  const rows: Array<Array<string | number>> = [["user_role", "company_ref", "sort_order", ...canonical.map((column) => column.header)]];
  data.forEach(({ company, management }) => management.roles.filter((role) => role.manageable).forEach((role) => {
    const allowed = new Set(role.allowed_resources);
    rows.push([role.name, company.reference, role.sort_order, ...canonical.map((column) => allowed.has(column.resourceId) ? 1 : 0)]);
  }));
  return csvWithBom(rows);
}

export async function exportBulkRoleProductsCsv() {
  const companies = (await getAllCompanies()).filter((company): company is ResolvedCompany => Boolean(company.reference?.trim())).map((company) => ({ ...company, reference: company.reference!.trim() }));
  const data = await mapWithConcurrency(companies, 5, async (company) => ({ company, controls: await getCompanyControlsBundle(company.company_id) }));
  const rows: Array<Array<string | number>> = [["sku", "user_role_name", "company_ref"]];
  data.forEach(({ company, controls }) => controls.role_controls.forEach((role) => {
    if (role.preselect_all_products) rows.push(["*", role.role_name, company.reference]);
    else if (role.allowed_product_skus.length) role.allowed_product_skus.forEach((sku) => rows.push([sku, role.role_name, company.reference]));
    else rows.push(["", role.role_name, company.reference]);
  }));
  return csvWithBom(rows);
}

export async function exportBulkCompanyProductsCsv() {
  const companies = (await getAllCompanies()).filter((company): company is ResolvedCompany => Boolean(company.reference?.trim())).map((company) => ({ ...company, reference: company.reference!.trim() }));
  const data = await mapWithConcurrency(companies, 5, async (company) => ({ company, controls: await getCompanyControlsBundle(company.company_id) }));
  const rows: Array<Array<string | number>> = [["sku", "company_ref"]];
  data.forEach(({ company, controls }) => {
    if (!controls.company_catalog.product_restriction) rows.push(["*", company.reference]);
    else if (controls.company_catalog.allowed_product_skus.length) controls.company_catalog.allowed_product_skus.forEach((sku) => rows.push([sku, company.reference]));
    else rows.push(["", company.reference]);
  });
  return csvWithBom(rows);
}
