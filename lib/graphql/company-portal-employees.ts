import { customerGraphqlRequest } from "@/lib/graphql/customer-client";
import type {
  CompanyEmployee,
  CompanyEmployeeConfiguration,
  CompanyEmployeeExportRow,
  CompanyEmployeeImportResult,
  CompanyEmployeeImportRow,
  CompanyEmployeeInput,
  CompanyEmployeeOrderSearchResult,
  CompanyEmployeeSearchResult,
  CompanyEmployeeSpendResult,
} from "@/lib/graphql/company-employees";

const EMPLOYEE_FIELDS = /* GraphQL */ `
  employee_id
  company_id
  employee_code
  first_name
  last_name
  full_name
  department
  cost_centre
  manager_company_user_id
  active
  created_at
  updated_at
`;

const CONFIGURATION_QUERY = /* GraphQL */ `
  query CompanyEmployeeConfiguration {
    css_company_employee_configuration {
      company_id
      uses_employee
      multi_employee_basket
    }
  }
`;

const EMPLOYEES_QUERY = /* GraphQL */ `
  query CompanyEmployees($currentPage: Int!, $pageSize: Int!, $search: String, $active: Boolean) {
    css_company_employees(currentPage: $currentPage, pageSize: $pageSize, search: $search, active: $active) {
      total_count
      page_info { page_size current_page total_pages }
      items { ${EMPLOYEE_FIELDS} }
    }
  }
`;

const EMPLOYEE_QUERY = /* GraphQL */ `
  query CompanyEmployee($employeeId: Int!) {
    css_company_employee(employee_id: $employeeId) { ${EMPLOYEE_FIELDS} }
  }
`;

const EXPORT_QUERY = /* GraphQL */ `
  query CompanyEmployeeExport($active: Boolean) {
    css_company_employee_export(active: $active) {
      employee_code
      first_name
      last_name
      department
      cost_centre
      manager_company_user_id
      active
    }
  }
`;

const SPEND_QUERY = /* GraphQL */ `
  query CompanyEmployeeSpend($employeeId: Int, $from: String, $to: String) {
    css_company_employee_spend(employee_id: $employeeId, from: $from, to: $to) {
      company_id
      employee_id
      currency
      metric
      from
      to
      employee_count
      attributed_order_count
      product_spend
      refreshed_at
      items {
        employee_id
        employee_code
        employee_name
        department
        cost_centre
        active
        order_count
        product_spend
        last_order_date
      }
    }
  }
`;

const ORDERS_QUERY = /* GraphQL */ `
  query CompanyEmployeeOrders($employeeId: Int!, $currentPage: Int!, $pageSize: Int!, $from: String, $to: String) {
    css_company_employee_orders(
      employee_id: $employeeId
      currentPage: $currentPage
      pageSize: $pageSize
      from: $from
      to: $to
    ) {
      company_id
      employee_id
      currency
      metric
      from
      to
      total_count
      page_info { page_size current_page total_pages }
      items { order_id order_number order_date status item_count product_spend }
    }
  }
`;

const SAVE_CONFIGURATION_MUTATION = /* GraphQL */ `
  mutation SaveCompanyEmployeeConfiguration($input: CssCompanyEmployeeConfigurationInput!) {
    cssSaveCompanyEmployeeConfiguration(input: $input) {
      company_id
      uses_employee
      multi_employee_basket
    }
  }
`;

const CREATE_EMPLOYEE_MUTATION = /* GraphQL */ `
  mutation CreateCompanyEmployee($input: CssCompanyEmployeeInput!) {
    cssCreateCompanyEmployee(input: $input) { ${EMPLOYEE_FIELDS} }
  }
`;

const UPDATE_EMPLOYEE_MUTATION = /* GraphQL */ `
  mutation UpdateCompanyEmployee($employeeId: Int!, $input: CssCompanyEmployeeUpdateInput!) {
    cssUpdateCompanyEmployee(employee_id: $employeeId, input: $input) { ${EMPLOYEE_FIELDS} }
  }
`;

const DEACTIVATE_EMPLOYEE_MUTATION = /* GraphQL */ `
  mutation DeactivateCompanyEmployee($employeeId: Int!) {
    cssDeactivateCompanyEmployee(employee_id: $employeeId) { ${EMPLOYEE_FIELDS} }
  }
`;

const IMPORT_EMPLOYEES_MUTATION = /* GraphQL */ `
  mutation ImportCompanyEmployees($rows: [CssCompanyEmployeeImportRowInput!]!) {
    cssImportCompanyEmployees(rows: $rows) {
      created
      updated
      failed
      errors { row message }
    }
  }
`;

export async function getPortalEmployeeConfiguration() {
  const data = await customerGraphqlRequest<
    { css_company_employee_configuration: CompanyEmployeeConfiguration },
    Record<string, never>
  >(CONFIGURATION_QUERY, {});
  return data.css_company_employee_configuration;
}

export async function getPortalEmployees(input: {
  currentPage?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
}) {
  const variables = {
    currentPage: input.currentPage ?? 1,
    pageSize: input.pageSize ?? 50,
    search: input.search || null,
    active: input.active ?? null,
  };
  const data = await customerGraphqlRequest<{ css_company_employees: CompanyEmployeeSearchResult }, typeof variables>(
    EMPLOYEES_QUERY,
    variables,
  );
  return data.css_company_employees;
}

export async function getPortalEmployee(employeeId: number) {
  const data = await customerGraphqlRequest<{ css_company_employee: CompanyEmployee }, { employeeId: number }>(
    EMPLOYEE_QUERY,
    { employeeId },
  );
  return data.css_company_employee;
}

export async function getPortalEmployeeExport(active?: boolean) {
  const variables = { active: active ?? null };
  const data = await customerGraphqlRequest<{ css_company_employee_export: CompanyEmployeeExportRow[] }, typeof variables>(
    EXPORT_QUERY,
    variables,
  );
  return data.css_company_employee_export;
}

export async function getPortalEmployeeSpend(input: { employeeId?: number; from?: string; to?: string }) {
  const variables = { employeeId: input.employeeId ?? null, from: input.from || null, to: input.to || null };
  const data = await customerGraphqlRequest<{ css_company_employee_spend: CompanyEmployeeSpendResult }, typeof variables>(
    SPEND_QUERY,
    variables,
  );
  return data.css_company_employee_spend;
}

export async function getPortalEmployeeOrders(input: {
  employeeId: number;
  currentPage?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}) {
  const variables = {
    employeeId: input.employeeId,
    currentPage: input.currentPage ?? 1,
    pageSize: input.pageSize ?? 20,
    from: input.from || null,
    to: input.to || null,
  };
  const data = await customerGraphqlRequest<{ css_company_employee_orders: CompanyEmployeeOrderSearchResult }, typeof variables>(
    ORDERS_QUERY,
    variables,
  );
  return data.css_company_employee_orders;
}

export async function savePortalEmployeeConfiguration(input: {
  uses_employee: boolean;
  multi_employee_basket: boolean;
}) {
  const data = await customerGraphqlRequest<
    { cssSaveCompanyEmployeeConfiguration: CompanyEmployeeConfiguration },
    { input: typeof input }
  >(SAVE_CONFIGURATION_MUTATION, { input });
  return data.cssSaveCompanyEmployeeConfiguration;
}

export async function createPortalEmployee(input: CompanyEmployeeInput) {
  const data = await customerGraphqlRequest<{ cssCreateCompanyEmployee: CompanyEmployee }, { input: CompanyEmployeeInput }>(
    CREATE_EMPLOYEE_MUTATION,
    { input },
  );
  return data.cssCreateCompanyEmployee;
}

export async function updatePortalEmployee(employeeId: number, input: CompanyEmployeeInput) {
  const variables = { employeeId, input };
  const data = await customerGraphqlRequest<{ cssUpdateCompanyEmployee: CompanyEmployee }, typeof variables>(
    UPDATE_EMPLOYEE_MUTATION,
    variables,
  );
  return data.cssUpdateCompanyEmployee;
}

export async function deactivatePortalEmployee(employeeId: number) {
  const data = await customerGraphqlRequest<{ cssDeactivateCompanyEmployee: CompanyEmployee }, { employeeId: number }>(
    DEACTIVATE_EMPLOYEE_MUTATION,
    { employeeId },
  );
  return data.cssDeactivateCompanyEmployee;
}

export async function importPortalEmployees(rows: CompanyEmployeeImportRow[]) {
  const data = await customerGraphqlRequest<
    { cssImportCompanyEmployees: CompanyEmployeeImportResult },
    { rows: CompanyEmployeeImportRow[] }
  >(IMPORT_EMPLOYEES_MUTATION, { rows });
  return data.cssImportCompanyEmployees;
}
