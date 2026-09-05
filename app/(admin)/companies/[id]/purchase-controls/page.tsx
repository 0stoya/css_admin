import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getAppliedPurchaseControls,
  getPurchaseControlHistory,
  getPurchaseControls,
  type PurchaseControlRule,
} from "@/lib/graphql/purchase-controls";
import {
  applyPurchaseControlTemplateAction,
  assignPurchaseControlTemplateAction,
  deletePurchaseControlTemplateAction,
  resetPurchaseControlCountersAction,
  savePurchaseControlTemplateAction,
} from "./actions";

function formatRules(rules: PurchaseControlRule[]) {
  return rules
    .map((rule) => `${rule.sku} | ${rule.quantity_limit} | ${rule.duration_days} | ${rule.start_date}`)
    .join("\n");
}

async function loadPurchaseControls(companyId: number, appliedSearch: string, historySearch: string) {
  try {
    const [company, management, controls, applied, history] = await Promise.all([
      getCompany(companyId),
      getCompanyManagement(companyId),
      getPurchaseControls(companyId),
      getAppliedPurchaseControls(companyId, 1, 50, appliedSearch),
      getPurchaseControlHistory(companyId, 1, 50, historySearch),
    ]);

    return { company, management, controls, applied, history, error: null };
  } catch (error) {
    return {
      company: null,
      management: null,
      controls: null,
      applied: null,
      history: null,
      error: graphQLErrorMessage(error),
    };
  }
}

export default async function PurchaseControlsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    notice?: string;
    error?: string;
    appliedSearch?: string;
    historySearch?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    notFound();
  }

  const appliedSearch = query.appliedSearch?.trim() ?? "";
  const historySearch = query.historySearch?.trim() ?? "";
  const { company, management, controls, applied, history, error } = await loadPurchaseControls(
    companyId,
    appliedSearch,
    historySearch,
  );

  if (!company || !management || !controls || !applied || !history) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company</Link></div>
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Purchase controls unavailable</h1>
          </div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <div><Link className="back-link" href={`/companies/${companyId}`}>← {company.name}</Link></div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>Purchase controls</h1>
          <p className="muted">Template limits, role assignment, applied allowances and purchase history.</p>
        </div>
      </header>

      {query.notice ? <div className="success">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}

      <section className="grid">
        <article className="card">
          <p className="eyebrow">Templates</p>
          <h2>{controls.templates.length}</h2>
        </article>
        <article className="card">
          <p className="eyebrow">Applied allowances</p>
          <h2>{applied.total_count}</h2>
        </article>
        <article className="card">
          <p className="eyebrow">Purchase history rows</p>
          <h2>{history.total_count}</h2>
        </article>
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">New template</p>
          <h2>Create purchase-control template</h2>
          <p className="muted">
            Enter one rule per line using SKU | quantity limit | duration days | YYYY-MM-DD. Fluid validates that every SKU is available in the company catalogue.
          </p>
        </div>
        <form className="stack" action={savePurchaseControlTemplateAction}>
          <input type="hidden" name="companyId" value={companyId} />
          <label>
            Template name
            <input name="name" required />
          </label>
          <label>
            Rules
            <textarea
              name="rules"
              rows={6}
              placeholder="ABC | 2 | 30 | 2026-09-05"
            />
          </label>
          <div><button type="submit">Create template</button></div>
        </form>
      </section>

      <section className="stack">
        <div>
          <h2>Templates</h2>
          <p className="muted">Saving a template atomically replaces its rule set.</p>
        </div>

        {controls.templates.length === 0 ? (
          <div className="card muted">No purchase-control templates are configured.</div>
        ) : (
          controls.templates.map((template) => (
            <article className="card stack" key={template.template_id}>
              <div>
                <p className="eyebrow">Template {template.template_id}</p>
                <h3>{template.name}</h3>
                <p className="muted">
                  {template.rules.length} rule{template.rules.length === 1 ? "" : "s"} · Assigned to {template.assigned_roles.length} role{template.assigned_roles.length === 1 ? "" : "s"}
                </p>
                {template.assigned_roles.length ? (
                  <p className="muted">Roles: {template.assigned_roles.map((role) => role.role_name).join(", ")}</p>
                ) : null}
              </div>

              <form className="stack" action={savePurchaseControlTemplateAction}>
                <input type="hidden" name="companyId" value={companyId} />
                <input type="hidden" name="templateId" value={template.template_id} />
                <label>
                  Template name
                  <input name="name" required defaultValue={template.name} />
                </label>
                <label>
                  Rules
                  <textarea name="rules" rows={Math.max(4, template.rules.length + 1)} defaultValue={formatRules(template.rules)} />
                </label>
                <div><button type="submit">Save template</button></div>
              </form>

              <div className="grid">
                <form className="stack" action={applyPurchaseControlTemplateAction}>
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="templateId" value={template.template_id} />
                  <p className="muted">Overwrite eligible users in assigned roles with the current template rules.</p>
                  <div><button type="submit">Apply to users</button></div>
                </form>

                <form className="stack" action={resetPurchaseControlCountersAction}>
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="templateId" value={template.template_id} />
                  <p className="muted">Reset consumed counters for users currently governed by this template.</p>
                  <div><button type="submit">Reset counters</button></div>
                </form>
              </div>

              <form className="stack" action={deletePurchaseControlTemplateAction}>
                <input type="hidden" name="companyId" value={companyId} />
                <input type="hidden" name="templateId" value={template.template_id} />
                <label>
                  Type the exact template name to delete an unassigned template
                  <input name="confirmName" placeholder={template.name} />
                </label>
                <div><button type="submit">Delete template</button></div>
              </form>
            </article>
          ))
        )}
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Role assignment</p>
          <h2>Assign template to role</h2>
          <p className="muted">Choose no template to remove the purchase-control assignment from a role.</p>
        </div>
        <form className="stack" action={assignPurchaseControlTemplateAction}>
          <input type="hidden" name="companyId" value={companyId} />
          <label>
            Role
            <select name="roleId" required defaultValue="">
              <option value="" disabled>Select role</option>
              {management.roles.map((role) => (
                <option value={role.role_id} key={role.role_id}>{role.name}</option>
              ))}
            </select>
          </label>
          <label>
            Template
            <select name="templateId" defaultValue="">
              <option value="">No template (unassign)</option>
              {controls.templates.map((template) => (
                <option value={template.template_id} key={template.template_id}>{template.name}</option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" name="applyToUsers" /> Apply immediately to eligible users when assigning
          </label>
          <div><button type="submit">Save role assignment</button></div>
        </form>
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Current state</p>
          <h2>Applied purchase allowances</h2>
          <p className="muted">Search by customer email or SKU. Showing up to 50 rows.</p>
        </div>
        <form method="get">
          <label>
            Search applied allowances
            <input name="appliedSearch" defaultValue={appliedSearch} placeholder="email or SKU" />
          </label>
          {historySearch ? <input type="hidden" name="historySearch" value={historySearch} /> : null}
          <button type="submit">Search</button>
        </form>
        {applied.items.length === 0 ? (
          <p className="muted">No applied purchase allowances found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Product</th>
                  <th>Limit</th>
                  <th>Used</th>
                  <th>Remaining</th>
                  <th>Window</th>
                </tr>
              </thead>
              <tbody>
                {applied.items.map((item) => (
                  <tr key={item.applied_id}>
                    <td>{item.email}</td>
                    <td>{item.sku}<br /><span className="muted">{item.product_name}</span></td>
                    <td>{item.quantity_limit}</td>
                    <td>{item.purchases_so_far}</td>
                    <td>{item.remaining_quantity}</td>
                    <td>{item.duration_days} days from {item.start_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Consumption log</p>
          <h2>Purchase history</h2>
          <p className="muted">Search by customer email, SKU or order number. Showing up to 50 rows.</p>
        </div>
        <form method="get">
          <label>
            Search history
            <input name="historySearch" defaultValue={historySearch} placeholder="email, SKU or order" />
          </label>
          {appliedSearch ? <input type="hidden" name="appliedSearch" value={appliedSearch} /> : null}
          <button type="submit">Search</button>
        </form>
        {history.items.length === 0 ? (
          <p className="muted">No purchase-control history found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Product</th>
                  <th>Order</th>
                  <th>Quantity</th>
                  <th>Ordered</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.log_id}>
                    <td>{item.email}</td>
                    <td>{item.sku}<br /><span className="muted">{item.product_name}</span></td>
                    <td>{item.order_number}</td>
                    <td>{item.purchased_quantity}</td>
                    <td>{item.ordered_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
