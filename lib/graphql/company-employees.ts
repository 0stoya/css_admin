import { graphqlRequest } from "@/lib/graphql/client";

export type PageInfo = {
  page_size: number;
  current_page: number;
  total_pages: number;
};

export type CompanyEmployeeConfiguration = {
  company_id: number;
  uses_employee: boolean;
  multi_employee_basket: boolean;
};

export type CompanyEmployee = {
  employee_id: number;
  company_id: number;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  department: string | null;
  cost_centre: string | null;
  manager_company_user_id: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyEmployeeSearchResult = {
  total_count: number;
  items: CompanyEmployee[];
  page_info: PageInfo;
};

export type CompanyEmployeeInput = {
  employee_code: string | null;
  first_name: string;
  last_name: string;
  department: string | null;
  cost_centre: string | null;
  manager_company_user_id: number | null;
  active: boolean;
};

export type CompanyEmployeeImportRow = CompanyEmployeeInput;

export type CompanyEmployeeImportResult = {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

export type CompanyEmployeeExportRow = {
  employee_code: string | null;
  first_name: string;
  last_name: string;
  department: string | null;
  cost_centre: string | null;
  manager_company_user_id: number | null;
  active: boolean;
};

export type CompanyEmployeeSpend = {
  employee_id: number;
  employee_code: string | null;
  employee_name: string;
  department: string | null;
  cost_centre: string | null;
  active: boolean;
  order_count: number;
  product_spend: number;
  last_order_date: string | null;
};

export type CompanyEmployeeSpendResult = {
  company_id: number;
  employee_id: number | null;
  currency: string;
  metric: string;
  from: string | null;
  to: string | null;
  employee_count: number;
  attributed_order_count: number;
  product_spend: number;
  items: CompanyEmployeeSpend[];
  refreshed_at: string;
};

export type CompanyEmployeeOrderSpend = {
  order_id: number;
  order_number: string;
  order_date: string;
  status: string;
  item_count: number;
  product_spend: number;
};

export type CompanyEmployeeOrderSearchResult = {
  company_id: number;
  employee_id: number;
  currency: string;
  metric: string;
  from: string | null;
  to: string | null;
  total_count: number;
  items: CompanyEmployeeOrderSpend[];
  page_info: PageInfo;
};

type ConfigurationData = { css_admin_company_employee_configuration: CompanyEmployeeConfiguration };
type EmployeesData = { css_admin_company_employees: CompanyEmployeeSearchResult };
type EmployeeData = { css_admin_company_employee: CompanyEmployee };
type ExportData = { css_admin_company_employee_export: CompanyEmployeeExportRow[] };
type SpendData = { css_admin_company_employee_spend: CompanyEmployeeSpendResult };
type OrdersData = { css_admin_company_employee_orders: CompanyEmployeeOrderSearchResult };
type SaveConfigurationData = { cssAdminSaveCompanyEmployeeConfiguration: CompanyEmployeeConfiguration };
type SaveEmployeeData = {
  cssAdminCreateCompanyEmployee?: CompanyEmployee;
  cssAdminUpdateCompanyEmployee?: CompanyEmployee;
  cssAdminDeactivateCompanyEmployee?: CompanyEmployee;
};
type ImportData = { cssAdminImportCompanyEmployees: CompanyEmployeeImportResult };

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
  query AdminCompanyEmployeeConfiguration($companyId: Int!) {
    css_admin_company_employee_configuration(company_id: $companyId) {
      company_id
      uses_employee
      multi_employee_basket
    }
  }
`;

const EMPLOYEES_QUERY = /* GraphQL */ `
  query AdminCompanyEmployees(
    $companyId: Int!
    $currentPage: Int!
    $pageSize: Int!
    $search: String
    $active: Boolean
  ) {
    css_admin_company_employees(
      company_id: $companyId
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
      active: $active
    ) {
      total_count
      page_info { page_size current_page total_pages }
      items { ${EMPLOYEE_FIELDS} }
    }
  }
`;

const EMPLOYEE_QUERY = /* GraphQL */ `
  query AdminCompanyEmployee($companyId: Int!, $employeeId: Int!) {
    css_admin_company_employee(company_id: $companyId, employee_id: $employeeId) {
      ${EMPLOYEE_FIELDS}
    }
  }
`;

const EXPORT_QUERY = /* GraphQL */ `
  query AdminCompanyEmployeeExport($companyId: Int!, $active: Boolean) {
    css_admin_company_employee_export(company_id: $companyId, active: $active) {
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
  query AdminCompanyEmployeeSpend($companyId: Int!, $employeeId: Int, $from: String, $to: String) {
    css_admin_company_employee_spend(
      company_id: $companyId
      employee_id: $employeeId
      from: $from
      to: $to
    ) {
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
  query AdminCompanyEmployeeOrders(
    $companyId: Int!
    $employeeId: Int!
    $currentPage: Int!
    $pageSize: Int!
    $from: String
    $to: String
  ) {
    css_admin_company_employee_orders(
      company_id: $companyId
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
      items {
        order_id
        order_number
        order_date
        status
        item_count
        product_spend
      }
    }
  }
`;

const SAVE_CONFIGURATION_MUTATION = /* GraphQL */ `
  mutation AdminSaveCompanyEmployeeConfiguration(
    $companyId: Int!
    $input: CssCompanyEmployeeConfigurationInput!
  ) {
    cssAdminSaveCompanyEmployeeConfiguration(company_id: $companyId, input: $input) {
      company_id
      uses_employee
      multi_employee_basket
    }
  }
`;

const CREATE_EMPLOYEE_MUTATION = /* GraphQL */ `
  mutation AdminCreateCompanyEmployee($companyId: Int!, $input: CssCompanyEmployeeInput!) {
    cssAdminCreateCompanyEmployee(company_id: $companyId, input: $input) {
      ${EMPLOYEE_FIELDS}
    }
  }
`;

const UPDATE_EMPLOYEE_MUTATION = /* GraphQL */ `
  mutation AdminUpdateCompanyEmployee(
    $companyId: Int!
    $employeeId: Int!
    $input: CssCompanyEmployeeUpdateInput!
  ) {
    cssAdminUpdateCompanyEmployee(company_id: $companyId, employee_id: $employeeId, input: $input) {
      ${EMPLOYEE_FIELDS}
    }
  }
`;

const DEACTIVATE_EMPLOYEE_MUTATION = /* GraphQL */ `
  mutation AdminDeactivateCompanyEmployee($companyId: Int!, $employeeId: Int!) {
    cssAdminDeactivateCompanyEmployee(company_id: $companyId, employee_id: $employeeId) {
      ${EMPLOYEE_FIELDS}
    }
  }
`;

const IMPORT_EMPLOYEES_MUTATION = /* GraphQL */ `
  mutation AdminImportCompanyEmployees($companyId: Int!, $rows: [CssCompanyEmployeeImportRowInput!]!) {
    cssAdminImportCompanyEmployees(company_id: $companyId, rows: $rows) {
      created
      updated
      failed
      errors { row message }
    }
  }
`;

export async function getCompanyEmployeeConfiguration(companyId: number) {
  const data = await graphqlRequest<ConfigurationData, { companyId: number }>(CONFIGURATION_QUERY, { companyId });
  return data.css_admin_company_employee_configuration;
}

export async function getCompanyEmployees(input: {
  companyId: number;
  currentPage?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
}) {
  const variables = {
    companyId: input.companyId,
    currentPage: input.currentPage ?? 1,
    pageSize: input.pageSize ?? 50,
    search: input.search || null,
    active: input.active ?? null,
  };
  const data = await graphqlRequest<EmployeesData, typeof variables>(EMPLOYEES_QUERY, variables);
  return data.css_admin_company_employees;
}

export async function getCompanyEmployee(companyId: number, employeeId: number) {
  const data = await graphqlRequest<EmployeeData, { companyId: number; employeeId: number }>(
    EMPLOYEE_QUERY,
    { companyId, employeeId },
  );
  return data.css_admin_company_employee;
}

export async function getCompanyEmployeeExport(companyId: number, active?: boolean) {
  const variables = { companyId, active: active ?? null };
  const data = await graphqlRequest<ExportData, typeof variables>(EXPORT_QUERY, variables);
  return data.css_admin_company_employee_export;
}

export async function getCompanyEmployeeSpend(input: {
  companyId: number;
  employeeId?: number;
  from?: string;
  to?: string;
}) {
  const variables = {
    companyId: input.companyId,
    employeeId: input.employeeId ?? null,
    from: input.from || null,
    to: input.to || null,
  };
  const data = await graphqlRequest<SpendData, typeof variables>(SPEND_QUERY, variables);
  return data.css_admin_company_employee_spend;
}

export async function getCompanyEmployeeOrders(input: {
  companyId: number;
  employeeId: number;
  currentPage?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}) {
  const variables = {
    companyId: input.companyId,
    employeeId: input.employeeId,
    currentPage: input.currentPage ?? 1,
    pageSize: input.pageSize ?? 20,
    from: input.from || null,
    to: input.to || null,
  };
  const data = await graphqlRequest<OrdersData, typeof variables>(ORDERS_QUERY, variables);
  return data.css_admin_company_employee_orders;
}

export async function saveCompanyEmployeeConfiguration(
  companyId: number,
  input: { uses_employee: boolean; multi_employee_basket: boolean },
) {
  const variables = { companyId, input };
  const data = await graphqlRequest<SaveConfigurationData, typeof variables>(
    SAVE_CONFIGURATION_MUTATION,
    variables,
  );
  return data.cssAdminSaveCompanyEmployeeConfiguration;
}

export async function createCompanyEmployee(companyId: number, input: CompanyEmployeeInput) {
  const variables = { companyId, input };
  const data = await graphqlRequest<SaveEmployeeData, typeof variables>(CREATE_EMPLOYEE_MUTATION, variables);
  if (!data.cssAdminCreateCompanyEmployee) throw new Error("Magento returned no created employee.");
  return data.cssAdminCreateCompanyEmployee;
}

export async function updateCompanyEmployee(companyId: number, employeeId: number, input: CompanyEmployeeInput) {
  const variables = { companyId, employeeId, input };
  const data = await graphqlRequest<SaveEmployeeData, typeof variables>(UPDATE_EMPLOYEE_MUTATION, variables);
  if (!data.cssAdminUpdateCompanyEmployee) throw new Error("Magento returned no updated employee.");
  return data.cssAdminUpdateCompanyEmployee;
}

export async function deactivateCompanyEmployee(companyId: number, employeeId: number) {
  const variables = { companyId, employeeId };
  const data = await graphqlRequest<SaveEmployeeData, typeof variables>(DEACTIVATE_EMPLOYEE_MUTATION, variables);
  if (!data.cssAdminDeactivateCompanyEmployee) throw new Error("Magento returned no deactivated employee.");
  return data.cssAdminDeactivateCompanyEmployee;
}

export async function importCompanyEmployees(companyId: number, rows: CompanyEmployeeImportRow[]) {
  const variables = { companyId, rows };
  const data = await graphqlRequest<ImportData, typeof variables>(IMPORT_EMPLOYEES_MUTATION, variables);
  return data.cssAdminImportCompanyEmployees;
}
