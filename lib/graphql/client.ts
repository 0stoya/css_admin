import { getMagentoConfig } from "@/lib/config";
import { getAdminToken } from "@/lib/session";

export type GraphQLErrorItem = {
  message: string;
  extensions?: {
    category?: string;
    [key: string]: unknown;
  };
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLErrorItem[];
};

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    public readonly errors: GraphQLErrorItem[] = [],
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GraphQLRequestError";
  }
}

async function execute<TData, TVariables extends Record<string, unknown>>(
  query: string,
  variables: TVariables,
) {
  const token = await getAdminToken();
  if (!token) {
    throw new GraphQLRequestError("Admin authentication is required.");
  }

  const { graphqlUrl, storeCode } = getMagentoConfig();
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Store: storeCode,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GraphQLRequestError(`Magento GraphQL returned HTTP ${response.status}.`, [], response.status);
  }

  const body = (await response.json()) as GraphQLResponse<TData>;
  return body;
}

export async function graphqlRequest<TData, TVariables extends Record<string, unknown>>(
  query: string,
  variables: TVariables,
) {
  const body = await execute<TData, TVariables>(query, variables);

  if (body.errors?.length) {
    throw new GraphQLRequestError(body.errors[0]?.message || "GraphQL request failed.", body.errors);
  }
  if (!body.data) {
    throw new GraphQLRequestError("Magento GraphQL returned no data.");
  }

  return body.data;
}

export async function graphqlPartialRequest<TData, TVariables extends Record<string, unknown>>(
  query: string,
  variables: TVariables,
) {
  return execute<TData, TVariables>(query, variables);
}

export function graphQLErrorMessage(error: unknown) {
  if (error instanceof GraphQLRequestError) {
    const category = error.errors[0]?.extensions?.category;
    return category ? `${error.message} (${category})` : error.message;
  }
  return error instanceof Error ? error.message : "Unexpected backend error.";
}
