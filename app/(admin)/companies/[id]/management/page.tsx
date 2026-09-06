import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyPermissionPicker } from "@/components/company-permission-picker";
import { getCompany } from "@/lib/graphql/companies";
import {
  getCompanyCustomerCandidates,
  getCompanyManagement,
  type CompanyAdminRole,
  type CompanyAdminUser,
  type CompanyManagement,
} from "@/lib/graphql/company-management";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  addCompanyUserAction,
  deleteCompanyRoleAction,
  removeCompanyUserAction,
  saveCompanyRoleAction,
  updateCompanyUserAction,
} from "./actions";

const approvalTypeOptions = [
  { value: "all", label: "All" },
  { value: "template", label: "Template" },
  { value: "value", label: "Value" },
  { value: "none", label: "None" },
] as const;

type WorkspaceView = "users" | "roles";

function userName(user: Pick<CompanyAdminUser, "firstname" | "lastname" | "email">) {
  return `${user.firstname} ${user.lastname}`.trim() || user.email;
}

function approvalLabel(value: string) {
  return approvalTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function approvalSummary(user: CompanyAdminUser) {
  const threshold = user.approval_threshold === null ? "" : ` · ${user.approval_threshold}`;
  return `${approvalLabel(user.approval_type)}${threshold}`;
}

function ApprovalTypeSelect({ id, defaultValue = "all" }: { id?: string; defaultValue?: string }) {
  return (
    <select id={id} name="approvalType" defaultValue={defaultValue} required>
      {approvalTypeOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function workspaceView(value: string | undefined): WorkspaceView {
  return value === "roles" ? "roles" : "users";
}

async function loadManagement(companyId: number, candidateSearch?: string) {
  try {
    const [company, management, candidates] = await Promise.all([
      getCompany(companyId),
      getCompanyManagement(companyId),
      getCompanyCustomerCandidates(companyId, 1, 50, candidateSearch),
    ]);

    return { company, management, candidates, error: null };
  } catch (error) {
    return { company: null, management: null, candidates: null, error: graphQLErrorMessage(error) };
  }
}

function resourcePathMap(management: CompanyManagement) {
  const byId = new Map(management.resources.map((resource) => [resource.resource_id, resource]));
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

  management.resources.forEach((resource) => pathFor(resource.resource_id));
  return paths;
}

function CapabilityPills({ user }: { user: CompanyAdminUser }) {
  const capabilities = [
    user.can_checkout ? "Checkout" : null,
    user.can_approve_credit_orders ? "Credit approval" : null,
    user.can_auto_approve_credit_order ? "Auto-approve" : null,
  ].filter((value): value is string => Boolean(value));

  if (!capabilities.length) return <span className="muted small-text">Standard</span>;

  return (
    <div className="management-pill-row">
      {capabilities.map((capability) => <span className="management-pill" key={capability}>{capability}</span>)}
    </div>
  );
}

function rolePermissionCount(role: CompanyAdminRole, assignableResourceIds: Set<string>) {
  return role.allowed_resources.filter((resourceId) => assignableResourceIds.has(resourceId)).length;
}

function WorkspaceTabs({
  companyId,
  view,
  userCount,
  roleCount,
}: {
  companyId: number;
  view: WorkspaceView;
  userCount: number;
  roleCount: number;
}) {
  const base = `/companies/${companyId}/management`;
  return (
    <nav className="management-tabs" aria-label="Users and roles workspace">
      <Link className={view === "users" ? "management-tab management-tab-active" : "management-tab"} href={base} aria-current={view === "users" ? "page" : undefined}>
        <span>Users</span><strong>{userCount}</strong>
      </Link>
      <Link className={view === "roles" ? "management-tab management-tab-active" : "management-tab"} href={`${base}?view=roles`} aria-current={view === "roles" ? "page" : undefined}>
        <span>Roles</span><strong>{roleCount}</strong>
      </Link>
    </nav>
  );
}

export default async function CompanyManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const candidateSearch = firstParam(query.candidateSearch)?.trim();
  const view = workspaceView(firstParam(query.view));
  const userSearch = firstParam(query.userSearch)?.trim() ?? "";
  const userRoleFilter = firstParam(query.role)?.trim() ?? "";
  const roleSearch = firstParam(query.roleSearch)?.trim() ?? "";
  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);
  const { company, management, candidates, error } = await loadManagement(companyId, candidateSearch);

  if (!company || !management || !candidates) {
    return (
      <div className="stack">
        <section className="card stack">
          <div><p className="eyebrow">Backend request failed</p><h1>Users & roles unavailable</h1></div>
          <div className="error">{error}</div>
          <div><Link className="button button-secondary button-link" href={`/companies/${companyId}`}>Return to company overview</Link></div>
        </section>
      </div>
    );
  }

  const usersById = new Map(management.users.map((user) => [user.user_id, user]));
  const resourcePaths = resourcePathMap(management);
  const assignableResourceIds = new Set(
    management.resources.filter((resource) => resource.assignable).map((resource) => resource.resource_id),
  );
  const availableCandidates = candidates.items.filter((candidate) => !candidate.assigned_to_company);

  const normalizedUserSearch = userSearch.toLocaleLowerCase();
  const filteredUsers = management.users.filter((user) => {
    const searchText = `${userName(user)} ${user.email} ${user.roles.map((role) => role.name).join(" ")}`.toLocaleLowerCase();
    const matchesSearch = !normalizedUserSearch || searchText.includes(normalizedUserSearch);
    const matchesRole = !userRoleFilter || user.roles.some((role) => String(role.role_id) === userRoleFilter);
    return matchesSearch && matchesRole;
  });

  const normalizedRoleSearch = roleSearch.toLocaleLowerCase();
  const filteredRoles = management.roles.filter((role) => {
    if (!normalizedRoleSearch) return true;
    if (role.name.toLocaleLowerCase().includes(normalizedRoleSearch)) return true;
    return role.allowed_resources.some((resourceId) =>
      (resourcePaths.get(resourceId) ?? resourceId).toLocaleLowerCase().includes(normalizedRoleSearch),
    );
  });

  const companyAdminCount = management.users.filter((user) => user.is_company_admin).length;
  const roleInUseCount = management.roles.filter((role) => role.user_count > 0).length;
  const assignableResourceCount = assignableResourceIds.size;

  return (
    <div className="stack section-gap management-workspace">
      <header className="page-header management-page-header">
        <div>
          <p className="eyebrow">Company access</p>
          <h1>Users & roles</h1>
          <p className="muted">Manage membership, approval settings and Fluid permissions without leaving the current company workspace.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <WorkspaceTabs companyId={company.company_id} view={view} userCount={management.users.length} roleCount={management.roles.length} />

      {view === "users" ? (
        <section className="stack management-view">
          <div className="management-view-heading">
            <div>
              <p className="eyebrow">Membership</p>
              <h2>Company users</h2>
              <p className="muted">{management.users.length} users · {companyAdminCount} company administrator{companyAdminCount === 1 ? "" : "s"}</p>
            </div>
            <details className="management-create-panel management-create-inline" open={Boolean(candidateSearch)}>
              <summary><span><strong>Add user</strong><small>Existing Magento customer</small></span></summary>
              <div className="management-panel-body stack">
                <form className="management-candidate-search" method="get">
                  <input name="view" type="hidden" value="users" />
                  <div className="field grow">
                    <label htmlFor="candidateSearch">Find Magento customer</label>
                    <input id="candidateSearch" name="candidateSearch" defaultValue={candidateSearch} placeholder="Name or email" />
                  </div>
                  <button className="button button-secondary" type="submit">Search</button>
                </form>

                <form action={addCompanyUserAction} className="management-user-form">
                  <input name="companyId" type="hidden" value={company.company_id} />
                  <input name="returnView" type="hidden" value="users" />
                  <div className="field management-field-wide">
                    <label htmlFor="customerId">Customer</label>
                    <select id="customerId" name="customerId" required defaultValue="">
                      <option value="" disabled>Select a customer</option>
                      {availableCandidates.map((candidate) => (
                        <option key={candidate.customer_id} value={candidate.customer_id}>
                          {candidate.firstname} {candidate.lastname} · {candidate.email} · #{candidate.customer_id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="newRoleId">Role</label>
                    <select id="newRoleId" name="roleId" required defaultValue="">
                      <option value="" disabled>Select role</option>
                      {management.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="newManagerId">Manager</label>
                    <select id="newManagerId" name="managerId" defaultValue="">
                      <option value="">No manager</option>
                      {management.users.map((user) => <option key={user.user_id} value={user.user_id}>{userName(user)}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="newApprovalType">Approval type</label>
                    <ApprovalTypeSelect id="newApprovalType" />
                  </div>
                  <div className="field">
                    <label htmlFor="newApprovalThreshold">Approval threshold</label>
                    <input id="newApprovalThreshold" name="approvalThreshold" type="number" min="0" step="0.01" />
                  </div>
                  <div className="management-form-actions">
                    <button className="button" type="submit" disabled={!availableCandidates.length || !management.roles.length}>Add company user</button>
                    <span className="muted small-text">{availableCandidates.length} available in the current {candidateSearch ? "search" : "candidate set"}.</span>
                  </div>
                </form>
              </div>
            </details>
          </div>

          <form className="card management-filter-bar" method="get">
            <input name="view" type="hidden" value="users" />
            <div className="field grow">
              <label htmlFor="userSearch">Find a user</label>
              <input id="userSearch" name="userSearch" type="search" defaultValue={userSearch} placeholder="Name, email or role" />
            </div>
            <div className="field management-filter-select">
              <label htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue={userRoleFilter}>
                <option value="">All roles</option>
                {management.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}
              </select>
            </div>
            <button className="button button-secondary" type="submit">Filter</button>
            {userSearch || userRoleFilter ? <Link className="button button-secondary button-link" href={`/companies/${company.company_id}/management`}>Clear</Link> : null}
          </form>

          <div className="management-result-line">
            <strong>{filteredUsers.length}</strong>
            <span className="muted">of {management.users.length} users</span>
          </div>

          <div className="management-record-list management-user-list">
            <div className="management-record-header management-user-grid" aria-hidden="true">
              <span>User</span><span>Role</span><span>Manager</span><span>Approval</span><span>Access</span><span />
            </div>
            {filteredUsers.map((user) => {
              const manager = user.manager_user_id === null ? null : usersById.get(user.manager_user_id);
              const selectedRoleId = user.roles[0]?.role_id;
              return (
                <details className="management-record" key={user.user_id}>
                  <summary className="management-record-summary management-user-grid">
                    <span className="management-record-identity">
                      <strong>{userName(user)}</strong>
                      <small>{user.email}</small>
                      {user.is_company_admin ? <span className="badge badge-ok">Company admin</span> : null}
                    </span>
                    <span className="management-record-cell" data-label="Role">{user.roles.length ? user.roles.map((role) => role.name).join(", ") : "No role"}</span>
                    <span className="management-record-cell" data-label="Manager">{manager ? userName(manager) : user.manager_user_id === null ? "—" : `User #${user.manager_user_id}`}</span>
                    <span className="management-record-cell" data-label="Approval"><span className="badge badge-neutral">{approvalSummary(user)}</span></span>
                    <span className="management-record-cell" data-label="Access"><CapabilityPills user={user} /></span>
                    <span className="management-record-action">Manage <span aria-hidden="true">›</span></span>
                  </summary>

                  <div className="management-record-body">
                    <div className="management-record-body-heading">
                      <div><p className="eyebrow">Edit user</p><h3>{userName(user)}</h3></div>
                      <span className="muted small-text">Customer #{user.customer_id} · Company user #{user.user_id}</span>
                    </div>
                    <div className="management-editor-layout">
                      <form action={updateCompanyUserAction} className="management-user-form management-edit-form">
                        <input name="companyId" type="hidden" value={company.company_id} />
                        <input name="userId" type="hidden" value={user.user_id} />
                        <input name="returnView" type="hidden" value="users" />
                        <div className="field">
                          <label>Role</label>
                          <select name="roleId" required defaultValue={selectedRoleId ?? ""}>
                            <option value="" disabled>Select role</option>
                            {management.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.name}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>Manager</label>
                          <select name="managerId" defaultValue={user.manager_user_id ?? ""}>
                            <option value="">No manager</option>
                            {management.users.filter((candidate) => candidate.user_id !== user.user_id).map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{userName(candidate)}</option>)}
                          </select>
                        </div>
                        <div className="field">
                          <label>Approval type</label>
                          <ApprovalTypeSelect defaultValue={user.approval_type} />
                        </div>
                        <div className="field">
                          <label>Approval threshold</label>
                          <input name="approvalThreshold" type="number" min="0" step="0.01" defaultValue={user.approval_threshold ?? ""} />
                        </div>
                        <div className="management-form-actions"><button className="button" type="submit">Save user</button></div>
                      </form>

                      <aside className="management-editor-aside">
                        <div>
                          <p className="eyebrow">Effective access</p>
                          <div className="management-pill-row management-pill-row-spaced"><CapabilityPills user={user} /></div>
                        </div>
                        {!user.is_company_admin ? (
                          <details className="management-danger-disclosure">
                            <summary>Remove from company</summary>
                            <form action={removeCompanyUserAction} className="danger-zone compact-form">
                              <input name="companyId" type="hidden" value={company.company_id} />
                              <input name="userId" type="hidden" value={user.user_id} />
                              <input name="expectedEmail" type="hidden" value={user.email} />
                              <input name="returnView" type="hidden" value="users" />
                              <div className="field"><label>Type {user.email} to confirm</label><input name="confirmEmail" autoComplete="off" required /></div>
                              <button className="button button-danger" type="submit">Remove user</button>
                            </form>
                          </details>
                        ) : <p className="muted small-text">Company administrators are protected from removal by Fluid.</p>}
                      </aside>
                    </div>
                  </div>
                </details>
              );
            })}
            {!filteredUsers.length ? <div className="card management-empty-state"><strong>No users match these filters.</strong><span>Clear the search or choose a different role.</span></div> : null}
          </div>
        </section>
      ) : (
        <section className="stack management-view">
          <div className="management-view-heading">
            <div>
              <p className="eyebrow">Access control</p>
              <h2>Company roles</h2>
              <p className="muted">{management.roles.length} roles · {roleInUseCount} currently assigned · {assignableResourceCount} assignable Fluid permissions</p>
            </div>
            <details className="management-create-panel management-create-inline">
              <summary><span><strong>Create role</strong><small>Build from Fluid permissions</small></span></summary>
              <form action={saveCompanyRoleAction} className="management-panel-body stack">
                <input name="companyId" type="hidden" value={company.company_id} />
                <input name="returnView" type="hidden" value="roles" />
                <div className="form-grid">
                  <div className="field"><label htmlFor="roleName">Role name</label><input id="roleName" name="name" required /></div>
                  <div className="field"><label htmlFor="roleSort">Sort order</label><input id="roleSort" name="sortOrder" type="number" /></div>
                </div>
                <CompanyPermissionPicker resources={management.resources} label="Role permissions" />
                <div><button className="button" type="submit">Create role</button></div>
              </form>
            </details>
          </div>

          <form className="card management-filter-bar management-role-filter" method="get">
            <input name="view" type="hidden" value="roles" />
            <div className="field grow">
              <label htmlFor="roleSearch">Find a role</label>
              <input id="roleSearch" name="roleSearch" type="search" defaultValue={roleSearch} placeholder="Role name or permission" />
            </div>
            <button className="button button-secondary" type="submit">Search</button>
            {roleSearch ? <Link className="button button-secondary button-link" href={`/companies/${company.company_id}/management?view=roles`}>Clear</Link> : null}
          </form>

          <div className="management-result-line">
            <strong>{filteredRoles.length}</strong>
            <span className="muted">of {management.roles.length} roles</span>
          </div>

          <div className="management-record-list management-role-list">
            <div className="management-record-header management-role-grid" aria-hidden="true">
              <span>Role</span><span>Users</span><span>Sort</span><span>Permissions</span><span />
            </div>
            {filteredRoles.map((role) => {
              const permissionCount = rolePermissionCount(role, assignableResourceIds);
              const permissionPaths = role.allowed_resources.map((resourceId) => resourcePaths.get(resourceId) ?? resourceId);
              return (
                <details className="management-record" key={role.role_id}>
                  <summary className="management-record-summary management-role-grid">
                    <span className="management-record-identity">
                      <strong>{role.name}</strong>
                      <span className={`badge ${role.manageable ? "badge-ok" : "badge-neutral"}`}>{role.manageable ? "Manageable" : "Protected"}</span>
                    </span>
                    <span className="management-record-cell" data-label="Users"><strong>{role.user_count}</strong></span>
                    <span className="management-record-cell" data-label="Sort">{role.sort_order}</span>
                    <span className="management-record-cell" data-label="Permissions"><strong>{permissionCount}</strong> <span className="muted small-text">assignable selected</span></span>
                    <span className="management-record-action">{role.manageable ? "Manage" : "View"} <span aria-hidden="true">›</span></span>
                  </summary>

                  <div className="management-record-body">
                    <div className="management-record-body-heading">
                      <div><p className="eyebrow">{role.manageable ? "Edit role" : "Protected role"}</p><h3>{role.name}</h3></div>
                      <span className="muted small-text">Role #{role.role_id} · {role.user_count} user{role.user_count === 1 ? "" : "s"}</span>
                    </div>

                    {role.manageable ? (
                      <div className="stack">
                        <form action={saveCompanyRoleAction} className="stack management-role-editor">
                          <input name="companyId" type="hidden" value={company.company_id} />
                          <input name="roleId" type="hidden" value={role.role_id} />
                          <input name="returnView" type="hidden" value="roles" />
                          <div className="form-grid">
                            <div className="field"><label>Name</label><input name="name" defaultValue={role.name} required /></div>
                            <div className="field"><label>Sort order</label><input name="sortOrder" type="number" defaultValue={role.sort_order} /></div>
                          </div>
                          <CompanyPermissionPicker resources={management.resources} selectedResourceIds={role.allowed_resources} label={`${role.name} permissions`} />
                          <div className="management-form-actions"><button className="button" type="submit">Save role</button></div>
                        </form>

                        <details className="management-danger-disclosure management-role-danger">
                          <summary>Delete role</summary>
                          <form action={deleteCompanyRoleAction} className="danger-zone compact-form">
                            <input name="companyId" type="hidden" value={company.company_id} />
                            <input name="roleId" type="hidden" value={role.role_id} />
                            <input name="expectedName" type="hidden" value={role.name} />
                            <input name="returnView" type="hidden" value="roles" />
                            <div className="field"><label>Type {role.name} to confirm</label><input name="confirmName" autoComplete="off" required /></div>
                            <button className="button button-danger" type="submit" disabled={role.user_count > 0}>Delete role</button>
                            {role.user_count > 0 ? <p className="muted small-text">Fluid only deletes unused roles; move the {role.user_count} assigned user{role.user_count === 1 ? "" : "s"} first.</p> : null}
                          </form>
                        </details>
                      </div>
                    ) : (
                      <div className="management-protected-role">
                        <p className="muted">Fluid marks this role as protected. Its permissions are shown for reference and cannot be edited here.</p>
                        {permissionPaths.length ? <ul className="management-permission-list">{permissionPaths.map((path) => <li key={path}>{path}</li>)}</ul> : <p className="muted small-text">No explicit resources were returned.</p>}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
            {!filteredRoles.length ? <div className="card management-empty-state"><strong>No roles match this search.</strong><span>Try a role name or a permission title.</span></div> : null}
          </div>
        </section>
      )}
    </div>
  );
}
