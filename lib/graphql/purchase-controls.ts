import { graphqlRequest } from "@/lib/graphql/client";

export type PurchaseControlRule = {
  rule_id: number;
  product_id: number;
  sku: string;
  product_name: string;
  quantity_limit: number;
  duration_days: number;
  start_date: string;
};

export type PurchaseControlRole = {
  role_id: number;
  role_name: string;
};

export type PurchaseControlTemplate = {
  template_id: number;
  name: string;
  rules: PurchaseControlRule[];
  assigned_roles: PurchaseControlRole[];
};

export type PurchaseControlsOverview = {
  company_id: number;
  templates: PurchaseControlTemplate[];
};

export type PurchaseControlPageInfo = {
  page_size: number;
  current_page: number;
  total_pages: number;
};

export type AppliedPurchaseControl = {
  applied_id: number;
  user_id: number;
  customer_id: number;
  email: string;
  product_id: number;
  sku: string;
  product_name: string;
  quantity_limit: number;
  duration_days: number;
  start_date: string;
  purchases_so_far: number;
  remaining_quantity: number;
};

export type AppliedPurchaseControlSearchResult = {
  total_count: number;
  items: AppliedPurchaseControl[];
  page_info: PurchaseControlPageInfo;
};

export type PurchaseControlHistoryItem = {
  log_id: number;
  applied_id: number;
  user_id: number;
  customer_id: number;
  email: string;
  product_id: number;
  sku: string;
  product_name: string;
  sales_order_item_id: number;
  order_number: string;
  purchased_quantity: number;
  ordered_at: string;
};

export type PurchaseControlHistorySearchResult = {
  total_count: number;
  items: PurchaseControlHistoryItem[];
  page_info: PurchaseControlPageInfo;
};

export type SavePurchaseControlRuleInput = {
  sku: string;
  quantity_limit: number;
  duration_days: number;
  start_date: string;
};

export type SavePurchaseControlTemplateInput = {
  template_id?: number;
  name: string;
  rules: SavePurchaseControlRuleInput[];
};

const PURCHASE_CONTROLS_QUERY = /* GraphQL */ `
  query AdminPurchaseControls($companyId: Int!) {
    css_admin_purchase_controls(company_id: $companyId) {
      company_id
      templates {
        template_id
        name
        rules {
          rule_id
          product_id
          sku
          product_name
          quantity_limit
          duration_days
          start_date
        }
        assigned_roles {
          role_id
          role_name
        }
      }
    }
  }
`;

const APPLIED_PURCHASE_CONTROLS_QUERY = /* GraphQL */ `
  query AdminAppliedPurchaseControls(
    $companyId: Int!
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    css_admin_applied_purchase_controls(
      company_id: $companyId
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
    ) {
      total_count
      items {
        applied_id
        user_id
        customer_id
        email
        product_id
        sku
        product_name
        quantity_limit
        duration_days
        start_date
        purchases_so_far
        remaining_quantity
      }
      page_info {
        page_size
        current_page
        total_pages
      }
    }
  }
`;

const PURCHASE_CONTROL_HISTORY_QUERY = /* GraphQL */ `
  query AdminPurchaseControlHistory(
    $companyId: Int!
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    css_admin_purchase_control_history(
      company_id: $companyId
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
    ) {
      total_count
      items {
        log_id
        applied_id
        user_id
        customer_id
        email
        product_id
        sku
        product_name
        sales_order_item_id
        order_number
        purchased_quantity
        ordered_at
      }
      page_info {
        page_size
        current_page
        total_pages
      }
    }
  }
`;

const SAVE_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation AdminSavePurchaseControlTemplate(
    $companyId: Int!
    $input: CssAdminSavePurchaseControlTemplateInput!
  ) {
    cssAdminSavePurchaseControlTemplate(company_id: $companyId, input: $input) {
      template_id
      name
    }
  }
`;

const DELETE_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation AdminDeletePurchaseControlTemplate(
    $companyId: Int!
    $templateId: Int!
    $confirmName: String!
  ) {
    cssAdminDeletePurchaseControlTemplate(
      company_id: $companyId
      template_id: $templateId
      confirm_name: $confirmName
    )
  }
`;

const ASSIGN_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation AdminAssignPurchaseControlTemplate(
    $companyId: Int!
    $roleId: Int!
    $templateId: Int
    $applyToUsers: Boolean!
  ) {
    cssAdminAssignPurchaseControlTemplate(
      company_id: $companyId
      role_id: $roleId
      template_id: $templateId
      apply_to_users: $applyToUsers
    ) {
      company_id
      role_id
      role_name
      template_id
      template_name
      applied_users
    }
  }
`;

const APPLY_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation AdminApplyPurchaseControlTemplate($companyId: Int!, $templateId: Int!) {
    cssAdminApplyPurchaseControlTemplate(company_id: $companyId, template_id: $templateId) {
      company_id
      template_id
      affected_users
    }
  }
`;

const RESET_COUNTERS_MUTATION = /* GraphQL */ `
  mutation AdminResetPurchaseControlCounters($companyId: Int!, $templateId: Int!) {
    cssAdminResetPurchaseControlCounters(company_id: $companyId, template_id: $templateId) {
      company_id
      template_id
      affected_users
    }
  }
`;

export async function getPurchaseControls(companyId: number) {
  const data = await graphqlRequest<
    { css_admin_purchase_controls: PurchaseControlsOverview },
    { companyId: number }
  >(PURCHASE_CONTROLS_QUERY, { companyId });
  return data.css_admin_purchase_controls;
}

export async function getAppliedPurchaseControls(
  companyId: number,
  currentPage = 1,
  pageSize = 50,
  search?: string,
) {
  const data = await graphqlRequest<
    { css_admin_applied_purchase_controls: AppliedPurchaseControlSearchResult },
    { companyId: number; currentPage: number; pageSize: number; search: string | null }
  >(APPLIED_PURCHASE_CONTROLS_QUERY, {
    companyId,
    currentPage,
    pageSize,
    search: search?.trim() || null,
  });
  return data.css_admin_applied_purchase_controls;
}

export async function getPurchaseControlHistory(
  companyId: number,
  currentPage = 1,
  pageSize = 50,
  search?: string,
) {
  const data = await graphqlRequest<
    { css_admin_purchase_control_history: PurchaseControlHistorySearchResult },
    { companyId: number; currentPage: number; pageSize: number; search: string | null }
  >(PURCHASE_CONTROL_HISTORY_QUERY, {
    companyId,
    currentPage,
    pageSize,
    search: search?.trim() || null,
  });
  return data.css_admin_purchase_control_history;
}

export async function savePurchaseControlTemplate(
  companyId: number,
  input: SavePurchaseControlTemplateInput,
) {
  return graphqlRequest<
    { cssAdminSavePurchaseControlTemplate: Pick<PurchaseControlTemplate, "template_id" | "name"> },
    { companyId: number; input: SavePurchaseControlTemplateInput }
  >(SAVE_TEMPLATE_MUTATION, { companyId, input });
}

export async function deletePurchaseControlTemplate(
  companyId: number,
  templateId: number,
  confirmName: string,
) {
  return graphqlRequest<
    { cssAdminDeletePurchaseControlTemplate: boolean },
    { companyId: number; templateId: number; confirmName: string }
  >(DELETE_TEMPLATE_MUTATION, { companyId, templateId, confirmName });
}

export async function assignPurchaseControlTemplate(
  companyId: number,
  roleId: number,
  templateId: number | null,
  applyToUsers: boolean,
) {
  return graphqlRequest<
    {
      cssAdminAssignPurchaseControlTemplate: {
        company_id: number;
        role_id: number;
        role_name: string;
        template_id: number | null;
        template_name: string | null;
        applied_users: number;
      };
    },
    { companyId: number; roleId: number; templateId: number | null; applyToUsers: boolean }
  >(ASSIGN_TEMPLATE_MUTATION, { companyId, roleId, templateId, applyToUsers });
}

export async function applyPurchaseControlTemplate(companyId: number, templateId: number) {
  return graphqlRequest<
    { cssAdminApplyPurchaseControlTemplate: { company_id: number; template_id: number; affected_users: number } },
    { companyId: number; templateId: number }
  >(APPLY_TEMPLATE_MUTATION, { companyId, templateId });
}

export async function resetPurchaseControlCounters(companyId: number, templateId: number) {
  return graphqlRequest<
    { cssAdminResetPurchaseControlCounters: { company_id: number; template_id: number; affected_users: number } },
    { companyId: number; templateId: number }
  >(RESET_COUNTERS_MUTATION, { companyId, templateId });
}
