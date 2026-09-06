import Link from "next/link";
import { notFound } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyManagement, type CompanyAdminUser } from "@/lib/graphql/company-management";
import { getAdminCreditOrder } from "@/lib/graphql/admin-credit-orders";
import styles from "@/components/credit-orders-workspace.module.css";
import {
  addCreditOrderCommentAction,
  approveCreditOrderAction,
  cancelCreditOrderAction,
  placeCreditOrderAction,
  rejectCreditOrderAction,
} from "../actions";

type DetailView = "overview" | "conversation" | "history";

function parsePositiveInt(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseView(value?: string): DetailView {
  return value === "conversation" || value === "history" ? value : "overview";
}

function label(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) : "—";
}

function formatTotal(value: number) {
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function userLabel(user: CompanyAdminUser) {
  const name = `${user.firstname} ${user.lastname}`.trim();
  return `${name || user.email} (${user.email})`;
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

function detailHref(companyId: number, number: string, actor: number | null, view: DetailView) {
  const params = new URLSearchParams();
  if (actor) params.set("actor", String(actor));
  if (view !== "overview") params.set("view", view);
  const query = params.toString();
  return `/companies/${companyId}/credit-orders/${encodeURIComponent(number)}${query ? `?${query}` : ""}`;
}

async function load(companyId: number, number: string, actor: number | null) {
  try {
    const [company, management, order] = await Promise.all([
      getCompany(companyId),
      getCompanyManagement(companyId),
      getAdminCreditOrder(companyId, number, actor),
    ]);
    return { company, management, order, error: null };
  } catch (error) {
    return { company: null, management: null, order: null, error: graphQLErrorMessage(error) };
  }
}

function HiddenContext({
  companyId,
  number,
  actor,
  returnView,
}: {
  companyId: number;
  number: string;
  actor: number;
  returnView: DetailView;
}) {
  return (
    <>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="actorCompanyUserId" value={actor} />
      <input type="hidden" name="returnView" value={returnView} />
    </>
  );
}

export default async function AdminCreditOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; number: string }>;
  searchParams: Promise<{ actor?: string; view?: string; notice?: string; error?: string }>;
}) {
  const route = await params;
  const query = await searchParams;
  const companyId = Number(route.id);
  if (!Number.isInteger(companyId) || companyId <= 0 || !route.number) notFound();

  const actor = parsePositiveInt(query.actor);
  const view = parseView(query.view);
  const { company, management, order, error } = await load(companyId, route.number, actor);

  if (!company || !management || !order) {
    return <div className="stack"><div><Link className="back-link" href={`/companies/${companyId}/credit-orders`}>← Credit orders</Link></div><section className="card stack"><p className="eyebrow">Backend request failed</p><h1>Credit order unavailable</h1><div className="error">{error}</div></section></div>;
  }

  const selectedActor = actor ? management.users.find((user) => user.user_id === actor) ?? null : null;
  const actorById = new Map(management.users.map((user) => [user.user_id, user]));
  const actorText = (userId: number | null) => userId
    ? (actorById.get(userId) ? userLabel(actorById.get(userId)!) : `Company user ${userId}`)
    : "System / unknown";
  const creatorName = `${order.creator.firstname ?? ""} ${order.creator.lastname ?? ""}`.trim();
  const creatorText = creatorName || order.creator.email || actorText(order.creator.company_user_id);
  const actions = order.actions;
  const orderItems = order.items ?? [];
  const queueParams = new URLSearchParams();
  if (actor) queueParams.set("actor", String(actor));
  const queueQuery = queueParams.toString();

  return (
    <div className={styles.page}>
      <header className={styles.detailHeader}>
        <div><Link className={styles.backLink} href={`/companies/${companyId}/credit-orders${queueQuery ? `?${queueQuery}` : ""}`}>← Credit orders</Link></div>
        <div className={styles.detailHeaderTop}>
          <div>
            <p className="eyebrow">Credit order #{order.credit_order_id}</p>
            <h1>{order.number}</h1>
            <p className="muted">Review the order, conversation and Fluid lifecycle without leaving the company workspace.</p>
          </div>
          <span className={statusClass(order.status)}>{label(order.status)}</span>
        </div>
      </header>

      {query.notice ? <div className="success">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}

      <section className={styles.hero}>
        <div className={styles.heroCell}><span className={styles.heroLabel}>Grand total</span><strong className={styles.heroTotal}>{formatTotal(order.grand_total)}</strong></div>
        <div className={styles.heroCell}><span className={styles.heroLabel}>Creator</span><span className={styles.heroValue}>{creatorText}</span><span className={styles.subtle}>{order.creator.email || `Company user ${order.creator.company_user_id}`}</span></div>
        <div className={styles.heroCell}><span className={styles.heroLabel}>Purchase order</span><span className={styles.heroValue}>{order.purchase_order_number || "—"}</span></div>
        <div className={styles.heroCell}><span className={styles.heroLabel}>Sales order</span><span className={styles.heroValue}>{order.order_number || "Not placed"}</span></div>
      </section>

      <nav className={styles.tabs} aria-label="Credit order views">
        <Link className={`${styles.tab} ${view === "overview" ? styles.tabActive : ""}`} href={detailHref(companyId, order.number, actor, "overview")}>Overview</Link>
        <Link className={`${styles.tab} ${view === "conversation" ? styles.tabActive : ""}`} href={detailHref(companyId, order.number, actor, "conversation")}>Conversation <span className={styles.countBadge}>{order.comments.length}</span></Link>
        <Link className={`${styles.tab} ${view === "history" ? styles.tabActive : ""}`} href={detailHref(companyId, order.number, actor, "history")}>History <span className={styles.countBadge}>{order.logs.length}</span></Link>
      </nav>

      <section className={styles.actorPanel}>
        <div className={styles.actorPanelText}>
          <strong>{selectedActor ? `Acting as ${userLabel(selectedActor)}` : "Read-only order view"}</strong>
          <span className="muted">Selecting a company user asks Fluid to resolve that real user&apos;s permissions; it never bypasses authorization.</span>
        </div>
        <form method="get" className={styles.actorForm}>
          <input type="hidden" name="view" value={view} />
          <label>Acting company user
            <select name="actor" defaultValue={actor ? String(actor) : ""}>
              <option value="">Read only — no actor</option>
              {management.users.map((user) => <option key={user.user_id} value={user.user_id}>{userLabel(user)}</option>)}
            </select>
          </label>
          <button type="submit">Use actor</button>
        </form>
      </section>

      {view === "overview" ? (
        <>
          <div className={styles.contentGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><h2>Order state</h2><p className="muted">Values returned by Fluid for this credit order.</p></div>
                {order.auto_approved ? <span className={styles.actorBadge}>Auto-approved</span> : null}
              </div>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}><span className={styles.detailLabel}>Status</span><span className={styles.detailValue}>{label(order.status)}</span></div>
                <div className={styles.detailItem}><span className={styles.detailLabel}>Approved by</span><span className={styles.detailValue}>{order.approved_by.length ? order.approved_by.map(actorText).join(", ") : "—"}</span></div>
                <div className={styles.detailItem}><span className={styles.detailLabel}>Shipping method</span><span className={styles.detailValue}>{order.shipping_method || "—"}</span></div>
                <div className={styles.detailItem}><span className={styles.detailLabel}>Payment method</span><span className={styles.detailValue}>{order.payment_method || "—"}</span></div>
                <div className={styles.detailItem}><span className={styles.detailLabel}>Created</span><span className={styles.detailValue}>{formatDate(order.created_at)}</span></div>
                <div className={styles.detailItem}><span className={styles.detailLabel}>Updated</span><span className={styles.detailValue}>{formatDate(order.updated_at)}</span></div>
              </div>
              {actions?.requires_payment_details ? (
                <div className={styles.warning}>Payment details are required before this credit order can become a sales order. The Admin API does not bypass the customer payment-details flow.</div>
              ) : null}
            </section>

            <aside className={styles.panel}>
              <div><h2>Authorized actions</h2><p className="muted">Only actions explicitly returned by Fluid for the selected actor are shown.</p></div>
              {!actor ? <p className="muted">Select an acting company user above to resolve lifecycle actions.</p> : null}
              {actor && actions ? (
                <div className={styles.actionStack}>
                  {actions.can_approve ? (
                    <details className={styles.actionDisclosure}>
                      <summary><span>Approve order</span><span>＋</span></summary>
                      <form className={styles.actionForm} action={approveCreditOrderAction}>
                        <HiddenContext companyId={companyId} number={order.number} actor={actor} returnView="overview" />
                        <label>Optional comment<textarea name="comment" rows={3} /></label>
                        <button type="submit">Approve credit order</button>
                      </form>
                    </details>
                  ) : null}
                  {actions.can_reject ? (
                    <details className={styles.actionDisclosure}>
                      <summary><span>Reject order</span><span>＋</span></summary>
                      <form className={styles.actionForm} action={rejectCreditOrderAction}>
                        <HiddenContext companyId={companyId} number={order.number} actor={actor} returnView="overview" />
                        <label>Optional comment<textarea name="comment" rows={3} /></label>
                        <label>Type {order.number} to confirm<input name="confirmNumber" required /></label>
                        <button className={styles.dangerButton} type="submit">Reject credit order</button>
                      </form>
                    </details>
                  ) : null}
                  {actions.can_cancel ? (
                    <details className={styles.actionDisclosure}>
                      <summary><span>Cancel order</span><span>＋</span></summary>
                      <form className={styles.actionForm} action={cancelCreditOrderAction}>
                        <HiddenContext companyId={companyId} number={order.number} actor={actor} returnView="overview" />
                        <label>Optional comment<textarea name="comment" rows={3} /></label>
                        <label>Type {order.number} to confirm<input name="confirmNumber" required /></label>
                        <button className={styles.dangerButton} type="submit">Cancel credit order</button>
                      </form>
                    </details>
                  ) : null}
                  {actions.can_place_order ? (
                    <details className={styles.actionDisclosure}>
                      <summary><span>Place sales order</span><span>＋</span></summary>
                      <form className={styles.actionForm} action={placeCreditOrderAction}>
                        <HiddenContext companyId={companyId} number={order.number} actor={actor} returnView="overview" />
                        <p className="muted">Fluid will create the Magento sales order only when this credit order is ready.</p>
                        <label>Optional comment<textarea name="comment" rows={3} /></label>
                        <label>Type {order.number} to confirm<input name="confirmNumber" required /></label>
                        <button type="submit">Place sales order</button>
                      </form>
                    </details>
                  ) : null}
                  {![actions.can_approve, actions.can_reject, actions.can_cancel, actions.can_place_order].some(Boolean) ? <p className="muted">Fluid reports no lifecycle action for this actor in the current state.</p> : null}
                </div>
              ) : null}
            </aside>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Items ordered</h2>
                <p className="muted">Frozen quote lines captured by Fluid when the credit order was created.</p>
              </div>
              <span className={styles.countBadge}>{orderItems.length}</span>
            </div>
            {orderItems.length === 0 ? (
              <p className="muted">No visible quote items were returned for this credit order.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item) => (
                      <tr key={item.item_id || `${item.sku}-${item.product_id ?? "item"}`}>
                        <td><strong>{item.name}</strong></td>
                        <td>{item.sku}</td>
                        <td>{formatQuantity(item.quantity)}</td>
                        <td>{formatTotal(item.unit_price)}</td>
                        <td><strong>{formatTotal(item.row_total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted">Line totals come from the frozen quote rows. The order grand total can also include shipping, tax or other quote totals.</p>
          </section>
        </>
      ) : null}

      {view === "conversation" ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Conversation</h2><p className="muted">Comments are shown oldest first, exactly as returned by Fluid.</p></div></div>
          {actor && actions?.can_add_comment ? (
            <form className={styles.commentForm} action={addCreditOrderCommentAction}>
              <HiddenContext companyId={companyId} number={order.number} actor={actor} returnView="conversation" />
              <label>Add comment<textarea name="comment" rows={4} required placeholder="Add an audit-safe comment…" /></label>
              <div><button type="submit">Add comment</button></div>
            </form>
          ) : (
            <p className="muted">{actor ? "Fluid does not allow this actor to add a comment in the current state." : "Select an acting company user to resolve comment permission."}</p>
          )}
          {order.comments.length === 0 ? <p className="muted">No comments have been added.</p> : (
            <div className={styles.timeline}>
              {order.comments.map((comment) => (
                <article className={styles.timelineItem} key={comment.comment_id}>
                  <div className={styles.timelineMeta}>{formatDate(comment.created_at)}</div>
                  <div className={styles.timelineBody}><strong>{actorText(comment.creator_company_user_id)}</strong><p>{comment.comment}</p></div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {view === "history" ? (
        <section className={styles.panel}>
          <div><h2>Lifecycle history</h2><p className="muted">Fluid lifecycle entries only; the Admin app does not infer missing transitions.</p></div>
          {order.logs.length === 0 ? <p className="muted">No lifecycle log entries.</p> : (
            <div className={styles.timeline}>
              {order.logs.map((log) => (
                <article className={styles.timelineItem} key={log.log_id}>
                  <div className={styles.timelineMeta}>{formatDate(log.created_at)}</div>
                  <div className={styles.timelineBody}>
                    <strong>{label(log.activity_type)}</strong>
                    <span className={styles.subtle}>{actorText(log.actor_company_user_id)}</span>
                    {log.message ? <p>{log.message}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
