"use client";

import { useActionState } from "react";
import {
  companyControlsImportAction,
  companyUsersCsvImportAction,
} from "@/app/(admin)/companies/[id]/import-export/actions";
import type {
  CompanyControlsImportState,
  CompanyUserImportState,
  ImportRowStatus,
} from "@/lib/import-export-types";

const initialUsersState: CompanyUserImportState = {
  phase: "idle",
  sourceCsv: "",
  rows: [],
  error: null,
};

const initialControlsState: CompanyControlsImportState = {
  phase: "idle",
  sourceJson: "",
  sourceCompanyId: null,
  options: {
    create_missing_roles: false,
    create_missing_templates: false,
    apply_purchase_templates: false,
  },
  result: null,
  error: null,
};

function statusBadge(status: ImportRowStatus) {
  if (status === "Created") return "badge-ok";
  if (status === "Error") return "badge-restricted";
  return "badge-neutral";
}

function hiddenBoolean(name: string, value: boolean) {
  return <input name={name} type="hidden" value={value ? "true" : "false"} />;
}

export function CompanyUsersCsvImport({ companyId, userCount }: { companyId: number; userCount: number }) {
  const [state, formAction, pending] = useActionState(companyUsersCsvImportAction, initialUsersState);
  const counts = state.rows.reduce<Record<ImportRowStatus, number>>(
    (result, row) => ({ ...result, [row.status]: result[row.status] + 1 }),
    { Created: 0, Updated: 0, Skipped: 0, Error: 0 },
  );
  const actionable = counts.Created + counts.Updated;

  return (
    <section className="card stack import-panel">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">Company users</p>
          <h2>CSV import / export</h2>
          <p className="muted">Portable fields: email, role name, manager email, approval type and threshold.</p>
        </div>
        <span className="badge badge-neutral">{userCount} current users</span>
      </div>

      <div className="button-row">
        <a className="button button-secondary button-link" href={`/api/companies/${companyId}/exports/users`}>
          Download users CSV
        </a>
      </div>

      <form action={formAction} className="form-grid">
        <input name="companyId" type="hidden" value={companyId} />
        <input name="intent" type="hidden" value="preview" />
        <div className="field span-2">
          <label htmlFor="company-users-csv">Company users CSV</label>
          <input id="company-users-csv" name="file" type="file" accept=".csv,text/csv" required />
        </div>
        <div className="span-2">
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Checking…" : "Preview CSV"}
          </button>
        </div>
      </form>
      <p className="muted small-text">Preview is mandatory. Imports link existing Magento customers only and never remove or replace the company administrator.</p>

      {state.error ? <div className="error">{state.error}</div> : null}
      {state.rows.length ? (
        <div className="stack">
          <div className="stat-grid import-stats">
            {(Object.keys(counts) as ImportRowStatus[]).map((status) => (
              <div className="stat-card" key={status}>
                <span className="stat-value">{counts[status]}</span>
                <span className="stat-label">{status}</span>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Row</th><th>User</th><th>Role / manager</th><th>Approval</th><th>Result</th></tr></thead>
              <tbody>
                {state.rows.map((row) => (
                  <tr key={`${row.row}-${row.email}`}>
                    <td>{row.row}</td>
                    <td>{row.email || "—"}</td>
                    <td><div className="cell-stack"><strong>{row.role_name || "—"}</strong><span className="muted small-text">Manager: {row.manager_email || "—"}</span></div></td>
                    <td><div className="cell-stack"><span>{row.approval_type}</span><span className="muted small-text">Threshold: {row.approval_threshold ?? "—"}</span></div></td>
                    <td><div className="cell-stack"><span className={`badge ${statusBadge(row.status)}`}>{row.status}</span><span className="muted small-text">{row.message}</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.phase === "preview" ? (
            <form action={formAction} className="button-row">
              <input name="companyId" type="hidden" value={companyId} />
              <input name="intent" type="hidden" value="apply" />
              <input name="sourceCsv" type="hidden" value={state.sourceCsv} />
              <button className="button" type="submit" disabled={pending || actionable === 0}>
                {pending ? "Applying…" : `Apply ${actionable} change${actionable === 1 ? "" : "s"}`}
              </button>
            </form>
          ) : state.phase === "applied" ? <div className="notice">CSV import finished. The row results above reflect Fluid’s response.</div> : null}
        </div>
      ) : null}
    </section>
  );
}

export function CompanyControlsImport({
  companyId,
  schemaVersion,
  roleCount,
  templateCount,
}: {
  companyId: number;
  schemaVersion: number;
  roleCount: number;
  templateCount: number;
}) {
  const [state, formAction, pending] = useActionState(companyControlsImportAction, initialControlsState);
  const result = state.result;

  return (
    <section className="card stack import-panel">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">Roles, catalogue & purchase controls</p>
          <h2>Versioned controls bundle</h2>
          <p className="muted">Fluid’s portable JSON format is validated transactionally before it can be applied.</p>
        </div>
        <span className="badge badge-neutral">Schema v{schemaVersion}</span>
      </div>

      <dl className="mini-detail-list">
        <dt>Exported role controls</dt><dd>{roleCount}</dd>
        <dt>Exported purchase templates</dt><dd>{templateCount}</dd>
      </dl>

      <div className="button-row">
        <a className="button button-secondary button-link" href={`/api/companies/${companyId}/exports/controls`}>
          Download controls JSON
        </a>
      </div>

      <form action={formAction} className="stack">
        <input name="companyId" type="hidden" value={companyId} />
        <input name="intent" type="hidden" value="preview" />
        <div className="field">
          <label htmlFor="company-controls-json">Company controls JSON</label>
          <input id="company-controls-json" name="file" type="file" accept=".json,application/json" required />
        </div>
        <div className="form-grid">
          <label className="check-field"><input name="createMissingRoles" type="checkbox" value="true" /><span><strong>Create missing roles</strong><small className="muted">Otherwise Fluid rejects unknown role names.</small></span></label>
          <label className="check-field"><input name="createMissingTemplates" type="checkbox" value="true" /><span><strong>Create missing templates</strong><small className="muted">Otherwise Fluid rejects unknown template names.</small></span></label>
          <label className="check-field span-2"><input name="applyPurchaseTemplates" type="checkbox" value="true" /><span><strong>Apply purchase templates to assigned users</strong><small className="muted">Preserves Fluid’s explicit apply option during import.</small></span></label>
        </div>
        <div><button className="button" type="submit" disabled={pending}>{pending ? "Running dry run…" : "Preview controls import"}</button></div>
      </form>

      {state.error ? <div className="error">{state.error}</div> : null}
      {result ? (
        <div className="stack">
          <div className={state.phase === "applied" ? "notice" : "notice notice-preview"}>
            {state.phase === "applied" ? "Controls import applied by Fluid." : "Dry run accepted by Fluid; no changes were committed."}
            {state.sourceCompanyId !== null && state.sourceCompanyId !== companyId
              ? ` Source company ${state.sourceCompanyId}; target company ${companyId}.`
              : ""}
          </div>
          <div className="stat-grid import-stats">
            <div className="stat-card"><span className="stat-value">{result.roles_created}</span><span className="stat-label">Roles created</span></div>
            <div className="stat-card"><span className="stat-value">{result.roles_updated}</span><span className="stat-label">Roles updated</span></div>
            <div className="stat-card"><span className="stat-value">{result.purchase_templates_created}</span><span className="stat-label">Templates created</span></div>
            <div className="stat-card"><span className="stat-value">{result.purchase_templates_updated}</span><span className="stat-label">Templates updated</span></div>
          </div>

          {state.phase === "preview" ? (
            <form action={formAction} className="button-row">
              <input name="companyId" type="hidden" value={companyId} />
              <input name="intent" type="hidden" value="apply" />
              <input name="sourceJson" type="hidden" value={state.sourceJson} />
              {hiddenBoolean("createMissingRoles", state.options.create_missing_roles)}
              {hiddenBoolean("createMissingTemplates", state.options.create_missing_templates)}
              {hiddenBoolean("applyPurchaseTemplates", state.options.apply_purchase_templates)}
              <button className="button" type="submit" disabled={pending}>{pending ? "Applying…" : "Apply validated controls"}</button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
