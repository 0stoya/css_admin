import Link from "next/link";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPortalAdministration,
  getCompanyPortalContext,
  type CompanyPortalAdministration,
  type CompanyPortalContext,
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
        <div>
          <p className="eyebrow">Company portal</p>
          <h1>Company context unavailable</h1>
        </div>
        {message ? <div className="error">{message}</div> : null}
      </section>
    );
  }

  const selected = context.companies.find((company) => company.selected) ?? null;
  const assignableResources = administration?.resources.filter((resource) => resource.assignable) ?? [];

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Company user</p>
          <h1>Company management</h1>
          <p className="muted">
            Fluid company membership, ACL resources and write authorization remain authoritative. This portal does not grant Magento-admin privileges.
          </p>
        </div>
      </header>

      {params.success ? <div className="notice" role="status">{params.success}</div> : null}
      {message ? <div className="error" role="alert">{message}</div> : null}

      <section className="card stack">
        <div>
          <h2>Company context</h2>
          <p className="muted">
            {selected
              ? `${selected.name || `Company ${selected.company_id}`} · ${selected.reference || "No reference"}`
              : "No company is currently selected."}
          </p>
        </div>

        {context.companies.length ? (
          <form className="form" action={selectPortalCompanyAction}>
            <div className="field">
              <label htmlFor="companyId">Company</label>
              <select id="companyId" name="companyId" defaultValue={context.selected_company_id ?? undefined}>
                {context.companies.map((company) => (
                  <option key={company.company_id} value={company.company_id}>
                    {company.name || `Company ${company.company_id}`}
                    {company.reference ? ` (${company.reference})` : ""}
                    {!company.active ? " — inactive" : ""}
                  </option>
                ))}
              </select>
            </div>
            <button className="button" type="submit">Use company</button>
          </form>
        ) : (
          <div className="error">
            This Magento customer is not assigned to a Fluid company, so there is no company-management context to open.
          </div>
        )}
      </section>

      {administration ? (
        <>
          <section className="card stack">
            <div className="card-heading-row">
              <div>
                <p className="eyebrow">Permissions</p>
                <h2>{administration.is_company_admin ? "Company administrator" : "Company role access"}</h2>
                <p className="muted">Capabilities below are returned by Fluid for company user {administration.company_user_id}.</p>
              </div>
              <div className={`badge ${administration.is_company_admin ? "badge-ok" : "badge-neutral"}`}>
                {administration.is_company_admin ? "Company admin" : "Role-authorized"}
              </div>
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
                <article className="card stack">
                  <div><p className="eyebrow">Authorized</p><h2>Catalogue controls</h2></div>
                  <p className="muted">Manage company and role catalogue visibility within Fluid&apos;s company catalogue boundary.</p>
                  <Link className="button button-link" href="/portal/catalog">Open catalogue controls</Link>
                </article>
              ) : null}
              {administration.can_view_purchase_controls ? (
                <article className="card stack">
                  <div><p className="eyebrow">Authorized</p><h2>Purchase controls</h2></div>
                  <p className="muted">{administration.can_manage_purchase_controls ? "Manage templates, assignments and counters, and view allowances and history." : "View templates, allowances and purchase history."}</p>
                  <Link className="button button-link" href="/portal/purchase-controls">Open purchase controls</Link>
                </article>
              ) : null}
            </section>
          ) : null}

          {administration.can_view_users ? (
            <section className="card stack">
              <div>
                <h2>Company users</h2>
                <p className="muted">Company users are provisioned through the staff Admin app. Authorized company managers can maintain existing role, manager and approval settings here.</p>
              </div>

              {administration.users.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>User</th><th>Role</th><th>Manager</th><th>Approval</th><th>Capabilities</th><th>Manage</th></tr>
                    </thead>
                    <tbody>
                      {administration.users.map((user) => (
                        <tr key={user.user_id}>
                          <td>{user.firstname} {user.lastname}<br /><span className="muted">{user.email}</span></td>
                          <td>{user.roles.map((role) => role.name).join(", ") || "—"}</td>
                          <td>{user.manager_user_id ?? "—"}</td>
                          <td>{user.approval_type}{user.approval_threshold !== null ? ` · ${user.approval_threshold}` : ""}</td>
                          <td>
                            {[
                              user.can_checkout ? "Checkout" : null,
                              user.can_approve_credit_orders ? "Approve credit orders" : null,
                              user.can_auto_approve_credit_order ? "Auto approve" : null,
                            ].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td>
                            {administration.can_manage_users && !user.is_company_admin && administration.roles.length ? (
                              <details className="mutation-panel">
                                <summary>Edit</summary>
                                <form className="compact-form" action={updatePortalUserAction}>
                                  <input type="hidden" name="userId" value={user.user_id} />
                                  <div className="field">
                                    <label htmlFor={`role-${user.user_id}`}>Role</label>
                                    <select id={`role-${user.user_id}`} name="roleId" defaultValue={user.roles[0]?.role_id ?? ""} required>
                                      <option value="" disabled>Select a role</option>
                                      {administration.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}
                                    </select>
                                  </div>
                                  <div className="field">
                                    <label htmlFor={`manager-${user.user_id}`}>Manager</label>
                                    <select id={`manager-${user.user_id}`} name="managerId" defaultValue={user.manager_user_id ?? ""}>
                                      <option value="">No manager</option>
                                      {administration.users.map((candidate) => (
                                        <option key={candidate.user_id} value={candidate.user_id}>{candidate.firstname} {candidate.lastname} · {candidate.email}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="field">
                                    <label htmlFor={`approval-${user.user_id}`}>Approval type</label>
                                    <input id={`approval-${user.user_id}`} name="approvalType" defaultValue={user.approval_type} />
                                  </div>
                                  <div className="field">
                                    <label htmlFor={`threshold-${user.user_id}`}>Approval threshold</label>
                                    <input id={`threshold-${user.user_id}`} name="approvalThreshold" type="number" step="any" defaultValue={user.approval_threshold ?? ""} />
                                  </div>
                                  <button className="button" type="submit">Save user</button>
                                </form>
                                <form className="compact-form danger-zone" action={removePortalUserAction}>
                                  <input type="hidden" name="userId" value={user.user_id} />
                                  <div className="field">
                                    <label htmlFor={`remove-${user.user_id}`}>Type {user.email} to remove</label>
                                    <input id={`remove-${user.user_id}`} name="confirmEmail" autoComplete="off" required />
                                  </div>
                                  <button className="button button-danger" type="submit">Remove company user</button>
                                </form>
                              </details>
                            ) : user.is_company_admin ? <span className="muted">Company admin protected by Fluid</span> : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No users returned for this company.</p>}
            </section>
          ) : null}

          {administration.can_view_roles ? (
            <section className="card stack">
              <div>
                <h2>Company roles</h2>
                <p className="muted">ACL resources and assignability below come directly from Fluid. Role saves are still validated by the backend.</p>
              </div>

              {administration.can_manage_roles ? (
                <details className="mutation-panel">
                  <summary>Create role</summary>
                  <form className="compact-form" action={savePortalRoleAction}>
                    <div className="field">
                      <label htmlFor="newRoleName">Role name</label>
                      <input id="newRoleName" name="name" required />
                    </div>
                    <div className="field">
                      <label htmlFor="newRoleSort">Sort order</label>
                      <input id="newRoleSort" name="sortOrder" type="number" step="1" />
                    </div>
                    <div className="field">
                      <label>Allowed resources</label>
                      <div className="resource-picker">
                        {assignableResources.map((resource) => (
                          <label className="resource-option" key={resource.resource_id} style={{ paddingLeft: `${Math.min(resource.depth, 6) * 12}px` }}>
                            <input type="checkbox" name="allowedResources" value={resource.resource_id} />
                            <span>{resource.title}<br /><code>{resource.resource_id}</code></span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button className="button" type="submit">Create role</button>
                  </form>
                </details>
              ) : null}

              {administration.roles.length ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Role</th><th>Users</th><th>Sort</th><th>Resources</th><th>Manage</th></tr></thead>
                    <tbody>
                      {administration.roles.map((role) => (
                        <tr key={role.role_id}>
                          <td>{role.name}{role.manageable ? "" : " · protected"}</td>
                          <td>{role.user_count}</td>
                          <td>{role.sort_order}</td>
                          <td>{role.allowed_resources.length}</td>
                          <td>
                            {administration.can_manage_roles && role.manageable ? (
                              <details className="mutation-panel">
                                <summary>Edit</summary>
                                <form className="compact-form" action={savePortalRoleAction}>
                                  <input type="hidden" name="roleId" value={role.role_id} />
                                  <div className="field">
                                    <label htmlFor={`role-name-${role.role_id}`}>Role name</label>
                                    <input id={`role-name-${role.role_id}`} name="name" defaultValue={role.name} required />
                                  </div>
                                  <div className="field">
                                    <label htmlFor={`role-sort-${role.role_id}`}>Sort order</label>
                                    <input id={`role-sort-${role.role_id}`} name="sortOrder" type="number" step="1" defaultValue={role.sort_order} />
                                  </div>
                                  <div className="field">
                                    <label>Allowed resources</label>
                                    <div className="resource-picker">
                                      {assignableResources.map((resource) => (
                                        <label className="resource-option" key={resource.resource_id} style={{ paddingLeft: `${Math.min(resource.depth, 6) * 12}px` }}>
                                          <input
                                            type="checkbox"
                                            name="allowedResources"
                                            value={resource.resource_id}
                                            defaultChecked={role.allowed_resources.includes(resource.resource_id)}
                                          />
                                          <span>{resource.title}<br /><code>{resource.resource_id}</code></span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                  <button className="button" type="submit">Save role</button>
                                </form>
                                <form className="compact-form danger-zone" action={deletePortalRoleAction}>
                                  <input type="hidden" name="roleId" value={role.role_id} />
                                  <div className="field">
                                    <label htmlFor={`delete-role-${role.role_id}`}>Type {role.name} to delete</label>
                                    <input id={`delete-role-${role.role_id}`} name="confirmRoleName" autoComplete="off" required />
                                  </div>
                                  <button className="button button-danger" type="submit">Delete role</button>
                                </form>
                              </details>
                            ) : "—"}
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
        <section className="card stack">
          <div>
            <p className="eyebrow">Restricted</p>
            <h2>No management access for this company</h2>
            <p className="muted">
              The account is a company member, but Fluid did not authorize company-user or role administration for the selected company. Choose another company if available.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
