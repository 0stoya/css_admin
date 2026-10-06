import { getMagentoConfig } from "@/lib/config";
import { GraphQLRequestError, type GraphQLErrorItem } from "@/lib/graphql/client";
import {
  logMagentoGraphqlTiming,
  magentoGraphqlSignal,
} from "@/lib/graphql/runtime";
import { getCompanyToken } from "@/lib/session";

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
    throw new GraphQLRequestError("Company-user authentication is required.", [], 401, "company");
  }

  const { graphqlUrl, storeCode } = getMagentoConfig();
  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Store: storeCode,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: magentoGraphqlSignal(),
    });
  } catch {
    logMagentoGraphqlTiming({
      scope: "company",
      query,
      startedAt,
      outcome: "network-error",
    });
    throw new GraphQLRequestError("Magento GraphQL is unavailable.", [], 503, "company");
  }

  if (!response.ok) {
    logMagentoGraphqlTiming({
      scope: "company",
      query,
      startedAt,
      outcome: "http-error",
      status: response.status,
    });
    throw new GraphQLRequestError(
      `Magento GraphQL returned HTTP ${response.status}.`,
      [],
      response.status,
      "company",
    );
  }

  const body = (await response.json()) as GraphQLResponse<TData>;
  if (body.errors?.length) {
    logMagentoGraphqlTiming({
      scope: "company",
      query,
      startedAt,
      outcome: "graphql-error",
      status: response.status,
    });
    throw new GraphQLRequestError(body.errors[0]?.message || "GraphQL request failed.", body.errors, undefined, "company");
  }
  if (!body.data) {
    logMagentoGraphqlTiming({
      scope: "company",
      query,
      startedAt,
      outcome: "no-data",
      status: response.status,
    });
    throw new GraphQLRequestError("Magento GraphQL returned no data.", [], undefined, "company");
  }

  logMagentoGraphqlTiming({
    scope: "company",
    query,
    startedAt,
    outcome: "ok",
    status: response.status,
  });

  return body.data;
}
