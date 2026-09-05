import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import {
  getCompanyManagement,
  type CompanyAdminUser,
  type CompanyManagement,
} from "@/lib/graphql/company-management";
import { graphQLErrorMessage } from "@/lib/graphql/client";

function userName(user: Pick<CompanyAdminUser, "firstname" | "lastname">) {
  return `${user.firstname} ${user.lastname}`.trim();
}

function approvalSummary(user: CompanyAdminUser) {
  const threshold = user.approval_threshold === null ? "" : ` · threshold ${user.approval_threshold}`;
  return `${user.approval_type}${threshold}`;
}

async function loadManagement(companyId: number) {
  try {
    const [company, management] = await Promise.all([
      getCompany(companyId),
      getCompanyManagement(companyId),
    ]);

    return { company, management, error: null };
  } catch (error) {
    return { company: null, management: null, error: graphQLErrorMessage(error) };
  }
}

function ManagementStats({ management }: { management: CompanyManagement }) {
  const assignableResources = management.resources.filter((resource) => resource.assignable).length;

  return (
    <div className="stat-grid">
      <div className="stat-card">
        <span className="stat-value">{management.users.length}</span>
        <span className="stat-label">Company users</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{management.roles.length}</span>
        <span className="stat-label">Roles</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{assignableResources}</span>
        <span className="stat-label">Assignable resources</span>
      </div>
    </div>
  );
}

export default async function CompanyManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyId = Number(id);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    notFound();
  }

  const { company, management, error } = await loadManagement(companyId);

  if (!company || !management) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company detail</Link></div>
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Company management unavailable</h1>
          </div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const usersById = new Map(management.users.map((user) => [user.user_id, user]));
  const resourcesById = new Map(management.resources.map((resource) => [resource.resource_id, resource]));

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link>
        <span aria-hidden="true">/</span>
        <span>Management</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>Company management</h1>
          <p className="muted">Users, roles and company ACL resources returned by the Fluid backend for {company.name}.</p>
        </div>
      </header>

      <ManagementStats management={management} />

      <section className="stack">
        <div className="section-heading">
          <div>
            <h2>Users</h2>
            <p className="muted">Company membership, assigned roles and approval capabilities are backend-authoritative.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Roles</th>
                <th>Manager</th>
                <th>Approval</th>
                <th>Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {management.users.map((user) => {
                const manager = user.manager_user_id === null ? null : usersById.get(user.manager_user_id);

                return (
                  <tr key={user.user_id}>
                    <td>
                      <div className="cell-stack">
                        <strong>{userName(user)}</strong>
                        <span className="muted small-text">{user.email}</span>
                        <span className="muted small-text">User #{user.user_id} · Customer #{user.customer_id}</span>
                        {user.is_company_admin ? <span className="badge badge-ok">Company admin</span> : null}
                      </div>
                    </td>
                    <td>{user.roles.length ? user.roles.map((role) => role.name).join(", ") : "No assigned role"}</td>
                    <td>{manager ? userName(manager) : user.manager_user_id === null ? "—" : `User #${user.manager_user_id}`}</td>
                    <td>{approvalSummary(user)}</td>
                    <td>
                      <div className="capability-list">
                        <span>{user.can_checkout ? "✓" : "—"} Checkout</span>
                        <span>{user.can_approve_credit_orders ? "✓" : "—"} Credit approval</span>
                        <span>{user.can_auto_approve_credit_order ? "✓" : "—"} Auto-approve</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {management.users.length === 0 ? (
                <tr><td colSpan={5}>No company users were returned for this company.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <div className="section-heading">
          <div>
            <h2>Roles</h2>
            <p className="muted">Role manageability and allowed resources come directly from Fluid company administration.</p>
          </div>
        </div>

        <div className="grid">
          {management.roles.map((role) => (
            <article className="card stack" key={role.role_id}>
              <div className="card-heading-row">
                <div>
                  <p className="eyebrow">Role {role.role_id}</p>
                  <h3>{role.name}</h3>
                </div>
                <span className={`badge ${role.manageable ? "badge-ok" : "badge-neutral"}`}>
                  {role.manageable ? "Manageable" : "Protected"}
                </span>
              </div>
              <dl className="mini-detail-list">
                <dt>Users</dt><dd>{role.user_count}</dd>
                <dt>Sort order</dt><dd>{role.sort_order}</dd>
                <dt>Resources</dt><dd>{role.allowed_resources.length}</dd>
              </dl>
              <details className="resource-details">
                <summary>View assigned resources</summary>
                {role.allowed_resources.length ? (
                  <ul className="compact-list">
                    {role.allowed_resources.map((resourceId) => (
                      <li key={resourceId}>{resourcesById.get(resourceId)?.title ?? resourceId}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small-text">No explicit resources returned for this role.</p>
                )}
              </details>
            </article>
          ))}
          {management.roles.length === 0 ? <div className="card muted">No roles were returned for this company.</div> : null}
        </div>
      </section>

      <section className="stack">
        <div className="section-heading">
          <div>
            <h2>Resource tree</h2>
            <p className="muted">The hierarchy below is descriptive only; the app does not calculate or expand backend permissions.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>ID</th>
                <th>Assignable</th>
                <th>Assigned roles</th>
              </tr>
            </thead>
            <tbody>
              {management.resources.map((resource) => {
                const assignedRoles = management.roles.filter((role) => role.allowed_resources.includes(resource.resource_id));

                return (
                  <tr key={resource.resource_id}>
                    <td>
                      <div className="resource-title" style={{ paddingLeft: `${resource.depth * 1.1}rem` }}>
                        {resource.depth > 0 ? <span aria-hidden="true">↳ </span> : null}
                        <strong>{resource.title}</strong>
                      </div>
                    </td>
                    <td><code>{resource.resource_id}</code></td>
                    <td>
                      <span className={`badge ${resource.assignable ? "badge-ok" : "badge-neutral"}`}>
                        {resource.assignable ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>{assignedRoles.length ? assignedRoles.map((role) => role.name).join(", ") : "—"}</td>
                  </tr>
                );
              })}
              {management.resources.length === 0 ? (
                <tr><td colSpan={4}>No company ACL resources were returned.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
