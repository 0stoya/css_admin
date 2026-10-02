import Link from "next/link";
import { presentationText } from "@/lib/company-presentation-content";
import {
  flattenCompanyStructure,
  type CompanyStructureNode,
} from "@/lib/company-structure";
import { findCompanyPortalStructureContext } from "@/lib/company-portal-structure";
import {
  defaultCompanyFinanceVisibility,
  getCompanyFinanceVisibility,
  getLatestCompanyFinanceSnapshot,
  getLatestCompanyFinanceSnapshotsForCompanies,
  type CompanyFinanceVisibility,
  type StoredCompanyFinancialSummary,
} from "@/lib/company-finance-local";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPortalAdministration,
  getCompanyPortalContext,
  getCompanyPortalStructure,
} from "@/lib/graphql/company-portal";
import { getPortalCompanyPresentation } from "@/lib/graphql/company-presentation";
import styles from "@/components/portal/portal-company-profile.module.css";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function address(parts: Array<string | null>) {
  return parts.filter(Boolean).join(", ") || "—";
}

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

function formatCompactAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return formatAmount(value, currency);
  }
}

function monthLabel(month: number) {
  return new Intl.DateTimeFormat("en-GB", { month: "short" })
    .format(new Date(2000, month - 1, 1));
}

function normaliseMonths(finance: StoredCompanyFinancialSummary) {
  const byMonth = new Map(finance.monthly.map((month) => [month.month, month]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return byMonth.get(month) ?? { month, order_count: 0, value: 0 };
  });
}

function formatDate(value: string | null) {
  if (!value) return "No orders returned";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function aggregateGroupFinance(
  snapshots: StoredCompanyFinancialSummary[],
  companyId: number,
  cref: string | null,
): StoredCompanyFinancialSummary | null {
  if (!snapshots.length) return null;

  const currencies = new Set(snapshots.map((snapshot) => snapshot.currency));
  const years = new Set(snapshots.map((snapshot) => snapshot.year));
  if (currencies.size !== 1 || years.size !== 1) return null;

  const aggregatePeriod = (
    key: "year_to_date" | "last_7_days" | "last_30_days" | "last_3_months" | "last_6_months",
  ) => snapshots.reduce(
    (total, snapshot) => ({
      order_count: total.order_count + snapshot[key].order_count,
      value: total.value + snapshot[key].value,
    }),
    { order_count: 0, value: 0 },
  );

  const last365 = snapshots.map((snapshot) => snapshot.last_365_days);
  const last365Days = last365.some((period) => period === null)
    ? null
    : last365.reduce(
        (total, period) => ({
          order_count: total.order_count + (period?.order_count ?? 0),
          value: total.value + (period?.value ?? 0),
        }),
        { order_count: 0, value: 0 },
      );

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return snapshots.reduce(
      (total, snapshot) => {
        const value = snapshot.monthly.find((item) => item.month === month);
        return {
          month,
          order_count: total.order_count + (value?.order_count ?? 0),
          value: total.value + (value?.value ?? 0),
        };
      },
      { month, order_count: 0, value: 0 },
    );
  });

  const lastOrder = snapshots
    .map((snapshot) => snapshot.last_order_date)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

  const refreshTimes = snapshots
    .map((snapshot) => Date.parse(snapshot.refreshed_at))
    .filter(Number.isFinite);
  const oldestRefresh = refreshTimes.length
    ? new Date(Math.min(...refreshTimes)).toISOString()
    : snapshots[0].refreshed_at;

  return {
    company_id: companyId,
    cref,
    currency: snapshots[0].currency,
    year: snapshots[0].year,
    year_to_date: aggregatePeriod("year_to_date"),
    last_7_days: aggregatePeriod("last_7_days"),
    last_30_days: aggregatePeriod("last_30_days"),
    last_3_months: aggregatePeriod("last_3_months"),
    last_6_months: aggregatePeriod("last_6_months"),
    last_365_days: last365Days,
    monthly,
    last_order_date: lastOrder,
    refreshed_at: oldestRefresh,
    captured_at: null,
    source_kind: "PORTAL_GROUP_AGGREGATE",
  };
}

function financePeriods(
  finance: StoredCompanyFinancialSummary,
  visibility: CompanyFinanceVisibility,
) {
  return [
    {
      key: "year-to-date",
      label: `${finance.year} spend to date`,
      enabled: visibility.show_year_to_date,
      period: finance.year_to_date,
    },
    {
      key: "last-7-days",
      label: "Last 7 days",
      enabled: visibility.show_last_7_days,
      period: finance.last_7_days,
    },
    {
      key: "last-30-days",
      label: "Last 30 days",
      enabled: visibility.show_last_30_days,
      period: finance.last_30_days,
    },
    {
      key: "last-3-months",
      label: "Last 3 months",
      enabled: visibility.show_last_3_months,
      period: finance.last_3_months,
    },
    {
      key: "last-6-months",
      label: "Last 6 months",
      enabled: visibility.show_last_6_months,
      period: finance.last_6_months,
    },
    {
      key: "last-365-days",
      label: "Last 365 days",
      enabled: visibility.show_last_365_days,
      period: finance.last_365_days,
    },
  ].filter((item) => item.enabled);
}

export default async function PortalCompanyProfilePage() {
  let presentation;
  try {
    presentation = await getPortalCompanyPresentation();
  } catch (error) {
    return (
      <section className="card stack">
        <div><p className="eyebrow">Company profile</p><h1>Company profile unavailable</h1></div>
        <div className="error">{graphQLErrorMessage(error)}</div>
      </section>
    );
  }

  const [contextResult, administrationResult] = await Promise.allSettled([
    getCompanyPortalContext(),
    getCompanyPortalAdministration(),
  ]);
  const context = contextResult.status === "fulfilled" ? contextResult.value : null;
  const administration = administrationResult.status === "fulfilled" ? administrationResult.value : null;
  const selected = context?.companies.find((company) => company.selected) ?? null;
  const canViewFinance = Boolean(
    selected
    && administration?.is_company_admin
    && administration.company_id === selected.company_id,
  );

  let finance: StoredCompanyFinancialSummary | null = null;
  let visibility: CompanyFinanceVisibility | null = null;
  let financeError: string | null = null;
  let groupFinanceNodes: CompanyStructureNode[] = [];
  let groupFinanceSnapshots = new Map<number, StoredCompanyFinancialSummary>();
  let groupFinanceEnabled = false;
  let groupFinanceComplete = false;
  let groupFinanceError: string | null = null;

  if (canViewFinance && selected) {
    const [financeResult, visibilityResult, structureResult] = await Promise.allSettled([
      getLatestCompanyFinanceSnapshot(selected.company_id, selected.reference),
      getCompanyFinanceVisibility(selected.company_id),
      getCompanyPortalStructure(),
    ]);

    if (financeResult.status === "fulfilled") {
      finance = financeResult.value;
    } else {
      financeError = financeResult.reason instanceof Error
        ? financeResult.reason.message
        : "Company finance snapshot is unavailable.";
    }

    visibility = visibilityResult.status === "fulfilled"
      ? visibilityResult.value
      : defaultCompanyFinanceVisibility(selected.company_id);

    const structure = structureResult.status === "fulfilled"
      ? structureResult.value
      : null;
    const structureContext = structure
      ? findCompanyPortalStructureContext(structure, selected.company_id)
      : null;
    const isGroupHead = Boolean(
      structureContext
      && structureContext.root.company.company_id === selected.company_id
      && structureContext.root.company.parent_company_id === null
      && structureContext.root.children.length > 0
    );

    if (isGroupHead && structureContext) {
      groupFinanceEnabled = true;
      groupFinanceNodes = flattenCompanyStructure(structureContext.root);

      try {
        groupFinanceSnapshots = await getLatestCompanyFinanceSnapshotsForCompanies(
          groupFinanceNodes.map((node) => node.company),
        );
        if (finance && !groupFinanceSnapshots.has(selected.company_id)) {
          groupFinanceSnapshots.set(selected.company_id, finance);
        }

        const synced = groupFinanceNodes
          .map((node) => groupFinanceSnapshots.get(node.company.company_id) ?? null)
          .filter((snapshot): snapshot is StoredCompanyFinancialSummary => snapshot !== null);

        groupFinanceComplete = synced.length === groupFinanceNodes.length;
        const aggregate = aggregateGroupFinance(
          synced,
          selected.company_id,
          selected.reference,
        );

        if (aggregate) {
          finance = aggregate;
        } else if (synced.length) {
          groupFinanceError = "Group snapshots use different currencies or financial years, so a safe group total cannot be shown.";
        }
      } catch (error) {
        groupFinanceError = error instanceof Error
          ? error.message
          : "Group finance snapshots are unavailable.";
      }
    }
  }

  const rep = presentation.can_view_rep_contacts ? presentation.rep_contacts[0] ?? null : null;
  const welcomeContent = presentationText(presentation.welcome_text);
  const descriptionContent = presentationText(presentation.company_description);
  const bannerStyle = presentation.banner_url
    ? { backgroundImage: `linear-gradient(rgb(0 35 72 / 18%), rgb(0 35 72 / 18%)), url("${presentation.banner_url}")` }
    : undefined;
  const periods = finance && visibility ? financePeriods(finance, visibility) : [];
  const monthly = finance ? normaliseMonths(finance) : [];
  const maxMonthValue = Math.max(1, ...monthly.map((month) => month.value));

  return (
    <div className={styles.profile}>
      <Link className={styles.backLink} href="/portal"><span aria-hidden="true">←</span> Company overview</Link>

      <header className={styles.header}>
        <div>
          <span className={styles.reference}>{presentation.company_reference || "Company profile"}</span>
          <h1>{presentation.portal_title || presentation.company_name || "Your company"}</h1>
          <p>Your company information, recent order activity and Chelmsford Safety Supplies account contact.</p>
        </div>
      </header>

      {!presentation.enabled ? (
        <div className={styles.notice}>Your personalised company page is not enabled yet. Your core company details are still available below.</div>
      ) : null}

      <div className={styles.layout}>
        <section className={styles.primary}>
          <div className={styles.banner} style={bannerStyle}>
            {presentation.logo_url ? (
              <div className={styles.logoWrap}>
                <img className={styles.logo} src={presentation.logo_url} alt={`${presentation.company_name || "Company"} logo`} />
              </div>
            ) : null}
          </div>

          <div className={styles.primaryBody}>
            <div className={styles.welcome}>
              <span className="eyebrow">Welcome</span>
              <h2>{presentation.welcome_heading || `Welcome to ${presentation.company_name || "your company account"}`}</h2>
              {welcomeContent.text ? <p>{welcomeContent.text}</p> : null}
              {descriptionContent.text ? <p className={styles.description}>{descriptionContent.text}</p> : null}
            </div>

            <section className={styles.detailSection} aria-labelledby="company-details-heading">
              <h3 id="company-details-heading">Company details</h3>
              <div className={styles.details}>
                <div className={styles.detail}><span>Company</span><strong>{presentation.company_name || "—"}</strong></div>
                <div className={styles.detail}><span>Reference</span><strong>{presentation.company_reference || "—"}</strong></div>
                <div className={styles.detail}>
                  <span>Telephone</span>
                  {presentation.contact_phone ? <a href={`tel:${presentation.contact_phone}`}>{presentation.contact_phone}</a> : <strong>—</strong>}
                </div>
                <div className={styles.detail}>
                  <span>Email</span>
                  {presentation.contact_email ? <a href={`mailto:${presentation.contact_email}`}>{presentation.contact_email}</a> : <strong>—</strong>}
                </div>
                {presentation.procurement_email ? (
                  <div className={styles.detail}><span>Procurement</span><a href={`mailto:${presentation.procurement_email}`}>{presentation.procurement_email}</a></div>
                ) : null}
                <div className={`${styles.detail} ${styles.spanTwo}`}>
                  <span>Address</span>
                  <strong>{address([presentation.street, presentation.city, presentation.region, presentation.postcode, presentation.country_code])}</strong>
                </div>
              </div>
            </section>
          </div>
        </section>

        <aside className={styles.sideColumn}>
          {rep ? (
            <section className={`${styles.sideCard} ${styles.repCard}`} aria-labelledby="account-manager-heading">
              <h2 id="account-manager-heading">Your account manager</h2>
              <div className={styles.repIdentity}>
                {rep.image_url ? <img className={styles.repPhoto} src={rep.image_url} alt={`${rep.name} profile`} /> : <div className={styles.repInitials} aria-hidden="true">{initials(rep.name)}</div>}
                <div className={styles.repIdentityText}>
                  <small>Chelmsford Safety Supplies</small>
                  <strong>{rep.name}</strong>
                  <span>{rep.job_title || "Account Manager"}</span>
                </div>
              </div>
              {rep.profile_message ? <p className={styles.repMessage}>{rep.profile_message}</p> : null}
              {(rep.phone || rep.mobile || rep.email) ? (
                <div className={styles.repContacts}>
                  {rep.phone ? <a href={`tel:${rep.phone}`}>Office · {rep.phone}</a> : null}
                  {rep.mobile ? <a href={`tel:${rep.mobile}`}>Mobile · {rep.mobile}</a> : null}
                  {rep.email ? <a href={`mailto:${rep.email}`}>{rep.email}</a> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.sideCard}>
            <p className="eyebrow">Account support</p>
            <h2>Need something changed?</h2>
            <p className="muted">Contact your account manager or Chelmsford Safety Supplies if your company details need updating.</p>
          </section>
        </aside>
      </div>

      {canViewFinance ? (
        <section className={styles.financeSection} aria-labelledby="company-finance-heading">
          <div className={styles.financeHeader}>
            <div>
              <span className="eyebrow">Financial overview</span>
              <h2 id="company-finance-heading">{groupFinanceEnabled ? "Group order activity" : "Order activity"}</h2>
              <p>
                {groupFinanceEnabled
                  ? `Read-only OGL order value across the group head and its child companies. ${groupFinanceSnapshots.size} of ${groupFinanceNodes.length} companies currently have stored snapshots.`
                  : "Read-only OGL order value for your company. These figures are not the accounting ledger balance."}
              </p>
            </div>
            {finance ? (
              <div className={styles.financeUpdated}>
                <span>{groupFinanceEnabled ? "Oldest snapshot" : "Updated"}</span>
                <strong>{formatTimestamp(finance.refreshed_at)}</strong>
              </div>
            ) : null}
          </div>

          {financeError ? <div className="error">{financeError}</div> : null}
          {groupFinanceError ? <div className="error">{groupFinanceError}</div> : null}
          {groupFinanceEnabled ? (
            <div className={styles.groupFinanceStatus}>
              <strong>Group head view</strong>
              <span>
                {groupFinanceComplete
                  ? `All ${groupFinanceNodes.length} company snapshots are included.`
                  : `${groupFinanceSnapshots.size} of ${groupFinanceNodes.length} company snapshots are included; missing companies are not treated as zero spend.`}
              </span>
              <Link href="/portal/company-structure">View company structure →</Link>
            </div>
          ) : null}

          {finance ? (
            <>
              {periods.length ? (
                <div className={styles.financeGrid}>
                  {periods.map((item) => (
                    <article className={styles.financeCard} key={item.key}>
                      <span className={styles.financeLabel}>{item.label}</span>
                      <strong className={styles.financeValue}>
                        {item.period ? formatAmount(item.period.value, finance.currency) : "—"}
                      </strong>
                      <span className={styles.financeMeta}>
                        {item.period
                          ? `${item.period.order_count} order${item.period.order_count === 1 ? "" : "s"}`
                          : "Awaiting source support"}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.financeEmpty}>Financial summary periods are currently hidden by your company settings.</div>
              )}

              {groupFinanceEnabled && groupFinanceNodes.length ? (
                <section className={styles.groupBreakdown} aria-labelledby="portal-group-finance-breakdown-heading">
                  <div className={styles.monthlyHeader}>
                    <div>
                      <span className="eyebrow">Company breakdown</span>
                      <h3 id="portal-group-finance-breakdown-heading">Group companies</h3>
                    </div>
                    <span className={styles.monthlyCurrency}>{finance.currency}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>{finance.year} spend to date</th>
                          <th>Last 30 days</th>
                          <th>Snapshot</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupFinanceNodes.map((node) => {
                          const snapshot = groupFinanceSnapshots.get(node.company.company_id) ?? null;
                          return (
                            <tr key={node.company.company_id}>
                              <td>
                                <div className="cell-stack">
                                  <strong>{node.company.name}</strong>
                                  <span className="muted small-text">
                                    {node.company.reference || `Company ${node.company.company_id}`}
                                    {node.company.company_id === selected?.company_id ? " · Group head" : ""}
                                  </span>
                                </div>
                              </td>
                              <td>{snapshot ? formatAmount(snapshot.year_to_date.value, snapshot.currency) : "—"}</td>
                              <td>{snapshot ? formatAmount(snapshot.last_30_days.value, snapshot.currency) : "—"}</td>
                              <td>
                                {snapshot ? (
                                  <div className="cell-stack">
                                    <strong>{formatTimestamp(snapshot.refreshed_at)}</strong>
                                    <span className="muted small-text">OGL refreshed</span>
                                  </div>
                                ) : (
                                  <span className="badge badge-neutral">Not synced</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className={styles.monthlySection} aria-labelledby="portal-monthly-spend-heading">
                <div className={styles.monthlyHeader}>
                  <div>
                    <span className="eyebrow">January–December</span>
                    <h3 id="portal-monthly-spend-heading">{finance.year} spend per month</h3>
                  </div>
                  <span className={styles.monthlyCurrency}>{finance.currency}</span>
                </div>

                <div
                  className={styles.monthlyChart}
                  role="img"
                  aria-label={`${finance.year} monthly OGL order value`}
                >
                  {monthly.map((month) => {
                    const height = month.value > 0
                      ? Math.max(3, (month.value / maxMonthValue) * 100)
                      : 0;
                    return (
                      <div
                        className={styles.monthColumn}
                        key={month.month}
                        title={`${monthLabel(month.month)}: ${formatAmount(month.value, finance.currency)} · ${month.order_count} orders`}
                      >
                        <span className={styles.monthValue}>
                          {month.value > 0 ? formatCompactAmount(month.value, finance.currency) : "—"}
                        </span>
                        <div className={styles.monthTrack} aria-hidden="true">
                          {month.value > 0 ? (
                            <div className={styles.monthFill} style={{ height: `${height}%` }} />
                          ) : null}
                        </div>
                        <span className={styles.monthLabel}>{monthLabel(month.month)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className={styles.financeFooter}>
                <span>Last order <strong>{formatDate(finance.last_order_date)}</strong></span>
                <span>Currency <strong>{finance.currency}</strong></span>
              </div>
            </>
          ) : !financeError ? (
            <div className={styles.financeEmpty}>
              No local financial snapshot is available yet. Your company profile remains available normally.
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
