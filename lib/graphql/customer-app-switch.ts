import { getMagentoConfig } from "@/lib/config";
import { GraphQLRequestError, type GraphQLErrorItem } from "@/lib/graphql/client";

export type CustomerAppTarget = "STORE" | "PORTAL";

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLErrorItem[];
};

const CREATE_TICKET = /* GraphQL */ `
  mutation CreateCustomerAppSwitch($target: CssCustomerApp!, $challenge: String!) {
    cssCreateCustomerAppSwitch(target: $target, code_challenge: $challenge)
  }
`;

const EXCHANGE_TICKET = /* GraphQL */ `
  mutation ExchangeCustomerAppSwitch($code: String!, $target: CssCustomerApp!, $verifier: String!) {
    cssExchangeCustomerAppSwitch(code: $code, target: $target, code_verifier: $verifier)
  }
`;

const VALIDATE_CUSTOMER = /* GraphQL */ `
  query ValidateCustomerAppSwitch {
    customer { email }
    css_company_context { authenticated is_company_customer selected_company_id }
  }
`;

const SUPPORT_CONTEXT = /* GraphQL */ `
  query CustomerSupportContext {
    customer { email }
    css_company_context {
      authenticated
      is_company_customer
      selected_company_id
      companies { company_id }
    }
    customerCart { total_quantity }
  }
`;

const SELECT_COMPANY = /* GraphQL */ `
  mutation SelectCustomerSupportCompany($companyId: Int) {
    cssSelectCompany(company_id: $companyId) {
      authenticated
      is_company_customer
      selected_company_id
    }
  }
`;

const REVOKE_CUSTOMER = /* GraphQL */ `
  mutation RevokeCustomerSupportToken {
    revokeCustomerToken { result }
  }
`;

async function request<TData>(
  query: string,
  variables: Record<string, unknown>,
  token?: string,
) {
  const { graphqlUrl, storeCode } = getMagentoConfig();
  let response: Response;
  try {
    response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        Store: storeCode,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new GraphQLRequestError("Magento GraphQL is unavailable.", [], undefined, "company");
  }

  let body: GraphQLResponse<TData> | null = null;
  try {
    body = (await response.json()) as GraphQLResponse<TData>;
  } catch {
    // A safe error is raised below without exposing the upstream body.
  }

  if (!response.ok || body?.errors?.length || !body?.data) {
    const errors = body?.errors ?? [];
    throw new GraphQLRequestError(
      errors[0]?.message || "Customer app switching is unavailable.",
      errors,
      response.status,
      "company",
    );
  }

  return body.data;
}

export async function createCustomerAppSwitch(
  token: string,
  target: CustomerAppTarget,
  challenge: string,
) {
  const data = await request<{ cssCreateCustomerAppSwitch: string }>(
    CREATE_TICKET,
    { target, challenge },
    token,
  );
  return data.cssCreateCustomerAppSwitch;
}

export async function exchangeCustomerAppSwitch(
  code: string,
  target: CustomerAppTarget,
  verifier: string,
) {
  const data = await request<{ cssExchangeCustomerAppSwitch: string }>(
    EXCHANGE_TICKET,
    { code, target, verifier },
  );
  return data.cssExchangeCustomerAppSwitch;
}

export async function validateCompanyCustomerToken(
  token: string,
  expectedEmail?: string,
  expectedCompanyId?: number,
) {
  const data = await request<{
    customer: { email: string };
    css_company_context: {
      authenticated: boolean;
      is_company_customer: boolean;
      selected_company_id: number | null;
    };
  }>(VALIDATE_CUSTOMER, {}, token);

  const email = data.customer.email.trim().toLocaleLowerCase();
  const expected = expectedEmail?.trim().toLocaleLowerCase();

  return data.css_company_context.authenticated
    && data.css_company_context.is_company_customer
    && Boolean(email)
    && (!expected || email === expected)
    && (!expectedCompanyId || data.css_company_context.selected_company_id === expectedCompanyId);
}

export async function getCustomerSupportContext(token: string) {
  const data = await request<{
    customer: { email: string };
    css_company_context: {
      authenticated: boolean;
      is_company_customer: boolean;
      selected_company_id: number | null;
      companies: Array<{ company_id: number }>;
    };
    customerCart: { total_quantity: number } | null;
  }>(SUPPORT_CONTEXT, {}, token);

  return {
    email: data.customer.email.trim(),
    authenticated: data.css_company_context.authenticated,
    isCompanyCustomer: data.css_company_context.is_company_customer,
    selectedCompanyId: data.css_company_context.selected_company_id,
    companyIds: data.css_company_context.companies.map((company) => company.company_id),
    cartQuantity: Number(data.customerCart?.total_quantity || 0),
  };
}

export async function selectCustomerCompany(token: string, companyId: number) {
  const data = await request<{
    cssSelectCompany: {
      authenticated: boolean;
      is_company_customer: boolean;
      selected_company_id: number | null;
    };
  }>(SELECT_COMPANY, { companyId }, token);
  return data.cssSelectCompany;
}

export async function revokeCustomerToken(token: string) {
  const data = await request<{ revokeCustomerToken: { result: boolean } }>(
    REVOKE_CUSTOMER,
    {},
    token,
  );
  return Boolean(data.revokeCustomerToken?.result);
}
