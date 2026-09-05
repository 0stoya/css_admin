import { customerGraphqlRequest } from "@/lib/graphql/customer-client";
import type {
  AppliedPurchaseControlSearchResult,
  PurchaseControlHistorySearchResult,
  PurchaseControlsOverview,
  PurchaseControlTemplate,
  SavePurchaseControlTemplateInput,
} from "@/lib/graphql/purchase-controls";

const PURCHASE_CONTROLS_QUERY = /* GraphQL */ `
  query CompanyPortalPurchaseControls {
    css_company_purchase_controls {
      company_id
      templates {
        template_id
        name
        rules {
          rule_id product_id sku product_name quantity_limit duration_days start_date
        }
        assigned_roles { role_id role_name }
      }
    }
  }
`;

const APPLIED_PURCHASE_CONTROLS_QUERY = /* GraphQL */ `
  query CompanyPortalAppliedPurchaseControls(
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    css_company_applied_purchase_controls(
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
    ) {
      total_count
      items {
        applied_id user_id customer_id email product_id sku product_name
        quantity_limit duration_days start_date purchases_so_far remaining_quantity
      }
      page_info { page_size current_page total_pages }
    }
  }
`;

const PURCHASE_CONTROL_HISTORY_QUERY = /* GraphQL */ `
  query CompanyPortalPurchaseControlHistory(
    $currentPage: Int!
    $pageSize: Int!
    $search: String
  ) {
    css_company_purchase_control_history(
      currentPage: $currentPage
      pageSize: $pageSize
      search: $search
    ) {
      total_count
      items {
        log_id applied_id user_id customer_id email product_id sku product_name
        sales_order_item_id order_number purchased_quantity ordered_at
      }
      page_info { page_size current_page total_pages }
    }
  }
`;

const SAVE_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation CompanyPortalSavePurchaseControlTemplate(
    $input: CssSaveCompanyPurchaseControlTemplateInput!
  ) {
    cssSaveCompanyPurchaseControlTemplate(input: $input) { template_id name }
  }
`;

const DELETE_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation CompanyPortalDeletePurchaseControlTemplate(
    $templateId: Int!
    $confirmName: String!
  ) {
    cssDeleteCompanyPurchaseControlTemplate(
      template_id: $templateId
      confirm_name: $confirmName
    )
  }
`;

const ASSIGN_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation CompanyPortalAssignPurchaseControlTemplate(
    $roleId: Int!
    $templateId: Int
    $applyToUsers: Boolean!
  ) {
    cssAssignCompanyPurchaseControlTemplate(
      role_id: $roleId
      template_id: $templateId
      apply_to_users: $applyToUsers
    ) {
      company_id role_id role_name template_id template_name applied_users
    }
  }
`;

const APPLY_TEMPLATE_MUTATION = /* GraphQL */ `
  mutation CompanyPortalApplyPurchaseControlTemplate($templateId: Int!) {
    cssApplyCompanyPurchaseControlTemplate(template_id: $templateId) {
      company_id template_id affected_users
    }
  }
`;

const RESET_COUNTERS_MUTATION = /* GraphQL */ `
  mutation CompanyPortalResetPurchaseControlCounters($templateId: Int!) {
    cssResetCompanyPurchaseControlCounters(template_id: $templateId) {
      company_id template_id affected_users
    }
  }
`;

export async function getCompanyPortalPurchaseControls() {
  const data = await customerGraphqlRequest<
    { css_company_purchase_controls: PurchaseControlsOverview },
    Record<string, never>
  >(PURCHASE_CONTROLS_QUERY, {});
  return data.css_company_purchase_controls;
}

export async function getCompanyPortalAppliedPurchaseControls(
  currentPage = 1,
  pageSize = 50,
  search?: string,
) {
  const data = await customerGraphqlRequest<
    { css_company_applied_purchase_controls: AppliedPurchaseControlSearchResult },
    { currentPage: number; pageSize: number; search: string | null }
  >(APPLIED_PURCHASE_CONTROLS_QUERY, {
    currentPage,
    pageSize,
    search: search?.trim() || null,
  });
  return data.css_company_applied_purchase_controls;
}

export async function getCompanyPortalPurchaseControlHistory(
  currentPage = 1,
  pageSize = 50,
  search?: string,
) {
  const data = await customerGraphqlRequest<
    { css_company_purchase_control_history: PurchaseControlHistorySearchResult },
    { currentPage: number; pageSize: number; search: string | null }
  >(PURCHASE_CONTROL_HISTORY_QUERY, {
    currentPage,
    pageSize,
    search: search?.trim() || null,
  });
  return data.css_company_purchase_control_history;
}

export async function saveCompanyPortalPurchaseControlTemplate(
  input: SavePurchaseControlTemplateInput,
) {
  return customerGraphqlRequest<
    { cssSaveCompanyPurchaseControlTemplate: Pick<PurchaseControlTemplate, "template_id" | "name"> },
    { input: SavePurchaseControlTemplateInput }
  >(SAVE_TEMPLATE_MUTATION, { input });
}

export async function deleteCompanyPortalPurchaseControlTemplate(
  templateId: number,
  confirmName: string,
) {
  return customerGraphqlRequest<
    { cssDeleteCompanyPurchaseControlTemplate: boolean },
    { templateId: number; confirmName: string }
  >(DELETE_TEMPLATE_MUTATION, { templateId, confirmName });
}

export async function assignCompanyPortalPurchaseControlTemplate(
  roleId: number,
  templateId: number | null,
  applyToUsers: boolean,
) {
  return customerGraphqlRequest<
    { cssAssignCompanyPurchaseControlTemplate: { applied_users: number } },
    { roleId: number; templateId: number | null; applyToUsers: boolean }
  >(ASSIGN_TEMPLATE_MUTATION, { roleId, templateId, applyToUsers });
}

export async function applyCompanyPortalPurchaseControlTemplate(templateId: number) {
  return customerGraphqlRequest<
    { cssApplyCompanyPurchaseControlTemplate: { affected_users: number } },
    { templateId: number }
  >(APPLY_TEMPLATE_MUTATION, { templateId });
}

export async function resetCompanyPortalPurchaseControlCounters(templateId: number) {
  return customerGraphqlRequest<
    { cssResetCompanyPurchaseControlCounters: { affected_users: number } },
    { templateId: number }
  >(RESET_COUNTERS_MUTATION, { templateId });
}
