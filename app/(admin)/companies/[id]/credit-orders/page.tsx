import Link from "next/link";
import { notFound } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import { getAdminCreditOrders } from "@/lib/graphql/admin-credit-orders";

const STATUS_OPTIONS = [
  "pending",
  "approval_required",
  "approved",
  "approved_pending_payment",
  "order_in_progress",
  "order_placed",
  "order_failed",
  "rejected",
  "canceled",
];

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function parsePositiveInt(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatTotal(value: number) {
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function actorName(firstname: string, lastname: string, email: string) {
  const name = `${firstname} ${lastname}`.trim();
  return name ? `${name} (${email})` : email;
}

function listHref(companyId: number, page: number, search: string, status: string, actor: number | null) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (actor) params.set("actor", String(actor));
  const query = params.toString();
  return `/companies/${companyId}/credit-orders${query ? `?${query}` : ""}`;
}

async function load(companyId: number, page: number, search: string, status: string, actor: number | null) {
  try {
    const [company, management, orders] = await Promise.all([
      getCompany(companyId),
      getCompanyManagement(companyId),
      getAdminCreditOrders(companyId, page, 20, status ? [status] : [], search, actor),
    ]);
    return { company, management, orders, error: null };
  } catch (error) {
    return { company: null, management: null, orders: null, error: graphQLErrorMessage(error) };
  }
}

export default async function AdminCreditOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string; status?: string; actor?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);
  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const page = Math.max(1, Number(query.page) || 1);
  const search = query.search?.trim() ?? "";
  const status = query.status?.trim() ?? "";
  const actor = parsePositiveInt(query.actor);
  const { company, management, orders, error } = await load(companyId, page, search, status, actor);

  if (!company || !management || !orders) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company detail</Link></div>
        <section className="card stack"><p className="eyebrow">Backend request failed</p><h1>Credit orders unavailable</h1><div className="error">{error}</div></section>
      </div>
    );
  }

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs"><Link href="/companies">Companies</Link><span>/</span><Link href={`/companies/${companyId}`}>{company.name}</Link><span>/</span><span>Credit orders</span></div>

      <header className="page-header"><div><p className="eyebrow">Company {company.company_id}</p><h1>Credit orders</h1><p className="muted">Explicit-company Fluid credit-order queue. Action availability is computed by Fluid for the selected company-user actor.</p></div></header>

      <section className="card stack">
        <form method="get" className="grid">
          <label>Search order number<input name="search" defaultValue={search} placeholder="000000" /></label>
          <label>Status<select name="status" defaultValue={status}><option value="">All statuses</option>{STATUS_OPTIONS.map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label>
          <label>Acting company user<select name="actor" defaultValue={actor ? String(actor) : ""}><option value="">No actor / read only</option>{management.users.map((user) => <option key={user.user_id} value={user.user_id}>{actorName(user.firstname, user.lastname, user.email)}</option>)}</select></label>
          <div><button type="submit">Apply filters</button></div>
        </form>
        <p className="muted">Selecting an actor does not grant permission. Fluid still authorizes every action against that real company user.</p>
      </section>

      <div className="stat-grid"><div className="stat-card"><span className="stat-value">{orders.total_count}</span><span className="stat-label">Credit orders</span></div><div className="stat-card"><span className="stat-value">{orders.page_info.current_page}</span><span className="stat-label">Current page</span></div><div className="stat-card"><span className="stat-value">{orders.page_info.total_pages}</span><span className="stat-label">Total pages</span></div></div>

      <section className="card stack">
        {orders.items.length === 0 ? <p className="muted">No credit orders match the current filters.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Number</th><th>Status</th><th>Creator</th><th>Total</th><th>PO</th><th>Sales order</th><th>Created</th><th>Actor actions</th></tr></thead><tbody>{orders.items.map((order) => {
            const detailParams = new URLSearchParams();
            if (actor) detailParams.set("actor", String(actor));
            const actionNames = order.actions ? [order.actions.can_approve && "Approve", order.actions.can_reject && "Reject", order.actions.can_cancel && "Cancel", order.actions.can_place_order && "Place", order.actions.can_add_comment && "Comment"].filter(Boolean) : [];
            return <tr key={order.credit_order_id}><td><Link href={`/companies/${companyId}/credit-orders/${encodeURIComponent(order.number)}${detailParams.toString() ? `?${detailParams.toString()}` : ""}`}>{order.number}</Link></td><td>{label(order.status)}</td><td>{order.creator.email || `User ${order.creator.company_user_id}`}</td><td>{formatTotal(order.grand_total)}</td><td>{order.purchase_order_number || "—"}</td><td>{order.order_number || "—"}</td><td>{order.created_at || "—"}</td><td>{actor ? (actionNames.length ? actionNames.join(", ") : "No authorized actions") : "Select actor"}</td></tr>;
          })}</tbody></table></div>
        )}
      </section>

      {orders.page_info.total_pages > 1 ? <div className="pagination">{page > 1 ? <Link className="button button-link" href={listHref(companyId, page - 1, search, status, actor)}>Previous</Link> : null}<span className="muted">Page {page} of {orders.page_info.total_pages}</span>{page < orders.page_info.total_pages ? <Link className="button button-link" href={listHref(companyId, page + 1, search, status, actor)}>Next</Link> : null}</div> : null}
    </div>
  );
}
