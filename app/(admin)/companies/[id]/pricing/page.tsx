import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import { getCompanyPrices, getCompanyPricingStatus } from "@/lib/graphql/company-pricing";

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
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company detail</Link></div>
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

  const pricingSource = status.has_custom_prices ? "OGL company-specific pricing" : "Magento pricing";
  const hasPreviousPage = prices.page_info.current_page > 1;
  const hasNextPage = prices.page_info.current_page < prices.page_info.total_pages;

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span>
        <span>Pricing</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>Pricing</h1>
          <p className="muted">Read-only OGL pricing visibility for {company.name}. Pricing rules remain backend-authoritative.</p>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{pricingSource}</span>
          <span className="stat-label">Current pricing source</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{status.custom_price_count}</span>
          <span className="stat-label">Custom price rows</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{status.import_status}</span>
          <span className="stat-label">Import status</span>
        </div>
      </div>

      <section className="card stack">
        <div className="card-heading-row">
          <div>
            <h2>Pricing status</h2>
            <p className="muted">This mirrors the OGL pricing state already used by Magento.</p>
          </div>
          <div className={`badge ${status.has_custom_prices ? "badge-ok" : "badge-neutral"}`}>
            {status.has_custom_prices ? "Custom pricing available" : "Magento fallback"}
          </div>
        </div>

        <dl className="detail-list">
          <dt>CREF</dt><dd>{status.cref || "—"}</dd>
          <dt>Company active</dt><dd>{status.company_active ? "Yes" : "No"}</dd>
          <dt>OGL sync enabled</dt><dd>{status.sync_enabled ? "Yes" : "No"}</dd>
          <dt>Import progress</dt><dd>{status.import_percentage}%</dd>
          <dt>Custom prices</dt><dd>{status.status_message}</dd>
          <dt>Last imported</dt><dd>{status.last_imported_at || "—"}</dd>
          <dt>Currency</dt><dd>{status.currency}</dd>
        </dl>
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Imported OGL prices</p>
          <h2>Company-specific prices</h2>
          <p className="muted">Search by SKU. Values and tier breaks are read directly from the accepted Fluid pricing contract.</p>
        </div>

        <form method="get">
          <label>
            Search SKU
            <input name="q" defaultValue={search} placeholder="SKU" />
          </label>
          <button type="submit">Search</button>
        </form>

        {prices.items.length === 0 ? (
          <p className="muted">
            {search ? "No company-specific prices matched this SKU search." : "No company-specific OGL prices are currently available for this company."}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Tier prices</th>
                </tr>
              </thead>
              <tbody>
                {prices.items.map((item) => (
                  <tr key={item.sku}>
                    <td>{item.sku}</td>
                    <td>
                      {item.product_name || "Magento product unavailable"}
                      {item.product_id ? <><br /><span className="muted">Product ID {item.product_id}</span></> : null}
                    </td>
                    <td>{formatAmount(item.price, status.currency)}</td>
                    <td>
                      {item.tier_prices.length === 0
                        ? "—"
                        : item.tier_prices
                            .map((tier) => `${tier.quantity}+ @ ${formatAmount(tier.price, status.currency)}`)
                            .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-heading-row">
          <p className="muted">
            {prices.total_count} row{prices.total_count === 1 ? "" : "s"} · Page {prices.page_info.current_page} of {Math.max(prices.page_info.total_pages, 1)}
          </p>
          <div>
            {hasPreviousPage ? (
              <Link className="button button-link" href={pageHref(companyId, prices.page_info.current_page - 1, search)}>
                Previous
              </Link>
            ) : null}{" "}
            {hasNextPage ? (
              <Link className="button button-link" href={pageHref(companyId, prices.page_info.current_page + 1, search)}>
                Next
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card stack">
        <div>
          <h2>Read-only pricing</h2>
          <p className="muted">
            This Admin surface does not create, edit, delete or upload prices. OGL/company-specific pricing remains authoritative where present; otherwise Magento pricing applies.
          </p>
        </div>
      </section>
    </div>
  );
}
