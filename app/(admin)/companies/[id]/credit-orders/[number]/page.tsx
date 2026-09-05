import Link from "next/link";
import { notFound } from "next/navigation";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompany } from "@/lib/graphql/companies";
import { getCompanyManagement, type CompanyAdminUser } from "@/lib/graphql/company-management";
import { getAdminCreditOrder } from "@/lib/graphql/admin-credit-orders";
import {
  addCreditOrderCommentAction,
  approveCreditOrderAction,
  cancelCreditOrderAction,
  placeCreditOrderAction,
  rejectCreditOrderAction,
} from "../actions";

function parsePositiveInt(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function label(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()) : "—";
}

function formatTotal(value: number) {
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function userLabel(user: CompanyAdminUser) {
  const name = `${user.firstname} ${user.lastname}`.trim();
  return `${name || user.email} (${user.email})`;
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

function HiddenContext({ companyId, number, actor }: { companyId: number; number: string; actor: number }) {
  return <><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="number" value={number} /><input type="hidden" name="actorCompanyUserId" value={actor} /></>;
}

export default async function AdminCreditOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; number: string }>;
  searchParams: Promise<{ actor?: string; notice?: string; error?: string }>;
}) {
  const route = await params;
  const query = await searchParams;
  const companyId = Number(route.id);
  if (!Number.isInteger(companyId) || companyId <= 0 || !route.number) notFound();
  const actor = parsePositiveInt(query.actor);
  const { company, management, order, error } = await load(companyId, route.number, actor);

  if (!company || !management || !order) {
    return <div className="stack"><div><Link className="back-link" href={`/companies/${companyId}/credit-orders`}>← Credit orders</Link></div><section className="card stack"><p className="eyebrow">Backend request failed</p><h1>Credit order unavailable</h1><div className="error">{error}</div></section></div>;
  }

  const selectedActor = actor ? management.users.find((user) => user.user_id === actor) ?? null : null;
  const actorById = new Map(management.users.map((user) => [user.user_id, user]));
  const actorText = (userId: number | null) => userId ? (actorById.get(userId) ? userLabel(actorById.get(userId)!) : `Company user ${userId}`) : "System / unknown";
  const actions = order.actions;

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs"><Link href="/companies">Companies</Link><span>/</span><Link href={`/companies/${companyId}`}>{company.name}</Link><span>/</span><Link href={`/companies/${companyId}/credit-orders`}>Credit orders</Link><span>/</span><span>{order.number}</span></div>

      <header className="page-header"><div><p className="eyebrow">Credit order {order.credit_order_id}</p><h1>{order.number}</h1><p className="muted">Fluid-authorized administrative view and lifecycle controls.</p></div><div className="badge badge-neutral">{label(order.status)}</div></header>
      {query.notice ? <div className="success">{query.notice}</div> : null}
      {query.error ? <div className="error">{query.error}</div> : null}

      <section className="card stack">
        <h2>Order state</h2>
        <dl className="detail-list"><dt>Status</dt><dd>{label(order.status)}</dd><dt>Creator</dt><dd>{order.creator.email || actorText(order.creator.company_user_id)}</dd><dt>Grand total</dt><dd>{formatTotal(order.grand_total)}</dd><dt>Purchase order number</dt><dd>{order.purchase_order_number || "—"}</dd><dt>Shipping method</dt><dd>{order.shipping_method || "—"}</dd><dt>Payment method</dt><dd>{order.payment_method || "—"}</dd><dt>Auto approved</dt><dd>{order.auto_approved ? "Yes" : "No"}</dd><dt>Approved by</dt><dd>{order.approved_by.length ? order.approved_by.map(actorText).join(", ") : "—"}</dd><dt>Sales order</dt><dd>{order.order_number || "—"}</dd><dt>Created</dt><dd>{order.created_at || "—"}</dd><dt>Updated</dt><dd>{order.updated_at || "—"}</dd></dl>
        <p className="muted">The purchase-order number is read-only here because the accepted Magento-admin GraphQL contract does not expose an admin PO-number setter.</p>
      </section>

      <section className="card stack">
        <div><h2>Acting company user</h2><p className="muted">Admin lifecycle mutations require a real company-user actor. Selecting a user only asks Fluid to compute permissions for that actor; it does not bypass authorization.</p></div>
        <form method="get"><label>Actor<select name="actor" defaultValue={actor ? String(actor) : ""}><option value="">Read only — no actor</option>{management.users.map((user) => <option key={user.user_id} value={user.user_id}>{userLabel(user)}</option>)}</select></label><button type="submit">Use actor</button></form>
        {selectedActor ? <p className="muted">Selected: {userLabel(selectedActor)} · Approver capability reported by company management: {selectedActor.can_approve_credit_orders ? "Yes" : "No"}.</p> : null}
      </section>

      {actions?.requires_payment_details ? <div className="error">Payment details are required before this credit order can become a sales order. The Admin API deliberately cannot bypass or resume the customer payment-details flow owned by the creator.</div> : null}

      {actor && actions ? <section className="stack"><div><h2>Authorized actions</h2><p className="muted">Only actions explicitly returned by Fluid for the selected actor are rendered.</p></div><div className="grid">
        {actions.can_approve ? <form className="card stack" action={approveCreditOrderAction}><HiddenContext companyId={companyId} number={order.number} actor={actor} /><h3>Approve</h3><label>Optional comment<textarea name="comment" rows={3} /></label><button type="submit">Approve credit order</button></form> : null}
        {actions.can_reject ? <form className="card stack" action={rejectCreditOrderAction}><HiddenContext companyId={companyId} number={order.number} actor={actor} /><h3>Reject</h3><label>Optional comment<textarea name="comment" rows={3} /></label><label>Type {order.number} to confirm<input name="confirmNumber" required /></label><button type="submit">Reject credit order</button></form> : null}
        {actions.can_cancel ? <form className="card stack" action={cancelCreditOrderAction}><HiddenContext companyId={companyId} number={order.number} actor={actor} /><h3>Cancel</h3><label>Optional comment<textarea name="comment" rows={3} /></label><label>Type {order.number} to confirm<input name="confirmNumber" required /></label><button type="submit">Cancel credit order</button></form> : null}
        {actions.can_place_order ? <form className="card stack" action={placeCreditOrderAction}><HiddenContext companyId={companyId} number={order.number} actor={actor} /><h3>Place sales order</h3><p className="muted">This creates a Magento sales order when Fluid confirms the order is ready.</p><label>Optional comment<textarea name="comment" rows={3} /></label><label>Type {order.number} to confirm<input name="confirmNumber" required /></label><button type="submit">Place sales order</button></form> : null}
      </div>{![actions.can_approve, actions.can_reject, actions.can_cancel, actions.can_place_order].some(Boolean) ? <div className="card muted">Fluid reports no lifecycle action for this actor in the current state.</div> : null}</section> : null}

      {actor && actions?.can_add_comment ? <section className="card stack"><div><h2>Add comment</h2><p className="muted">Comments are written using the selected company-user actor and remain part of the Fluid audit/conversation history.</p></div><form className="stack" action={addCreditOrderCommentAction}><HiddenContext companyId={companyId} number={order.number} actor={actor} /><label>Comment<textarea name="comment" rows={4} required /></label><div><button type="submit">Add comment</button></div></form></section> : null}

      <section className="card stack"><div><h2>Comments</h2><p className="muted">Oldest first, as returned by Fluid.</p></div>{order.comments.length === 0 ? <p className="muted">No comments.</p> : order.comments.map((comment) => <article key={comment.comment_id}><strong>{actorText(comment.creator_company_user_id)}</strong><p>{comment.comment}</p><p className="muted">{comment.created_at || "—"}</p></article>)}</section>

      <section className="card stack"><div><h2>Lifecycle history</h2><p className="muted">Fluid lifecycle log; the Admin app does not infer missing transitions.</p></div>{order.logs.length === 0 ? <p className="muted">No lifecycle log entries.</p> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>Actor</th><th>Activity</th><th>Message</th></tr></thead><tbody>{order.logs.map((log) => <tr key={log.log_id}><td>{log.created_at || "—"}</td><td>{actorText(log.actor_company_user_id)}</td><td>{label(log.activity_type)}</td><td>{log.message || "—"}</td></tr>)}</tbody></table></div>}</section>
    </div>
  );
}
