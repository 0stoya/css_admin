"use client";

import { useActionState, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bulkCompanyProductsImportAction,
  bulkCompanyStructureImportAction,
  bulkRoleProductsImportAction,
  bulkRolesImportAction,
  bulkUsersImportAction,
} from "@/app/(admin)/bulk-import/actions";
import type { FlatCompanyImportState, ImportRowStatus } from "@/lib/import-export-types";
import styles from "@/components/company-import-export-workspace.module.css";

const initialState: FlatCompanyImportState = {
  phase: "idle",
  sourceCsv: "",
  rows: [],
  create_missing_roles: false,
  error: null,
};

type ImportAction = (state: FlatCompanyImportState, formData: FormData) => Promise<FlatCompanyImportState>;
type BulkImportView = "structure" | "users" | "roles" | "role-products" | "company-products";

type PanelProps = {
  title: string;
  eyebrow: string;
  description: string;
  action: ImportAction;
  exportHref: string;
  exampleHref: string;
  help: string;
  showCreateMissingRoles?: boolean;
  groupResultsByCompany?: boolean;
  applyConfirmation?: string;
};

function statusBadge(status: ImportRowStatus) {
  if (status === "Created") return "badge-ok";
  if (status === "Error") return "badge-restricted";
  return "badge-neutral";
}

function ResultCounts({ state }: { state: FlatCompanyImportState }) {
  const counts = state.rows.reduce<Record<ImportRowStatus, number>>(
    (result, row) => ({ ...result, [row.status]: result[row.status] + 1 }),
    { Created: 0, Updated: 0, Skipped: 0, Error: 0 },
  );

  return (
    <div className="stat-grid import-stats">
      {(Object.keys(counts) as ImportRowStatus[]).map((status) => (
        <div className="stat-card" key={status}>
          <span className="stat-value">{counts[status]}</span>
          <span className="stat-label">{status}</span>
        </div>
      ))}
    </div>
  );
}

function ImportResult({ state, groupByCompany = true }: { state: FlatCompanyImportState; groupByCompany?: boolean }) {
  if (!state.rows.length) return null;

  if (!groupByCompany) {
    return (
      <div className="stack">
        <ResultCounts state={state} />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Row</th><th>Company</th><th>Relationship</th><th>Result</th><th>Message</th></tr></thead>
            <tbody>
              {state.rows.map((row, index) => (
                <tr key={`${row.row}-${row.item}-${index}`}>
                  <td>{row.row}</td>
                  <td>
                    <strong>{row.company_ref || "Unknown"}</strong>
                    {row.company_name ? <><br /><span className="muted small-text">{row.company_name}</span></> : null}
                  </td>
                  <td>{row.item || "—"}</td>
                  <td><span className={`badge ${statusBadge(row.status)}`}>{row.status}</span></td>
                  <td>{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const groups = new Map<string, typeof state.rows>();
  state.rows.forEach((row) => {
    const key = row.company_ref || "Unknown company";
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  });

  return (
    <div className="stack">
      <ResultCounts state={state} />
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

function ImportSteps({ state }: { state: FlatCompanyImportState }) {
  const previewReady = state.phase === "preview" || state.phase === "applied";
  const applied = state.phase === "applied";

  return (
    <div className={styles.steps} aria-label="Import steps">
      <div className={`${styles.step} ${previewReady ? styles.stepDone : styles.stepActive}`}>
        <span className={styles.stepNumber}>1</span>
        <span className={styles.stepText}><strong>Choose CSV</strong><span>Select the multi-company file</span></span>
      </div>
      <div className={`${styles.step} ${previewReady ? (applied ? styles.stepDone : styles.stepActive) : ""}`}>
        <span className={styles.stepNumber}>2</span>
        <span className={styles.stepText}><strong>Preview</strong><span>Resolve companies and validate rows</span></span>
      </div>
      <div className={`${styles.step} ${applied ? styles.stepDone : previewReady ? styles.stepActive : ""}`}>
        <span className={styles.stepNumber}>3</span>
        <span className={styles.stepText}><strong>Apply</strong><span>Write only after review</span></span>
      </div>
    </div>
  );
}

function BulkImportPanel({
  title,
  eyebrow,
  description,
  action,
  exportHref,
  exampleHref,
  help,
  showCreateMissingRoles = false,
  groupResultsByCompany = true,
  applyConfirmation,
}: PanelProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [fileName, setFileName] = useState("");
  const fileInputId = useId();
  const errors = state.rows.filter((row) => row.status === "Error").length;
  const actionable = state.rows.filter((row) => row.status === "Created" || row.status === "Updated").length;

  return (
    <section className={`card ${styles.panel}`}>
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <span className="badge badge-neutral">CSV</span>
      </div>

      <div className={styles.downloads}>
        <a className="button button-secondary button-link" href={exportHref}>Download current CSV</a>
        <a className="button button-secondary button-link" href={exampleHref}>Download example CSV</a>
      </div>

      <ImportSteps state={state} />

      <form action={formAction} className={styles.uploadForm}>
        <input name="intent" type="hidden" value="preview" />
        <div className={styles.uploadGrid}>
          <div className="field">
            <label htmlFor={fileInputId}>CSV file</label>
            <div className={styles.filePicker}>
              <input
                id={fileInputId}
                className={styles.fileInput}
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")}
              />
              <label className={styles.fileButton} htmlFor={fileInputId}>
                <svg className={styles.fileIcon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v4h14v-4" />
                </svg>
                <span>{fileName ? "Change CSV" : "Choose CSV"}</span>
              </label>
              <span className={`${styles.fileName} ${fileName ? styles.fileNameSelected : ""}`}>
                {fileName || "No CSV selected"}
              </span>
            </div>
          </div>
          <button className="button" type="submit" disabled={pending}>{pending ? "Checking…" : "Preview CSV"}</button>
        </div>

        {showCreateMissingRoles ? (
          <label className="check-field">
            <input name="createMissingRoles" type="checkbox" value="true" defaultChecked={state.create_missing_roles} />
            <span>
              <strong>Create missing roles</strong>
              <small className="muted">Missing roles are errors unless enabled. Existing protected resources are preserved.</small>
            </span>
          </label>
        ) : null}

        <p className={styles.help}>{help}</p>
      </form>

      {state.error ? <div className="error">{state.error}</div> : null}

      {state.rows.length ? (
        <div className={styles.previewHeader}>
          <h3>{state.phase === "applied" ? "Apply results" : "Preview results"}</h3>
          <span className={styles.previewSummary}>{state.rows.length} row{state.rows.length === 1 ? "" : "s"} checked</span>
        </div>
      ) : null}

      <ImportResult state={state} groupByCompany={groupResultsByCompany} />

      {state.phase === "preview" ? (
        <form action={formAction} className={styles.applyArea}>
          <input name="intent" type="hidden" value="apply" />
          <input name="sourceCsv" type="hidden" value={state.sourceCsv} />
          <input name="createMissingRoles" type="hidden" value={state.create_missing_roles ? "true" : "false"} />

          {applyConfirmation ? (
            <label className="check-field">
              <input name="confirmApply" type="checkbox" value="true" required />
              <span><strong>Confirm changes</strong><small className="muted">{applyConfirmation}</small></span>
            </label>
          ) : null}

          <p className={styles.help}>Preview is mandatory. Apply stays disabled while any row has an error or when the file contains no changes.</p>
          <div className="button-row">
            <button className="button" type="submit" disabled={pending || errors > 0 || actionable === 0}>
              {pending ? "Applying…" : errors ? `Resolve ${errors} error${errors === 1 ? "" : "s"}` : `Apply ${actionable} change${actionable === 1 ? "" : "s"}`}
            </button>
          </div>
        </form>
      ) : state.phase === "applied" ? (
        <div className="notice">Import finished. Results above reflect the apply attempt.</div>
      ) : null}
    </section>
  );
}

const tabs: Array<{ id: BulkImportView; label: string }> = [
  { id: "structure", label: "Company structure" },
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles & permissions" },
  { id: "role-products", label: "Role products" },
  { id: "company-products", label: "Company products" },
];

function isBulkImportView(value: string | null): value is BulkImportView {
  return value !== null && tabs.some((tab) => tab.id === value);
}

export function BulkImportWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const view: BulkImportView = isBulkImportView(requestedView) ? requestedView : "structure";
  const base = "/api/bulk-import";

  function selectView(nextView: BulkImportView) {
    if (nextView === view) return;

    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "structure") params.delete("view");
    else params.set("view", nextView);

    const query = params.toString();
    router.push(query ? `/bulk-import?${query}` : "/bulk-import", { scroll: false });
  }

  return (
    <div className={styles.workspace}>
      <nav className={styles.tabs} aria-label="Bulk import datasets">
        {tabs.map((tab) => (
          <button
            className={`${styles.tab} ${view === tab.id ? styles.tabActive : ""}`}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => selectView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.contextCard}>
        <div className={styles.contextText}>
          <strong>Multi-company routing</strong>
          <span>Rows are resolved by company_ref; Company structure uses company_reference. Preview validates every target before Apply, and Fluid/Magento authorization remains authoritative for every company.</span>
        </div>
        <span className={styles.referenceBadge}>Unlimited Admin</span>
      </div>

      <div hidden={view !== "structure"}>
        <BulkImportPanel
          eyebrow="Company hierarchy"
          title="Company structure"
          description="Maintain parent and child relationships across large company groups using references instead of Magento IDs."
          action={bulkCompanyStructureImportAction}
          exportHref={`${base}/exports/company-structure`}
          exampleHref={`${base}/examples/company-structure`}
          groupResultsByCompany={false}
          applyConfirmation="I have reviewed the proposed parent/child relationships and understand that applying them will reorganize the company hierarchy."
          help="Columns: company_reference, parent_reference. Leave parent_reference blank to make a company a root. Unknown references, duplicate company rows, self-parenting and hierarchy cycles are blocked before Apply."
        />
      </div>

      <div hidden={view !== "users"}>
        <BulkImportPanel
          eyebrow="Multi-company users"
          title="Users"
          description="Create or update company memberships across several company references in one reviewed import."
          action={bulkUsersImportAction}
          exportHref={`${base}/exports/users`}
          exampleHref={`${base}/examples/users`}
          help="company_ref routes each row. Email must resolve to an existing Magento customer. Preview results are grouped by company before Apply."
        />
      </div>

      <div hidden={view !== "roles"}>
        <BulkImportPanel
          eyebrow="Multi-company roles"
          title="Roles & permissions"
          description="Create or update roles across several companies from one permission matrix."
          action={bulkRolesImportAction}
          exportHref={`${base}/exports/roles`}
          exampleHref={`${base}/examples/roles`}
          showCreateMissingRoles
          help="All referenced companies must expose the same Fluid permission tree. Each company is dry-run and applied independently; a backend failure for one company does not rewrite another company's transaction."
        />
      </div>

      <div hidden={view !== "role-products"}>
        <BulkImportPanel
          eyebrow="Multi-company role catalogue"
          title="Role product restrictions"
          description="Update role-level SKU allowlists across several companies."
          action={bulkRoleProductsImportAction}
          exportHref={`${base}/exports/role-products`}
          exampleHref={`${base}/examples/role-products`}
          help="Rows are grouped by company_ref + user_role_name. Only roles named in the CSV are changed."
        />
      </div>

      <div hidden={view !== "company-products"}>
        <BulkImportPanel
          eyebrow="Multi-company catalogue"
          title="Company product restrictions"
          description="Update company-level SKU allowlists for several companies in one reviewed import."
          action={bulkCompanyProductsImportAction}
          exportHref={`${base}/exports/company-products`}
          exampleHref={`${base}/examples/company-products`}
          help="Rows are grouped by company_ref. Category settings and unrelated company controls remain untouched."
        />
      </div>
    </div>
  );
}
