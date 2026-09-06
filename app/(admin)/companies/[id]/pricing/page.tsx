import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyPrices, getCompanyPricingStatus } from "@/lib/graphql/company-pricing";
import styles from "@/components/company-pricing-workspace.module.css";

const PAGE_SIZE = 20;

function formatAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function pageHref(companyId: number, page: number, search: string) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/companies/${companyId}/pricing${query ? `?${query}` : ""}`;
}

async function loadPricing(companyId: number, page: number, search: string) {
  try {
    const [company, status, prices] = await Promise.all([
      getCompany(companyId),
      getCompanyPricingStatus(companyId),
      getCompanyPrices(companyId, page, PAGE_SIZE, search),
    ]);

    return { company, status, prices, error: null };
  } catch (error) {
    return {
      company: null,
      status: null,
      prices: null,
      error: graphQLErrorMessage(error),
    };
  }
}

export default async function CompanyPricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);
  const requestedPage = Number(query.page ?? "1");
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const search = query.q?.trim() ?? "";

  if (!Number.isInteger(companyId) || companyId <= 0) notFound();

  const { company, status, prices, error } = await loadPricing(companyId, currentPage, search);

  if (!company || !status || !prices) {
    return (
      <div className="stack">
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Company pricing unavailable</h1>
          </div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const hasPreviousPage = prices.page_info.current_page > 1;
  const hasNextPage = prices.page_info.current_page < prices.page_info.total_pages;
  const pricingSource = status.has_custom_prices ? "OGL custom pricing" : "Magento pricing";
  const sourceDescription = status.has_custom_prices
    ? `${status.custom_price_count} company-specific price row${status.custom_price_count === 1 ? "" : "s"} currently override Magento catalogue pricing.`
    : "No company-specific OGL price rows are active, so Magento catalogue pricing remains in effect.";
  const safeProgress = Math.min(100, Math.max(0, status.import_percentage));

  return (
    <div className={styles.workspace}>
      <header className="page-header">
        <div>
          <p className="eyebrow">Company pricing</p>
          <h1>Pricing</h1>
          <p className="muted">Company-specific OGL prices and import health returned directly by Fluid.</p>
        </div>
        <span className={`badge ${status.has_custom_prices ? "badge-ok" : "badge-neutral"} ${styles.headerBadge}`}>
          {pricingSource}
        </span>
      </header>

      <section className={`card ${styles.summaryCard}`}>
        <div className={styles.summaryHeading}>
          <div>
            <p className="eyebrow">Pricing source</p>
            <h2>{pricingSource}</h2>
            <p className="muted">{sourceDescription}</p>
          </div>
          <span className={`badge ${status.sync_enabled ? "badge-ok" : "badge-neutral"}`}>
            OGL sync {status.sync_enabled ? "enabled" : "disabled"}
          </span>
        </div>

        <div className={styles.metricGrid}>
          <div className={styles.metric}>
            <span>Company reference</span>
            <strong>{status.cref || "—"}</strong>
          </div>
          <div className={styles.metric}>
            <span>Custom price rows</span>
            <strong>{status.custom_price_count}</strong>
          </div>
          <div className={styles.metric}>
            <span>Last imported</span>
            <strong>{formatDate(status.last_imported_at)}</strong>
          </div>
          <div className={styles.metric}>
            <span>Currency</span>
            <strong>{status.currency}</strong>
          </div>
        </div>

        <div className={styles.progressBlock}>
          <div className={styles.progressHeading}>
            <span>Import status · {formatStatus(status.import_status)}</span>
            <strong>{status.import_percentage}%</strong>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${safeProgress}%` }} />
          </div>
          <p className={styles.statusMessage}>
            {status.status_message} · Company {status.company_active ? "active" : "inactive"}
          </p>
        </div>
      </section>

      <section className={`card ${styles.priceCard}`}>
        <div className={styles.priceHeader}>
          <div className={styles.priceHeaderText}>
            <p className="eyebrow">Imported OGL prices</p>
            <h2>Company-specific prices</h2>
            <p className="muted">Search the imported company price rows by SKU. Tier breaks are shown exactly as Fluid returns them.</p>
          </div>
          <span className="badge badge-neutral">
            {prices.total_count} row{prices.total_count === 1 ? "" : "s"}
          </span>
        </div>

        <form className={styles.searchBar} method="get">
          <label>
            Find a price
            <input name="q" defaultValue={search} placeholder="Search SKU" />
          </label>
          <button type="submit">Search</button>
        </form>

        {prices.items.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>{search ? "No matching price" : "No OGL custom prices"}</h2>
            <p className="muted">
              {search
                ? `No imported company price matched “${search}”.`
                : "Fluid returned no company-specific OGL price rows for this company. Magento pricing remains authoritative."}
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.priceTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Company price</th>
                  <th>Tier pricing</th>
                </tr>
              </thead>
              <tbody>
                {prices.items.map((item) => (
                  <tr key={item.sku}>
                    <td>
                      <div className={styles.productCell}>
                        <strong>{item.product_name || "Magento product unavailable"}</strong>
                        {item.product_id ? (
                          <span className="muted">Product #{item.product_id}</span>
                        ) : (
                          <span className={styles.missingProduct}>Imported row retained without a current Magento product</span>
                        )}
                      </div>
                    </td>
                    <td><span className={styles.sku}>{item.sku}</span></td>
                    <td><span className={styles.priceValue}>{formatAmount(item.price, status.currency)}</span></td>
                    <td>
                      {item.tier_prices.length === 0 ? (
                        <span className="muted">No tier breaks</span>
                      ) : (
                        <div className={styles.tierList}>
                          {item.tier_prices.map((tier, index) => (
                            <span className={styles.tierBadge} key={`${item.sku}-${tier.quantity}-${index}`}>
                              {tier.quantity}+ · {formatAmount(tier.price, status.currency)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <p className="muted">
            Page {prices.page_info.current_page} of {Math.max(prices.page_info.total_pages, 1)}
            {search ? ` · Filtered by “${search}”` : ""}
          </p>
          <div className={styles.paginationActions}>
            {hasPreviousPage ? (
              <Link className="button button-secondary button-link" href={pageHref(companyId, prices.page_info.current_page - 1, search)}>
                Previous
              </Link>
            ) : null}
            {hasNextPage ? (
              <Link className="button button-secondary button-link" href={pageHref(companyId, prices.page_info.current_page + 1, search)}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <p className={styles.readOnlyNote}>
        Pricing is read-only in this Admin portal. OGL/company-specific prices remain authoritative where present; otherwise Magento pricing applies.
      </p>
    </div>
  );
}
