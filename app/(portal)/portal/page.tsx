import Link from "next/link";
import { CompanyPermissionPicker } from "@/components/company-permission-picker";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPortalAdministration,
  getCompanyPortalContext,
  type CompanyPortalAdministration,
  type CompanyPortalContext,
  type CompanyPortalUser,
} from "@/lib/graphql/company-portal";
import {
  deletePortalRoleAction,
  removePortalUserAction,
  savePortalRoleAction,
  selectPortalCompanyAction,
  updatePortalUserAction,
} from "./actions";

async function loadPortal() {
  let context: CompanyPortalContext | null = null;
  let administration: CompanyPortalAdministration | null = null;
  let error: string | null = null;

  try {
    context = await getCompanyPortalContext();
  } catch (requestError) {
    return { context, administration, error: graphQLErrorMessage(requestError) };
  }

  if (context.selected_company_id !== null) {
    try {
      administration = await getCompanyPortalAdministration();
    } catch (requestError) {
      error = graphQLErrorMessage(requestError);
    }
  }

  return { context, administration, error };
}

function userName(user: Pick<CompanyPortalUser, "firstname" | "lastname">) {
  return `${user.firstname} ${user.lastname}`.trim();
}

function resourcePathMap(administration: CompanyPortalAdministration) {
  const byId = new Map(administration.resources.map((resource) => [resource.resource_id, resource]));
  const paths = new Map<string, string>();

  function pathFor(resourceId: string, visiting = new Set<string>()): string {
    const cached = paths.get(resourceId);
    if (cached) return cached;
    const resource = byId.get(resourceId);
    if (!resource) return resourceId;
    if (visiting.has(resourceId)) return resource.title;
    visiting.add(resourceId);
    const parent = resource.parent_resource_id ? byId.get(resource.parent_resource_id) : null;
    const path = parent ? `${pathFor(parent.resource_id, visiting)} > ${resource.title}` : resource.title;
    paths.set(resourceId, path);
    visiting.delete(resourceId);
    return path;
  }

  administration.resources.forEach((resource) => pathFor(resource.resource_id));
  return paths;
}

export default async function CompanyPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const { context, administration, error } = await loadPortal();
  const message = params.error || error;

  if (!context) {
    return (
      <section className="card stack">
        <div><p className="eyebrow">Company portal</p><h1>Company context unavailable</h1></div>
        {message ? <div className="error">{message}</div> : null}
      </section>
    );
  }

  const selected = context.companies.find((company) => company.selected) ?? null;
  const usersById = new Map(administration?.users.map((user) => [user.user_id, user]) ?? []);
  const resourcePaths = administration ? resourcePathMap(administration) : new Map<string, string>();

  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">{selected?.reference || "Company user"}</p>
          <h1>Company management</h1>
          <p className="muted">Manage the selected company within the exact capabilities returned by Fluid.</p>
        </div>
      </header>

      {params.success ? <div className="notice" role="status">{params.success}</div> : null}
      {message ? <div className="error" role="alert">{message}</div> : null}

      <section className="card stack">
        <div className="card-heading-row">
          <div>
            <p className="eyebrow">Company context</p>
            <h2>{selected?.name || "Select a company"}</h2>
            <p className="muted">{selected ? `${selected.reference || "No reference"} · Company ${selected.company_id}` : "No company is currently selected."}</p>
          </div>
          {selected ? <span className={`badge ${selected.active ? "badge-ok" : "badge-neutral"}`}>{selected.active ? "Active" : "Inactive"}</span> : null}
        </div>

        {context.companies.length ? (
          <form className="inline-form" action={selectPortalCompanyAction}>
            <div className="field grow">
              <label htmlFor="companyId">Company</label>
              <select id="companyId" name="companyId" defaultValue={context.selected_company_id ?? undefined}>
                {context.companies.map((company) => (
                  <option key={company.company_id} value={company.company_id}>
                    {company.name || `Company ${company.company_id}`}{company.reference ? ` (${company.reference})` : ""}{!company.active ? " — inactive" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button className="button" type="submit">Use company</button>
          </form>
        ) : <div className="error">This Magento customer is not assigned to a Fluid company.</div>}
      </section>

      {administration ? (
        <>
          <section className="card stack">
            <div className="card-heading-row">
              <div><p className="eyebrow">Access</p><h2>{administration.is_company_admin ? "Company administrator" : "Company role access"}</h2><p className="muted">Capabilities below are returned by Fluid for company user {administration.company_user_id}.</p></div>
              <span className={`badge ${administration.is_company_admin ? "badge-ok" : "badge-neutral"}`}>{administration.is_company_admin ? "Company admin" : "Role-authorized"}</span>
            </div>
            <dl className="detail-list">
              <dt>View users</dt><dd>{administration.can_view_users ? "Yes" : "No"}</dd>
              <dt>Manage users</dt><dd>{administration.can_manage_users ? "Yes" : "No"}</dd>
              <dt>View roles</dt><dd>{administration.can_view_roles ? "Yes" : "No"}</dd>
              <dt>Manage roles</dt><dd>{administration.can_manage_roles ? "Yes" : "No"}</dd>
              <dt>Manage catalogue visibility</dt><dd>{administration.can_manage_catalog_visibility ? "Yes" : "No"}</dd>
              <dt>View purchase controls</dt><dd>{administration.can_view_purchase_controls ? "Yes" : "No"}</dd>
              <dt>Manage purchase controls</dt><dd>{administration.can_manage_purchase_controls ? "Yes" : "No"}</dd>
            </dl>
          </section>

          {administration.can_manage_catalog_visibility || administration.can_view_purchase_controls ? (
            <section className="grid" aria-label="Authorized company controls">
              {administration.can_manage_catalog_visibility ? (
                <article className="card stack"><div><p className="eyebrow">Authorized</p><h2>Catalogue controls</h2></div><p className="muted">Manage company and role catalogue visibility.</p><Link className="button button-link" href="/portal/catalog">Open catalogue controls</Link></article>
              ) : null}
              {administration.can_view_purchase_controls ? (
                <article className="card stack"><div><p className="eyebrow">Authorized</p><h2>Purchase controls</h2></div><p className="muted">{administration.can_manage_purchase_controls ? "Manage templates, assignments and counters." : "View templates, allowances and purchase history."}</p><Link className="button button-link" href="/portal/purchase-controls">Open purchase controls</Link></article>
              ) : null}
            </section>
          ) : null}

          {(administration.can_view_users || administration.can_view_roles) ? (
            <nav className="management-jump-nav" aria-label="Company management sections">
              {administration.can_view_users ? <a href="#portal-users">Users <span>{administration.users.length}</span></a> : null}
              {administration.can_view_roles ? <a href="#portal-roles">Roles <span>{administration.roles.length}</span></a> : null}
            </nav>
          ) : null}

          {administration.can_view_users ? (
            <section className="card stack management-section" id="portal-users">
              <div><p className="eyebrow">Membership</p><h2>Company users</h2><p className="muted">Staff provision new memberships; authorized company managers can maintain role, manager and approval settings.</p></div>
              {administration.users.length ? (
                <div className="table-wrap management-table">
                  <table>
                    <thead><tr><th>User</th><th>Role</th><th>Manager</th><th>Approval</th><th>Capabilities</th><th>Manage</th></tr></thead>
                    <tbody>
                      {administration.users.map((user) => {
                        const manager = user.manager_user_id === null ? null : usersById.get(user.manager_user_id);
                        return (
                          <tr key={user.user_id}>
                            <td><div className="cell-stack"><strong>{userName(user)}</strong><span className="muted small-text">{user.email}</span>{user.is_company_admin ? <span className="badge badge-ok">Company admin</span> : null}</div></td>
                            <td>{user.roles.map((role) => role.name).join(", ") || "—"}</td>
                            <td>{manager ? userName(manager) : user.manager_user_id === null ? "—" : `User #${user.manager_user_id}`}</td>
                            <td>{user.approval_type}{user.approval_threshold !== null ? ` · ${user.approval_threshold}` : ""}</td>
                            <td><div className="capability-list"><span>{user.can_checkout ? "✓" : "—"} Checkout</span><span>{user.can_approve_credit_orders ? "✓" : "—"} Credit approval</span><span>{user.can_auto_approve_credit_order ? "✓" : "—"} Auto-approve</span></div></td>
                            <td>
                              {administration.can_manage_users && !user.is_company_admin && administration.roles.length ? (
                                <details className="mutation-panel management-edit-panel"><summary>Edit</summary><div className="management-edit-body">
                                  <form className="compact-form" action={updatePortalUserAction}>
                                    <input type="hidden" name="userId" value={user.user_id} />
                                    <div className="field"><label htmlFor={`role-${user.user_id}`}>Role</label><select id={`role-${user.user_id}`} name="roleId" defaultValue={user.roles[0]?.role_id ?? ""} required><option value="" disabled>Select a role</option>{administration.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}</select></div>
                                    <div className="field"><label htmlFor={`manager-${user.user_id}`}>Manager</label><select id={`manager-${user.user_id}`} name="managerId" defaultValue={user.manager_user_id ?? ""}><option value="">No manager</option>{administration.users.filter((candidate) => candidate.user_id !== user.user_id).map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{userName(candidate)} · {candidate.email}</option>)}</select></div>
                                    <div className="field"><label htmlFor={`approval-${user.user_id}`}>Approval type</label><input id={`approval-${user.user_id}`} name="approvalType" defaultValue={user.approval_type} /></div>
                                    <div className="field"><label htmlFor={`threshold-${user.user_id}`}>Approval threshold</label><input id={`threshold-${user.user_id}`} name="approvalThreshold" type="number" step="any" defaultValue={user.approval_threshold ?? ""} /></div>
                                    <button className="button" type="submit">Save user</button>
                                  </form>
                                  <form className="danger-zone" action={removePortalUserAction}><input type="hidden" name="userId" value={user.user_id} /><div className="field"><label htmlFor={`remove-${user.user_id}`}>Type {user.email} to remove</label><input id={`remove-${user.user_id}`} name="confirmEmail" autoComplete="off" required /></div><button className="button button-danger" type="submit">Remove company user</button></form>
                                </div></details>
                              ) : user.is_company_admin ? <span className="muted small-text">Protected by Fluid</span> : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No users returned for this company.</p>}
            </section>
          ) : null}

          {administration.can_view_roles ? (
            <section className="card stack management-section" id="portal-roles">
              <div><p className="eyebrow">Access control</p><h2>Company roles</h2><p className="muted">The permission picker uses Fluid&apos;s live resource hierarchy and keeps protected resources intact.</p></div>

              {administration.can_manage_roles ? (
                <details className="management-create-panel nested-card">
                  <summary><span><strong>Create role</strong><small>Select permissions by group instead of scrolling one long resource list.</small></span></summary>
                  <form className="management-panel-body stack" action={savePortalRoleAction}>
                    <div className="form-grid"><div className="field"><label htmlFor="newRoleName">Role name</label><input id="newRoleName" name="name" required /></div><div className="field"><label htmlFor="newRoleSort">Sort order</label><input id="newRoleSort" name="sortOrder" type="number" step="1" /></div></div>
                    <CompanyPermissionPicker resources={administration.resources} label="Role permissions" />
                    <div><button className="button" type="submit">Create role</button></div>
                  </form>
                </details>
              ) : null}

              {administration.roles.length ? (
                <div className="table-wrap management-table">
                  <table>
                    <thead><tr><th>Role</th><th>Users</th><th>Sort</th><th>Permissions</th><th>Manage</th></tr></thead>
                    <tbody>
                      {administration.roles.map((role) => (
                        <tr key={role.role_id}>
                          <td><div className="cell-stack"><strong>{role.name}</strong>{!role.manageable ? <span className="badge badge-neutral">Protected</span> : null}</div></td>
                          <td>{role.user_count}</td>
                          <td>{role.sort_order}</td>
                          <td><details className="resource-details compact-resource-summary"><summary>{role.allowed_resources.length} assigned</summary>{role.allowed_resources.length ? <ul className="compact-list">{role.allowed_resources.map((resourceId) => <li key={resourceId}>{resourcePaths.get(resourceId) ?? resourceId}</li>)}</ul> : <p className="muted small-text">No explicit permissions returned.</p>}</details></td>
                          <td>
                            {administration.can_manage_roles && role.manageable ? (
                              <details className="mutation-panel management-edit-panel"><summary>Edit</summary><div className="management-edit-body role-edit-body">
                                <form className="stack" action={savePortalRoleAction}>
                                  <input type="hidden" name="roleId" value={role.role_id} />
                                  <div className="form-grid"><div className="field"><label htmlFor={`role-name-${role.role_id}`}>Role name</label><input id={`role-name-${role.role_id}`} name="name" defaultValue={role.name} required /></div><div className="field"><label htmlFor={`role-sort-${role.role_id}`}>Sort order</label><input id={`role-sort-${role.role_id}`} name="sortOrder" type="number" step="1" defaultValue={role.sort_order} /></div></div>
                                  <CompanyPermissionPicker resources={administration.resources} selectedResourceIds={role.allowed_resources} label={`${role.name} permissions`} />
                                  <div><button className="button" type="submit">Save role</button></div>
                                </form>
                                <form className="danger-zone" action={deletePortalRoleAction}><input type="hidden" name="roleId" value={role.role_id} /><div className="field"><label htmlFor={`delete-role-${role.role_id}`}>Type {role.name} to delete</label><input id={`delete-role-${role.role_id}`} name="confirmRoleName" autoComplete="off" required /></div><button className="button button-danger" type="submit" disabled={role.user_count > 0}>Delete role</button>{role.user_count > 0 ? <p className="muted small-text">This role still has assigned users.</p> : null}</form>
                              </div></details>
                            ) : <span className="muted small-text">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No saved roles returned for this company.</p>}
            </section>
          ) : null}
        </>
      ) : context.selected_company_id !== null ? (
        <section className="card stack"><div><p className="eyebrow">Restricted</p><h2>No management access for this company</h2><p className="muted">Fluid did not authorize company-user or role administration for the selected company. Choose another company if available.</p></div></section>
      ) : null}
    </div>
  );
}
