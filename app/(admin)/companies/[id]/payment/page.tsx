import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPaymentConfiguration,
  type CompanyPaymentConfiguration,
} from "@/lib/graphql/payment-configuration";
import { saveCompanyPaymentConfigurationAction } from "./actions";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function loadPaymentConfiguration(companyId: number) {
  try {
    const [company, configuration] = await Promise.all([
      getCompany(companyId),
      getCompanyPaymentConfiguration(companyId),
    ]);

    return { company, configuration, error: null };
  } catch (error) {
    return { company: null, configuration: null, error: graphQLErrorMessage(error) };
  }
}

function configurationMode(configuration: CompanyPaymentConfiguration) {
  if (!configuration.is_configured) return "Not configured";
  if (!configuration.is_specific) return "Configured / non-specific";
  return "Specific methods";
}

export default async function CompanyPaymentConfigurationPage({
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

  const notice = firstParam(query.notice);
  const mutationError = firstParam(query.error);
  const { company, configuration, error } = await loadPaymentConfiguration(companyId);

  if (!company || !configuration) {
    return (
      <div className="stack">
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company detail</Link></div>
        <section className="card stack">
          <div>
            <p className="eyebrow">Backend request failed</p>
            <h1>Payment configuration unavailable</h1>
          </div>
          <div className="error">{error}</div>
        </section>
      </div>
    );
  }

  const allowedMethods = new Set(configuration.allowed_methods);
  const availableCodes = new Set(configuration.available_methods.map((method) => method.code));
  const unavailableConfiguredMethods = configuration.allowed_methods.filter(
    (methodCode) => !availableCodes.has(methodCode),
  );

  return (
    <div className="stack section-gap">
      <div className="breadcrumbs">
        <Link href="/companies">Companies</Link><span aria-hidden="true">/</span>
        <Link href={`/companies/${company.company_id}`}>{company.name}</Link><span aria-hidden="true">/</span>
        <span>Payment configuration</span>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">Company {company.company_id}</p>
          <h1>Payment configuration</h1>
          <p className="muted">Company payment-method configuration returned and validated by Fluid for {company.name}.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{configuration.is_configured ? "Yes" : "No"}</span>
          <span className="stat-label">Configured</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{configuration.is_specific ? "Yes" : "No"}</span>
          <span className="stat-label">Specific methods</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{configuration.allowed_methods.length}</span>
          <span className="stat-label">Allowed method codes</span>
        </div>
      </div>

      <section className="card stack">
        <div className="card-heading-row">
          <div>
            <h2>Current state</h2>
            <p className="muted">Fluid mode: {configurationMode(configuration)}.</p>
          </div>
          <div className={`badge ${configuration.is_configured ? "badge-ok" : "badge-neutral"}`}>
            {configuration.is_configured ? "Configured" : "Default state"}
          </div>
        </div>
        <dl className="detail-list">
          <dt>Company ID</dt><dd>{configuration.company_id}</dd>
          <dt>Available methods</dt><dd>{configuration.available_methods.length}</dd>
          <dt>Allowed methods</dt><dd>{configuration.allowed_methods.length ? configuration.allowed_methods.join(", ") : "—"}</dd>
        </dl>
      </section>

      {unavailableConfiguredMethods.length ? (
        <div className="error">
          The saved configuration contains method code(s) that are not in the backend&apos;s current available-method list: {unavailableConfiguredMethods.join(", ")}. Review before saving because Fluid validates submitted method codes.
        </div>
      ) : null}

      <form action={saveCompanyPaymentConfigurationAction} className="card stack">
        <input name="companyId" type="hidden" value={company.company_id} />

        <div>
          <h2>Company payment override</h2>
          <p className="muted">The flags and selected method codes are persisted through Fluid&apos;s existing company payment configuration path.</p>
        </div>

        <div className="form-grid">
          <label className="check-field">
            <input name="isConfigured" type="checkbox" defaultChecked={configuration.is_configured} />
            <span>
              <strong>Company payment configuration is enabled</strong>
              <span className="muted small-text">Controls the backend&apos;s `is_configured` company payment flag.</span>
            </span>
          </label>
          <label className="check-field">
            <input name="isSpecific" type="checkbox" defaultChecked={configuration.is_specific} />
            <span>
              <strong>Use specific payment methods</strong>
              <span className="muted small-text">Controls the backend&apos;s `is_specific` payment-method restriction flag.</span>
            </span>
          </label>
        </div>

        <div className="field">
          <label>Allowed payment methods</label>
          <div className="resource-picker">
            {configuration.available_methods.map((method) => (
              <label className="resource-option" key={method.code}>
                <input
                  name="allowedMethods"
                  type="checkbox"
                  value={method.code}
                  defaultChecked={allowedMethods.has(method.code)}
                />
                <span>{method.label}</span>
                <code>{method.code}</code>
              </label>
            ))}
            {configuration.available_methods.length === 0 ? (
              <span className="muted">Fluid returned no available payment methods for this configuration form.</span>
            ) : null}
          </div>
          <span className="muted small-text">Fluid rejects unknown method codes and rejects an empty list when configured + specific restriction is enabled.</span>
        </div>

        <div>
          <button className="button" type="submit">Save payment configuration</button>
        </div>
      </form>
    </div>
  );
}
