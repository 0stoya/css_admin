"use client";

import { useActionState } from "react";
import {
  companyProductsFlatImportAction,
  companyRoleProductsFlatImportAction,
  companyRolesFlatImportAction,
  companyUsersFlatImportAction,
} from "@/app/(admin)/companies/[id]/import-export/flat-actions";
import {
  bulkCompanyProductsImportAction,
  bulkRoleProductsImportAction,
  bulkRolesImportAction,
  bulkUsersImportAction,
} from "@/app/(admin)/bulk-import/actions";
import type { FlatCompanyImportState, ImportRowStatus } from "@/lib/import-export-types";

const initialState: FlatCompanyImportState = {
  phase: "idle",
  sourceCsv: "",
  rows: [],
  create_missing_roles: false,
  error: null,
};

type ImportAction = (state: FlatCompanyImportState, formData: FormData) => Promise<FlatCompanyImportState>;

type PanelProps = {
  title: string;
  eyebrow: string;
  description: string;
  action: ImportAction;
  exportHref: string;
  exampleHref: string;
  companyId?: number;
  showCreateMissingRoles?: boolean;
  help: string;
};

function statusBadge(status: ImportRowStatus) {
  if (status === "Created") return "badge-ok";
  if (status === "Error") return "badge-restricted";
  return "badge-neutral";
}

function ImportResult({ state }: { state: FlatCompanyImportState }) {
  if (!state.rows.length) return null;
  const counts = state.rows.reduce<Record<ImportRowStatus, number>>(
    (result, row) => ({ ...result, [row.status]: result[row.status] + 1 }),
    { Created: 0, Updated: 0, Skipped: 0, Error: 0 },
  );
  const groups = new Map<string, typeof state.rows>();
  state.rows.forEach((row) => {
    const key = row.company_ref || "Unknown company";
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  });

  return (
    <div className="stack">
      <div className="stat-grid import-stats">
        {(Object.keys(counts) as ImportRowStatus[]).map((status) => (
          <div className="stat-card" key={status}>
            <span className="stat-value">{counts[status]}</span>
            <span className="stat-label">{status}</span>
          </div>
        ))}
      </div>
      {[...groups.entries()].map(([companyRef, rows]) => (
        <section className="stack" key={companyRef}>
          <div>
            <strong>{companyRef}</strong>
            {rows[0]?.company_name ? <span className="muted"> · {rows[0].company_name}</span> : null}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Row</th><th>Item</th><th>Result</th><th>Message</th></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.row}-${row.item}-${index}`}>
                    <td>{row.row}</td>
                    <td>{row.item || "—"}</td>
                    <td><span className={`badge ${statusBadge(row.status)}`}>{row.status}</span></td>
                    <td>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function FlatImportPanel({
  title,
  eyebrow,
  description,
  action,
  exportHref,
  exampleHref,
  companyId,
  showCreateMissingRoles = false,
  help,
}: PanelProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.rows.filter((row) => row.status === "Error").length;
  const actionable = state.rows.filter((row) => row.status === "Created" || row.status === "Updated").length;

  return (
    <section className="card stack import-panel">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="badge badge-neutral">CSV</span>
      </div>

      <div className="button-row">
        <a className="button button-secondary button-link" href={exportHref}>Download current CSV</a>
        <a className="button button-secondary button-link" href={exampleHref}>Download example CSV</a>
      </div>

      <form action={formAction} className="stack">
        {companyId ? <input name="companyId" type="hidden" value={companyId} /> : null}
        <input name="intent" type="hidden" value="preview" />
        <div className="field">
          <label>CSV file</label>
          <input name="file" type="file" accept=".csv,text/csv" required />
        </div>
        {showCreateMissingRoles ? (
          <label className="check-field">
            <input name="createMissingRoles" type="checkbox" value="true" defaultChecked={state.create_missing_roles} />
            <span><strong>Create missing roles</strong><small className="muted">Missing role names are errors unless this is enabled. Existing protected roles are never changed.</small></span>
          </label>
        ) : null}
        <p className="muted small-text">{help}</p>
        <div><button className="button" type="submit" disabled={pending}>{pending ? "Checking…" : "Preview CSV"}</button></div>
      </form>

      {state.error ? <div className="error">{state.error}</div> : null}
      <ImportResult state={state} />

      {state.phase === "preview" ? (
        <form action={formAction} className="button-row">
          {companyId ? <input name="companyId" type="hidden" value={companyId} /> : null}
          <input name="intent" type="hidden" value="apply" />
          <input name="sourceCsv" type="hidden" value={state.sourceCsv} />
          <input name="createMissingRoles" type="hidden" value={state.create_missing_roles ? "true" : "false"} />
          <button className="button" type="submit" disabled={pending || errors > 0 || actionable === 0}>
            {pending ? "Applying…" : errors ? `Resolve ${errors} error${errors === 1 ? "" : "s"}` : `Apply ${actionable} change${actionable === 1 ? "" : "s"}`}
          </button>
        </form>
      ) : state.phase === "applied" ? <div className="notice">Import finished. Results above reflect the apply attempt.</div> : null}
    </section>
  );
}

export function CompanyFlatImportPanels({ companyId, companyRef }: { companyId: number; companyRef: string }) {
  const base = `/api/companies/${companyId}`;
  return (
    <>
      <FlatImportPanel
        eyebrow="Company users"
        title="Users"
        description={`Link existing Magento customers to ${companyRef} by email and assign one company role.`}
        action={companyUsersFlatImportAction}
        companyId={companyId}
        exportHref={`${base}/exports/users-flat`}
        exampleHref={`${base}/examples/users-flat`}
        help="Columns: first_name, last_name, email, role, company_ref. Names are informational; Magento customer data is not overwritten. Existing user manager/approval settings are preserved."
      />
      <FlatImportPanel
        eyebrow="Company roles"
        title="Roles & permissions"
        description="One row per role, with one 1/0 column for every assignable Fluid permission in the live resource tree."
        action={companyRolesFlatImportAction}
        companyId={companyId}
        exportHref={`${base}/exports/roles`}
        exampleHref={`${base}/examples/roles`}
        showCreateMissingRoles
        help="Columns start user_role, company_ref, sort_order. Permission columns use full tree paths. Protected/non-assignable resources such as All are not writable and are preserved."
      />
      <FlatImportPanel
        eyebrow="Role catalogue"
        title="Role product restrictions"
        description="Replace the allowed product SKUs only for the roles named in the file."
        action={companyRoleProductsFlatImportAction}
        companyId={companyId}
        exportHref={`${base}/exports/role-products`}
        exampleHref={`${base}/examples/role-products`}
        help="Columns: sku, user_role_name, company_ref. Use * as the only SKU for a role to allow all products; use a blank SKU row for an explicit empty allowlist. Roles absent from the CSV are untouched."
      />
      <FlatImportPanel
        eyebrow="Company catalogue"
        title="Company product restrictions"
        description="Replace the company-level product SKU allowlist without changing category controls or other company settings."
        action={companyProductsFlatImportAction}
        companyId={companyId}
        exportHref={`${base}/exports/company-products`}
        exampleHref={`${base}/examples/company-products`}
        help="Columns: sku, company_ref. Use * as the only SKU to disable the company product restriction; a blank SKU enables restriction with an empty allowlist."
      />
    </>
  );
}

export function BulkFlatImportPanels() {
  const base = "/api/bulk-import";
  return (
    <>
      <FlatImportPanel
        eyebrow="Multi-company users"
        title="Users"
        description="Create/update company memberships across several company references in one preview."
        action={bulkUsersImportAction}
        exportHref={`${base}/exports/users`}
        exampleHref={`${base}/examples/users`}
        help="company_ref routes each row to a company. Email must resolve to an existing Magento customer. The preview groups results by company before apply."
      />
      <FlatImportPanel
        eyebrow="Multi-company roles"
        title="Roles & permissions"
        description="Create or update roles across several companies from one permission matrix."
        action={bulkRolesImportAction}
        exportHref={`${base}/exports/roles`}
        exampleHref={`${base}/examples/roles`}
        showCreateMissingRoles
        help="All companies referenced by one roles CSV must expose the same Fluid permission tree. Each company is dry-run and applied independently; one company failure does not block another company’s backend transaction."
      />
      <FlatImportPanel
        eyebrow="Multi-company role catalogue"
        title="Role product restrictions"
        description="Update role-level SKU allowlists across several companies."
        action={bulkRoleProductsImportAction}
        exportHref={`${base}/exports/role-products`}
        exampleHref={`${base}/examples/role-products`}
        help="Rows are grouped by company_ref + user_role_name. Only named roles are changed."
      />
      <FlatImportPanel
        eyebrow="Multi-company catalogue"
        title="Company product restrictions"
        description="Update company-level SKU allowlists for several companies in one file."
        action={bulkCompanyProductsImportAction}
        exportHref={`${base}/exports/company-products`}
        exampleHref={`${base}/examples/company-products`}
        help="Rows are grouped by company_ref. Category settings and unrelated company controls are preserved."
      />
    </>
  );
}
