import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPortalAdministration,
  getCompanyPortalContext,
  type CompanyPortalAdministration,
  type CompanyPortalContext,
} from "@/lib/graphql/company-portal";
import { selectPortalCompanyAction } from "./actions";

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
  searchParams: Promise<{ error?: string }>;
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

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Company user</p>
          <h1>Company management</h1>
          <p className="muted">
            Fluid company membership and role permissions are authoritative. This portal does not grant Magento-admin privileges.
          </p>
        </div>
      </header>

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
            </dl>
          </section>

          {administration.can_view_users ? (
            <section className="card stack">
              <div>
                <h2>Company users</h2>
                <p className="muted">Read-only validation of the existing customer-side Fluid company-administration contract.</p>
              </div>
              {administration.users.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>User</th><th>Role</th><th>Manager</th><th>Approval</th><th>Capabilities</th></tr>
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
                <p className="muted">Fluid decides which saved roles are manageable and which ACL resources belong to them.</p>
              </div>
              {administration.roles.length ? (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Role</th><th>Users</th><th>Sort</th><th>Resources</th></tr></thead>
                    <tbody>
                      {administration.roles.map((role) => (
                        <tr key={role.role_id}>
                          <td>{role.name}{role.manageable ? "" : " · protected"}</td>
                          <td>{role.user_count}</td>
                          <td>{role.sort_order}</td>
                          <td>{role.allowed_resources.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="muted">No roles returned for this company.</p>}
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
