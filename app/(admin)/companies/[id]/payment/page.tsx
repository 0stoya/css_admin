import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentConfigurationWorkspace } from "@/components/payment-configuration-workspace";
import { getCompany } from "@/lib/graphql/companies";
import { graphQLErrorMessage } from "@/lib/graphql/client";
import {
  getCompanyPaymentConfiguration,
  type CompanyPaymentConfiguration,
} from "@/lib/graphql/payment-configuration";

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
  if (!configuration.is_configured) {
    return { short: "Default", label: "Platform default" };
  }
  if (!configuration.is_specific) {
    return { short: "All", label: "All available methods" };
  }
  return { short: "Specific", label: "Specific methods" };
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
        <div><Link className="back-link" href={`/companies/${companyId}`}>← Company overview</Link></div>
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

  const availableCodes = new Set(configuration.available_methods.map((method) => method.code));
  const unavailableConfiguredMethods = configuration.allowed_methods.filter(
    (methodCode) => !availableCodes.has(methodCode),
  );
  const currentMode = configurationMode(configuration);
  const selectedAvailableCount = configuration.allowed_methods.filter((code) => availableCodes.has(code)).length;
  const checkoutMethodValue = !configuration.is_configured
    ? "Fluid"
    : configuration.is_specific
      ? String(selectedAvailableCount)
      : String(configuration.available_methods.length);

  return (
    <div className="stack section-gap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Checkout payments</p>
          <h1>Payment configuration</h1>
          <p className="muted">Control whether this company follows the platform payment policy or uses its own allowed checkout methods.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {mutationError ? <div className="error">{mutationError}</div> : null}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{currentMode.short}</span>
          <span className="stat-label">Current policy · {currentMode.label}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{configuration.available_methods.length}</span>
          <span className="stat-label">Available payment methods</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{checkoutMethodValue}</span>
          <span className="stat-label">
            {!configuration.is_configured
              ? "Checkout follows Fluid defaults"
              : configuration.is_specific
                ? "Methods currently allowed"
                : "All available methods allowed"}
          </span>
        </div>
      </div>

      {unavailableConfiguredMethods.length ? (
        <div className="error">
          The saved policy references payment method code(s) Fluid no longer reports as available: {unavailableConfiguredMethods.join(", ")}. They will be removed the next time the policy is saved.
        </div>
      ) : null}

      <PaymentConfigurationWorkspace companyId={company.company_id} configuration={configuration} />
    </div>
  );
}
