import { getMagentoConfig } from "@/lib/config";
import { getCompanyToken } from "@/lib/session";
import { GraphQLRequestError, type GraphQLErrorItem } from "@/lib/graphql/client";

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLErrorItem[];
};

export async function customerGraphqlRequest<TData, TVariables extends Record<string, unknown>>(
  query: string,
  variables: TVariables,
) {
  const token = await getCompanyToken();
  if (!token) {
    throw new GraphQLRequestError("Company-user authentication is required.", [], 401);
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
  if (body.errors?.length) {
    throw new GraphQLRequestError(body.errors[0]?.message || "GraphQL request failed.", body.errors);
  }
  if (!body.data) {
    throw new GraphQLRequestError("Magento GraphQL returned no data.");
  }

  return body.data;
}
