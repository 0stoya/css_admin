import Link from "next/link";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyPortalAdministration, getCompanyPortalContext } from "@/lib/graphql/company-portal";
import {
  getCompanyPortalAppliedPurchaseControls,
  getCompanyPortalPurchaseControlHistory,
  getCompanyPortalPurchaseControls,
} from "@/lib/graphql/company-portal-purchase-controls";
import type { PurchaseControlRule } from "@/lib/graphql/purchase-controls";
import {
  applyPortalPurchaseControlTemplateAction,
  assignPortalPurchaseControlTemplateAction,
  deletePortalPurchaseControlTemplateAction,
  resetPortalPurchaseControlCountersAction,
  savePortalPurchaseControlTemplateAction,
} from "./actions";

function formatRules(rules: PurchaseControlRule[]) {
  return rules.map((rule) => `${rule.sku} | ${rule.quantity_limit} | ${rule.duration_days} | ${rule.start_date}`).join("\n");
}

export default async function CompanyPortalPurchaseControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; appliedSearch?: string; historySearch?: string }>;
}) {
  const query = await searchParams;
  let administration;
  try {
    administration = await getCompanyPortalAdministration();
  } catch (error) {
    return <section className="card stack"><div><p className="eyebrow">Company portal</p><h1>Purchase controls unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>;
  }

  if (!administration.can_view_purchase_controls) {
    return (
      <section className="card stack">
        <div><p className="eyebrow">Restricted</p><h1>Purchase controls</h1></div>
        <p className="muted">Fluid has not authorized purchase-control visibility for your role in the selected company.</p>
        <Link className="back-link" href="/portal">← Company overview</Link>
      </section>
    );
  }

  const appliedSearch = query.appliedSearch?.trim() ?? "";
  const historySearch = query.historySearch?.trim() ?? "";
  let companyName = `Company ${administration.company_id}`;
  let controls;
  let applied;
  let history;
  try {
    const [context, controlsResult, appliedResult, historyResult] = await Promise.all([
      getCompanyPortalContext(),
      getCompanyPortalPurchaseControls(),
      getCompanyPortalAppliedPurchaseControls(1, 50, appliedSearch),
      getCompanyPortalPurchaseControlHistory(1, 50, historySearch),
    ]);
    controls = controlsResult;
    applied = appliedResult;
    history = historyResult;
    const selectedCompany = context.companies.find((company) => company.selected);
    if (selectedCompany?.name) companyName = selectedCompany.name;
  } catch (error) {
    return <section className="card stack"><div><p className="eyebrow">Backend request failed</p><h1>Purchase controls unavailable</h1></div><div className="error">{graphQLErrorMessage(error)}</div></section>;
  }

  const canManage = administration.can_manage_purchase_controls;

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs"><Link href="/portal">Company</Link><span>/</span><span>Purchase controls</span></div>
      <header className="page-header">
        <div><p className="eyebrow">{companyName}</p><h1>Purchase controls</h1><p className="muted">Templates, role assignments, applied allowances and consumption history in the selected company context.</p></div>
        <span className={`badge ${canManage ? "badge-ok" : "badge-neutral"}`}>{canManage ? "Manage access" : "View access"}</span>
      </header>
      {query.notice ? <div className="notice">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}

      <section className="stat-grid">
        <article className="stat-card"><span className="stat-value">{controls.templates.length}</span><span className="stat-label">Templates</span></article>
        <article className="stat-card"><span className="stat-value">{applied.total_count}</span><span className="stat-label">Applied allowances</span></article>
        <article className="stat-card"><span className="stat-value">{history.total_count}</span><span className="stat-label">Purchase history rows</span></article>
      </section>

      {canManage ? (
        <section className="card stack">
          <div><p className="eyebrow">New template</p><h2>Create purchase-control template</h2><p className="muted">Enter one rule per line using SKU | quantity limit | duration days | YYYY-MM-DD. Fluid validates every SKU against the company catalogue.</p></div>
          <form className="stack" action={savePortalPurchaseControlTemplateAction}>
            <div className="field"><label htmlFor="newTemplateName">Template name</label><input id="newTemplateName" name="name" required /></div>
            <div className="field"><label htmlFor="newTemplateRules">Rules</label><textarea id="newTemplateRules" name="rules" rows={6} placeholder="ABC | 2 | 30 | 2026-09-05" /></div>
            <div><button className="button" type="submit">Create template</button></div>
          </form>
        </section>
      ) : null}

      <section className="stack">
        <div><h2>Templates</h2><p className="muted">Template and assignment state returned by Fluid.</p></div>
        {!controls.templates.length ? <div className="card muted">No purchase-control templates are configured.</div> : controls.templates.map((template) => (
          <article className="card stack" key={template.template_id}>
            <div className="card-heading-row"><div><p className="eyebrow">Template {template.template_id}</p><h3>{template.name}</h3><p className="muted">{template.rules.length} rule{template.rules.length === 1 ? "" : "s"} · {template.assigned_roles.length} assigned role{template.assigned_roles.length === 1 ? "" : "s"}</p></div>{template.assigned_roles.length ? <span className="badge badge-ok">{template.assigned_roles.map((role) => role.role_name).join(", ")}</span> : <span className="badge badge-neutral">Unassigned</span>}</div>
            <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Limit</th><th>Window</th><th>Starts</th></tr></thead><tbody>{template.rules.map((rule) => <tr key={rule.rule_id}><td>{rule.product_name}</td><td><code>{rule.sku}</code></td><td>{rule.quantity_limit}</td><td>{rule.duration_days} days</td><td>{rule.start_date}</td></tr>)}{!template.rules.length ? <tr><td colSpan={5}>No rules in this template.</td></tr> : null}</tbody></table></div>
            {canManage ? (
              <details className="mutation-panel"><summary>Manage template</summary>
                <form className="compact-form" action={savePortalPurchaseControlTemplateAction}><input type="hidden" name="templateId" value={template.template_id} /><div className="field"><label htmlFor={`templateName-${template.template_id}`}>Template name</label><input id={`templateName-${template.template_id}`} name="name" required defaultValue={template.name} /></div><div className="field"><label htmlFor={`templateRules-${template.template_id}`}>Rules</label><textarea id={`templateRules-${template.template_id}`} name="rules" rows={Math.max(4, template.rules.length + 1)} defaultValue={formatRules(template.rules)} /></div><button className="button" type="submit">Save template</button></form>
                <div className="grid">
                  <form className="compact-form" action={applyPortalPurchaseControlTemplateAction}>
                    <input type="hidden" name="templateId" value={template.template_id} />
                    <p className="muted">Overwrite eligible users in assigned roles with these rules.</p>
                    <label className="check-field"><input type="checkbox" name="confirmApply" value="yes" required /><span><strong>Confirm overwrite</strong><span className="muted small-text">Required before applying this template to users.</span></span></label>
                    <button className="button" type="submit">Apply to users</button>
                  </form>
                  <form className="compact-form" action={resetPortalPurchaseControlCountersAction}>
                    <input type="hidden" name="templateId" value={template.template_id} />
                    <p className="muted">Reset consumed counters for users governed by this template.</p>
                    <label className="check-field"><input type="checkbox" name="confirmReset" value="yes" required /><span><strong>Confirm reset</strong><span className="muted small-text">Required before clearing consumed counters.</span></span></label>
                    <button className="button" type="submit">Reset counters</button>
                  </form>
                </div>
                <form className="danger-zone" action={deletePortalPurchaseControlTemplateAction}><input type="hidden" name="templateId" value={template.template_id} /><div className="field"><label htmlFor={`deleteTemplate-${template.template_id}`}>Type {template.name} to delete this unassigned template</label><input id={`deleteTemplate-${template.template_id}`} name="confirmName" autoComplete="off" required /></div><button className="button button-danger" type="submit">Delete template</button></form>
              </details>
            ) : null}
          </article>
        ))}
      </section>

      {canManage ? (
        <section className="card stack">
          <div><p className="eyebrow">Role assignment</p><h2>Assign template to role</h2><p className="muted">Only company control roles returned by Fluid are available. Choose no template to unassign.</p></div>
          <form className="compact-form" action={assignPortalPurchaseControlTemplateAction}>
            <div className="field"><label htmlFor="assignmentRole">Role</label><select id="assignmentRole" name="roleId" required defaultValue=""><option value="" disabled>Select role</option>{administration.control_roles.map((role) => <option value={role.role_id} key={role.role_id}>{role.name}</option>)}</select></div>
            <div className="field"><label htmlFor="assignmentTemplate">Template</label><select id="assignmentTemplate" name="templateId" defaultValue=""><option value="">No template (unassign)</option>{controls.templates.map((template) => <option value={template.template_id} key={template.template_id}>{template.name}</option>)}</select></div>
            <label className="check-field"><input type="checkbox" name="applyToUsers" /><span><strong>Apply immediately</strong><span className="muted small-text">Overwrite eligible users when assigning.</span></span></label>
            <button className="button" type="submit">Save role assignment</button>
          </form>
        </section>
      ) : null}

      <section className="card stack">
        <div><p className="eyebrow">Current state</p><h2>Applied purchase allowances</h2><p className="muted">Search by customer email or SKU. Showing up to 50 rows.</p></div>
        <form className="inline-form" method="get"><div className="field grow"><label htmlFor="appliedSearch">Search allowances</label><input id="appliedSearch" name="appliedSearch" defaultValue={appliedSearch} placeholder="email or SKU" /></div>{historySearch ? <input type="hidden" name="historySearch" value={historySearch} /> : null}<button className="button button-secondary" type="submit">Search</button></form>
        {!applied.items.length ? <p className="muted">No applied purchase allowances found.</p> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Product</th><th>Limit</th><th>Used</th><th>Remaining</th><th>Window</th></tr></thead><tbody>{applied.items.map((item) => <tr key={item.applied_id}><td>{item.email}</td><td><code>{item.sku}</code><br /><span className="muted">{item.product_name}</span></td><td>{item.quantity_limit}</td><td>{item.purchases_so_far}</td><td>{item.remaining_quantity}</td><td>{item.duration_days} days from {item.start_date}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="card stack">
        <div><p className="eyebrow">Consumption log</p><h2>Purchase history</h2><p className="muted">Search by customer email, SKU or order number. Showing up to 50 rows.</p></div>
        <form className="inline-form" method="get"><div className="field grow"><label htmlFor="historySearch">Search history</label><input id="historySearch" name="historySearch" defaultValue={historySearch} placeholder="email, SKU or order" /></div>{appliedSearch ? <input type="hidden" name="appliedSearch" value={appliedSearch} /> : null}<button className="button button-secondary" type="submit">Search</button></form>
        {!history.items.length ? <p className="muted">No purchase-control history found.</p> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Product</th><th>Order</th><th>Quantity</th><th>Ordered</th></tr></thead><tbody>{history.items.map((item) => <tr key={item.log_id}><td>{item.email}</td><td><code>{item.sku}</code><br /><span className="muted">{item.product_name}</span></td><td>{item.order_number}</td><td>{item.purchased_quantity}</td><td>{item.ordered_at}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
