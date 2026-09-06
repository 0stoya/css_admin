import Link from "next/link";
import { notFound } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyManagement } from "@/lib/graphql/company-management";
import { getAdminCreditOrders } from "@/lib/graphql/admin-credit-orders";
import styles from "@/components/credit-orders-workspace.module.css";

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

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function actorName(firstname: string, lastname: string, email: string) {
  const name = `${firstname} ${lastname}`.trim();
  return name ? `${name} (${email})` : email;
}

function statusClass(status: string) {
  if (status === "pending") return `${styles.statusBadge} ${styles.statusPending}`;
  if (status === "approval_required") return `${styles.statusBadge} ${styles.statusApproval}`;
  if (["approved", "approved_pending_payment", "order_in_progress"].includes(status)) {
    return `${styles.statusBadge} ${styles.statusApproved}`;
  }
  if (status === "order_placed") return `${styles.statusBadge} ${styles.statusComplete}`;
  if (["order_failed", "rejected", "canceled"].includes(status)) {
    return `${styles.statusBadge} ${styles.statusDanger}`;
  }
  return styles.statusBadge;
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

  const selectedActor = actor ? management.users.find((user) => user.user_id === actor) ?? null : null;
  const hasFilters = Boolean(search || status || actor);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className="eyebrow">Credit workflow</p>
          <h1>Credit orders</h1>
          <p className="muted">Review the company queue and use a real company-user actor when Fluid-authorized lifecycle actions are required.</p>
        </div>
        <Link className="button button-secondary button-link" href={`/companies/${companyId}/credit`}>Company credit</Link>
      </header>

      <form method="get" className={styles.toolbar}>
        <label className={styles.field}>
          <span>Find an order</span>
          <input name="search" defaultValue={search} placeholder="Order number" />
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((value) => <option value={value} key={value}>{label(value)}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Acting company user</span>
          <select name="actor" defaultValue={actor ? String(actor) : ""}>
            <option value="">Read only — no actor</option>
            {management.users.map((user) => (
              <option key={user.user_id} value={user.user_id}>{actorName(user.firstname, user.lastname, user.email)}</option>
            ))}
          </select>
        </label>
        <div className={styles.toolbarActions}>
          <button type="submit">Apply</button>
          {hasFilters ? <Link className={styles.resetLink} href={`/companies/${companyId}/credit-orders`}>Reset</Link> : null}
        </div>
      </form>

      <div className={styles.queueSummary}>
        <div className={styles.queueSummaryText}>
          <strong className={styles.queueCount}>{orders.total_count}</strong>
          <span className="muted">matching credit {orders.total_count === 1 ? "order" : "orders"}</span>
          {orders.page_info.total_pages > 1 ? <span className="muted">· Page {orders.page_info.current_page} of {orders.page_info.total_pages}</span> : null}
        </div>
        {selectedActor ? (
          <span className={styles.actorBadge}>Acting as {actorName(selectedActor.firstname, selectedActor.lastname, selectedActor.email)}</span>
        ) : (
          <span className={styles.readOnlyBadge}>Read-only queue</span>
        )}
      </div>

      <section className={styles.queue}>
        {orders.items.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No credit orders found</strong>
            <span>Change the current filters or clear them to review the full queue.</span>
          </div>
        ) : (
          <>
            <div className={styles.queueHeader} aria-hidden="true">
              <span>Order</span><span>Status</span><span>Creator</span><span>Total</span><span>References</span><span>Created</span><span>Actor access</span>
            </div>
            {orders.items.map((order) => {
              const detailParams = new URLSearchParams();
              if (actor) detailParams.set("actor", String(actor));
              const detailQuery = detailParams.toString();
              const actions: string[] = [];
              if (order.actions?.can_approve) actions.push("Approve");
              if (order.actions?.can_reject) actions.push("Reject");
              if (order.actions?.can_cancel) actions.push("Cancel");
              if (order.actions?.can_place_order) actions.push("Place");
              if (order.actions?.can_add_comment) actions.push("Comment");

              return (
                <div className={styles.queueRow} key={order.credit_order_id}>
                  <div className={styles.orderIdentity}>
                    <Link className={styles.orderNumber} href={`/companies/${companyId}/credit-orders/${encodeURIComponent(order.number)}${detailQuery ? `?${detailQuery}` : ""}`}>{order.number}</Link>
                    <span className={styles.subtle}>Credit order #{order.credit_order_id}</span>
                  </div>
                  <div><span className={statusClass(order.status)}>{label(order.status)}</span></div>
                  <div className={styles.customerCell}>
                    <strong>{order.creator.firstname || order.creator.lastname ? `${order.creator.firstname ?? ""} ${order.creator.lastname ?? ""}`.trim() : (order.creator.email || `User ${order.creator.company_user_id}`)}</strong>
                    <span className={styles.subtle}>{order.creator.email || `Company user ${order.creator.company_user_id}`}</span>
                  </div>
                  <div className={styles.total}>{formatTotal(order.grand_total)}</div>
                  <div className={styles.referenceCell}>
                    <span>{order.purchase_order_number || "No PO"}</span>
                    <span className={styles.subtle}>{order.order_number ? `Sales order ${order.order_number}` : "No sales order"}</span>
                  </div>
                  <div className={styles.subtle}>{formatDate(order.created_at)}</div>
                  <div className={styles.actionCell}>
                    {actor ? (
                      actions.length ? <div className={styles.actionPills}>{actions.map((action) => <span className={styles.actionPill} key={action}>{action}</span>)}</div> : <span className={styles.subtle}>No authorized actions</span>
                    ) : <span className={styles.subtle}>Select an actor to resolve actions</span>}
                    <Link className={styles.openLink} href={`/companies/${companyId}/credit-orders/${encodeURIComponent(order.number)}${detailQuery ? `?${detailQuery}` : ""}`}>Open order →</Link>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </section>

      {orders.page_info.total_pages > 1 ? (
        <div className={styles.pagination}>
          {page > 1 ? <Link className="button button-secondary button-link" href={listHref(companyId, page - 1, search, status, actor)}>Previous</Link> : null}
          <span className="muted">Page {page} of {orders.page_info.total_pages}</span>
          {page < orders.page_info.total_pages ? <Link className="button button-secondary button-link" href={listHref(companyId, page + 1, search, status, actor)}>Next</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
