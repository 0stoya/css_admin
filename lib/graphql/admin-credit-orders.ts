import { GraphQLRequestError, graphqlRequest } from "@/lib/graphql/client";

export type AdminCreditOrderActor = {
  company_user_id: number;
  customer_id: number | null;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
};

export type AdminCreditOrderActions = {
  can_approve: boolean;
  can_reject: boolean;
  can_cancel: boolean;
  can_place_order: boolean;
  can_add_comment: boolean;
  requires_payment_details: boolean;
};

export type AdminCreditOrderComment = {
  comment_id: number;
  creator_company_user_id: number;
  comment: string;
  created_at: string | null;
};

export type AdminCreditOrderLog = {
  log_id: number;
  actor_company_user_id: number | null;
  activity_type: string | null;
  message: string | null;
  created_at: string | null;
};

export type AdminCreditOrderItem = {
  item_id: number;
  product_id: number | null;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  row_total: number;
};

export type AdminCreditOrder = {
  credit_order_id: number;
  number: string;
  status: string;
  company_id: number;
  creator: AdminCreditOrderActor;
  grand_total: number;
  shipping_method: string | null;
  payment_method: string | null;
  purchase_order_number: string | null;
  auto_approved: boolean;
  approved_by: number[];
  order_id: number | null;
  order_number: string | null;
  created_at: string | null;
  updated_at: string | null;
  actions: AdminCreditOrderActions | null;
  comments: AdminCreditOrderComment[];
  logs: AdminCreditOrderLog[];
  // null means the optional item query is absent from Magento's schema; [] means no items.
  items?: AdminCreditOrderItem[] | null;
};

export type AdminCreditOrderSearchResult = {
  total_count: number;
  items: AdminCreditOrder[];
  page_info: {
    page_size: number;
    current_page: number;
    total_pages: number;
  };
};

export type AdminCreditOrderActionInput = {
  company_id: number;
  number: string;
  actor_company_user_id: number;
  comment?: string | null;
};

export type AdminCreditOrderCommentInput = {
  company_id: number;
  number: string;
  actor_company_user_id: number;
  comment: string;
};

type ListData = { css_admin_credit_orders: AdminCreditOrderSearchResult };
type DetailData = {
  css_admin_credit_order: AdminCreditOrder;
  css_admin_credit_order_items: AdminCreditOrderItem[];
};
type DetailWithoutItemsData = { css_admin_credit_order: AdminCreditOrder };
type DetailVariables = {
  companyId: number;
  number: string;
  actorCompanyUserId: number | null;
};
type ActionData = {
  cssAdminApproveCreditOrder?: AdminCreditOrder;
  cssAdminRejectCreditOrder?: AdminCreditOrder;
  cssAdminCancelCreditOrder?: AdminCreditOrder;
  cssAdminPlaceCreditOrder?: AdminCreditOrder;
  cssAdminAddCreditOrderComment?: AdminCreditOrder;
};

const CORE_ORDER_FIELDS = /* GraphQL */ `
  credit_order_id
  number
  status
  company_id
  creator {
    company_user_id
    customer_id
    firstname
    lastname
    email
  }
  grand_total
  shipping_method
  payment_method
  purchase_order_number
  auto_approved
  approved_by
  order_id
  order_number
  created_at
  updated_at
  actions {
    can_approve
    can_reject
    can_cancel
    can_place_order
    can_add_comment
    requires_payment_details
  }
`;

const DETAIL_ORDER_FIELDS = /* GraphQL */ `
  ${CORE_ORDER_FIELDS}
  comments {
    comment_id
    creator_company_user_id
    comment
    created_at
  }
  logs {
    log_id
    actor_company_user_id
    activity_type
    message
    created_at
  }
`;

const ADMIN_CREDIT_ORDERS_QUERY = /* GraphQL */ `
  query AdminCreditOrders(
    $companyId: Int!
    $currentPage: Int!
    $pageSize: Int!
    $statuses: [String!]
    $search: String
    $actorCompanyUserId: Int
  ) {
    css_admin_credit_orders(
      company_id: $companyId
      currentPage: $currentPage
      pageSize: $pageSize
      statuses: $statuses
      search: $search
      actor_company_user_id: $actorCompanyUserId
    ) {
      total_count
      page_info { page_size current_page total_pages }
      items { ${CORE_ORDER_FIELDS} }
    }
  }
`;

const ADMIN_CREDIT_ORDER_QUERY = /* GraphQL */ `
  query AdminCreditOrder($companyId: Int!, $number: String!, $actorCompanyUserId: Int) {
    css_admin_credit_order(
      company_id: $companyId
      number: $number
      actor_company_user_id: $actorCompanyUserId
    ) {
      ${DETAIL_ORDER_FIELDS}
    }
    css_admin_credit_order_items(company_id: $companyId, number: $number) {
      item_id
      product_id
      sku
      name
      quantity
      unit_price
      row_total
    }
  }
`;

// The original admin credit-order contract, supported without the optional frozen-item resolver.
const ADMIN_CREDIT_ORDER_WITHOUT_ITEMS_QUERY = /* GraphQL */ `
  query AdminCreditOrderWithoutItems($companyId: Int!, $number: String!, $actorCompanyUserId: Int) {
    css_admin_credit_order(
      company_id: $companyId
      number: $number
      actor_company_user_id: $actorCompanyUserId
    ) {
      ${DETAIL_ORDER_FIELDS}
    }
  }
`;

const APPROVE_MUTATION = /* GraphQL */ `
  mutation AdminApproveCreditOrder($input: CssAdminCreditOrderActionInput!) {
    cssAdminApproveCreditOrder(input: $input) { ${CORE_ORDER_FIELDS} }
  }
`;

const REJECT_MUTATION = /* GraphQL */ `
  mutation AdminRejectCreditOrder($input: CssAdminCreditOrderActionInput!) {
    cssAdminRejectCreditOrder(input: $input) { ${CORE_ORDER_FIELDS} }
  }
`;

const CANCEL_MUTATION = /* GraphQL */ `
  mutation AdminCancelCreditOrder($input: CssAdminCreditOrderActionInput!) {
    cssAdminCancelCreditOrder(input: $input) { ${CORE_ORDER_FIELDS} }
  }
`;

const PLACE_MUTATION = /* GraphQL */ `
  mutation AdminPlaceCreditOrder($input: CssAdminCreditOrderActionInput!) {
    cssAdminPlaceCreditOrder(input: $input) { ${CORE_ORDER_FIELDS} }
  }
`;

const COMMENT_MUTATION = /* GraphQL */ `
  mutation AdminAddCreditOrderComment($input: CssAdminCreditOrderCommentInput!) {
    cssAdminAddCreditOrderComment(input: $input) { ${DETAIL_ORDER_FIELDS} }
  }
`;

export async function getAdminCreditOrders(
  companyId: number,
  currentPage = 1,
  pageSize = 20,
  statuses: string[] = [],
  search?: string,
  actorCompanyUserId?: number | null,
) {
  const data = await graphqlRequest<
    ListData,
    {
      companyId: number;
      currentPage: number;
      pageSize: number;
      statuses: string[] | null;
      search: string | null;
      actorCompanyUserId: number | null;
    }
  >(ADMIN_CREDIT_ORDERS_QUERY, {
    companyId,
    currentPage,
    pageSize,
    statuses: statuses.length ? statuses : null,
    search: search?.trim() || null,
    actorCompanyUserId: actorCompanyUserId ?? null,
  });

  return data.css_admin_credit_orders;
}

function isMissingCreditOrderItemsField(error: unknown): error is GraphQLRequestError {
  // Fall back only for the exact optional Query field. Authorization, network,
  // resolver and unrelated schema errors must continue to fail visibly.
  return error instanceof GraphQLRequestError
    && error.errors.length > 0
    && error.errors.every(({ message }) =>
      /Cannot query field ["']css_admin_credit_order_items["'] on type ["']Query["']/.test(message),
    );
}

export async function getAdminCreditOrder(
  companyId: number,
  number: string,
  actorCompanyUserId?: number | null,
) {
  const variables: DetailVariables = {
    companyId,
    number,
    actorCompanyUserId: actorCompanyUserId ?? null,
  };

  try {
    const data = await graphqlRequest<DetailData, DetailVariables>(ADMIN_CREDIT_ORDER_QUERY, variables);
    return {
      ...data.css_admin_credit_order,
      items: data.css_admin_credit_order_items,
    };
  } catch (error) {
    if (!isMissingCreditOrderItemsField(error)) throw error;

    // Some Magento installations have the core Fluid credit-order contract but
    // have not deployed the separate frozen-item resolver. Keep the detail page
    // usable without silently misrepresenting missing items as an empty order.
    const data = await graphqlRequest<DetailWithoutItemsData, DetailVariables>(
      ADMIN_CREDIT_ORDER_WITHOUT_ITEMS_QUERY,
      variables,
    );
    return {
      ...data.css_admin_credit_order,
      items: null,
    };
  }
}

async function actionMutation(
  mutation: string,
  field: keyof ActionData,
  input: AdminCreditOrderActionInput,
) {
  const data = await graphqlRequest<ActionData, { input: AdminCreditOrderActionInput }>(mutation, { input });
  const result = data[field];
  if (!result) throw new Error("Credit-order mutation returned no result.");
  return result;
}

export function approveAdminCreditOrder(input: AdminCreditOrderActionInput) {
  return actionMutation(APPROVE_MUTATION, "cssAdminApproveCreditOrder", input);
}

export function rejectAdminCreditOrder(input: AdminCreditOrderActionInput) {
  return actionMutation(REJECT_MUTATION, "cssAdminRejectCreditOrder", input);
}

export function cancelAdminCreditOrder(input: AdminCreditOrderActionInput) {
  return actionMutation(CANCEL_MUTATION, "cssAdminCancelCreditOrder", input);
}

export function placeAdminCreditOrder(input: AdminCreditOrderActionInput) {
  return actionMutation(PLACE_MUTATION, "cssAdminPlaceCreditOrder", input);
}

export async function addAdminCreditOrderComment(input: AdminCreditOrderCommentInput) {
  const data = await graphqlRequest<ActionData, { input: AdminCreditOrderCommentInput }>(COMMENT_MUTATION, { input });
  if (!data.cssAdminAddCreditOrderComment) throw new Error("Credit-order comment mutation returned no result.");
  return data.cssAdminAddCreditOrderComment;
}
