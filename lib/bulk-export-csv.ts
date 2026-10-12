import { stringifyCsv } from "./csv";
import type { CompanySummary } from "./graphql/companies";
import type { CompanyManagement, CompanyAdminResource } from "./graphql/company-management";
import type { CompanyControlsBundle } from "./graphql/company-controls";

// Keep these filenames, headers, ordering, wildcards and final-newline conventions
// identical to the existing synchronous /api/bulk-import/exports/* CSV contracts.
export const BULK_EXPORTS = {
  bulk_company_structure: {
    label: "Company structure", filename: "bulk-company-structure.csv", trailingNewline: false,
  },
  bulk_users: {
    label: "Users", filename: "bulk-company-users.csv", trailingNewline: true,
  },
  bulk_roles: {
    label: "Roles & permissions", filename: "bulk-company-roles.csv", trailingNewline: true,
  },
  bulk_role_products: {
    label: "Role product restrictions", filename: "bulk-role-products.csv", trailingNewline: true,
  },
  bulk_company_products: {
    label: "Company product restrictions", filename: "bulk-company-products.csv", trailingNewline: true,
  },
  bulk_company_descriptions: {
    label: "Company descriptions", filename: "bulk-company-descriptions.csv", trailingNewline: false,
  },
  bulk_purchase_controls: {
    label: "Purchase controls", filename: "bulk-purchase-controls.csv", trailingNewline: true,
  },
} as const;

export type BulkExportKind = keyof typeof BULK_EXPORTS;
export function isBulkExportKind(value: unknown): value is BulkExportKind {
  return typeof value === "string" && Object.hasOwn(BULK_EXPORTS, value);
}

export type RolePermissionColumn = { header: string; resourceId: string };

function normalized(value: string) { return value.trim().toLocaleLowerCase("en"); }

// Also used by synchronous role exports; keep the source of truth shared.
export function rolePermissionColumns(resources: CompanyAdminResource[]): RolePermissionColumn[] {
  const byId = new Map(resources.map(resource => [resource.resource_id, resource]));
  const base = resources.filter(resource => resource.assignable).map(resource => {
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
  base.forEach(column => counts.set(column.baseHeader, (counts.get(column.baseHeader) ?? 0) + 1));
  return base.map(column => ({
    resourceId: column.resourceId,
    header: (counts.get(column.baseHeader) ?? 0) > 1
      ? `${column.baseHeader} [${column.resourceId}]` : column.baseHeader,
  }));
}

export function assertMatchingRoleColumns(
  canonical: RolePermissionColumn[], resources: CompanyAdminResource[],
) {
  const next = rolePermissionColumns(resources);
  if (next.length !== canonical.length ||
      next.some((column, i) => column.header !== canonical[i].header)) {
    throw new Error("Company permission trees differ; export roles per company instead of using one bulk roles file.");
  }
}

export function prepareBulkCompanies(kind: BulkExportKind, visible: CompanySummary[]): CompanySummary[] {
  const companies = visible.filter(company => Boolean(company.reference?.trim()));
  if (!companies.length) throw new Error("No referenced companies are available for bulk export.");
  if (companies.length > 10000) throw new Error("Bulk exports support at most 10,000 companies.");
  if (kind === "bulk_company_structure" || kind === "bulk_company_descriptions") {
    // These two legacy exporters require unique references (case-insensitive).
    const seen = new Set<string>();
    for (const company of companies) {
      const key = normalized(company.reference!);
      if (seen.has(key)) throw new Error("Cannot safely export duplicate company references in the current admin scope.");
      seen.add(key);
    }
    companies.sort((a, b) => a.reference!.trim().localeCompare(b.reference!.trim()));
  }
  if (kind === "bulk_company_structure") {
    const ids = new Set(companies.map(company => company.company_id));
    for (const company of companies) {
      if (company.parent_company_id !== null && !ids.has(company.parent_company_id)) {
        throw new Error("Cannot safely export a company structure with an out-of-scope parent.");
      }
    }
  }
  return companies;
}

export function bulkCsvHeader(kind: BulkExportKind, columns: RolePermissionColumn[] = []): Array<string | number> {
  switch (kind) {
    case "bulk_company_structure": return ["company_reference", "parent_reference"];
    case "bulk_users": return ["first_name", "last_name", "email", "role", "company_ref"];
    case "bulk_roles": return ["user_role", "company_ref", "sort_order", ...columns.map(column => column.header)];
    case "bulk_role_products": return ["sku", "user_role_name", "company_ref"];
    case "bulk_company_products": return ["sku", "company_ref"];
    case "bulk_company_descriptions": return ["company_ref", "company_name", "company_description"];
    case "bulk_purchase_controls": return [
      "company_ref", "record_type", "template_name", "sku",
      "quantity_limit", "duration_days", "start_date", "role_name",
    ];
  }
}

export type BulkCsvData = {
  management?: CompanyManagement;
  controls?: CompanyControlsBundle;
  description?: string;
  parentReference?: string;
  columns?: RolePermissionColumn[];
};

export function* bulkCsvRows(
  kind: BulkExportKind, company: CompanySummary, data: BulkCsvData,
): Generator<Array<string | number>> {
  const ref = company.reference?.trim();
  if (!ref) throw new Error("Bulk export company has no reference.");
  if (kind === "bulk_company_structure") {
    if (company.parent_company_id !== null && !data.parentReference) {
      throw new Error("Company parent is outside the approved export scope.");
    }
    yield [ref, data.parentReference ?? ""];
    return;
  }
  if (kind === "bulk_company_descriptions") {
    yield [ref, company.name, data.description ?? ""];
    return;
  }
  if (kind === "bulk_users" || kind === "bulk_roles") {
    if (!data.management) throw new Error("Bulk export is missing company management data.");
    if (kind === "bulk_users") {
      for (const user of data.management.users) {
        yield [user.firstname, user.lastname, normalized(user.email), user.roles[0]?.name ?? "", ref];
      }
    } else {
      const columns = data.columns ?? [];
      for (const role of data.management.roles.filter(role => role.manageable)) {
        const allowed = new Set(role.allowed_resources);
        yield [role.name, ref, role.sort_order,
          ...columns.map(column => allowed.has(column.resourceId) ? 1 : 0)];
      }
    }
    return;
  }
  if (!data.controls) throw new Error("Bulk export is missing company controls data.");
  const controls = data.controls;
  if (kind === "bulk_role_products") {
    for (const role of controls.role_controls) {
      if (role.preselect_all_products) yield ["*", role.role_name, ref];
      else if (role.allowed_product_skus.length) {
        for (const sku of role.allowed_product_skus) yield [sku, role.role_name, ref];
      } else yield ["", role.role_name, ref];
    }
    return;
  }
  if (kind === "bulk_company_products") {
    if (!controls.company_catalog.product_restriction) yield ["*", ref];
    else if (controls.company_catalog.allowed_product_skus.length) {
      for (const sku of controls.company_catalog.allowed_product_skus) yield [sku, ref];
    } else yield ["", ref];
    return;
  }
  if (kind === "bulk_purchase_controls") {
    for (const template of controls.purchase_controls?.templates ?? []) {
      yield [ref, "purchase_template", template.name, "", "", "", "", ""];
      for (const rule of template.rules) {
        yield [ref, "purchase_rule", template.name,
          rule.sku, rule.quantity_limit, rule.duration_days, rule.start_date, ""];
      }
      for (const roleName of template.assigned_role_names) {
        yield [ref, "template_role", template.name, "", "", "", "", roleName];
      }
    }
  }
}

// The worker writes one row at a time with the exact shared escape semantics.
export function csvRow(row: Array<string | number>) { return stringifyCsv([row]); }
