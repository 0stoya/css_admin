import { redirect } from "next/navigation";
import { getMagentoConfig } from "@/lib/config";
import {
  logMagentoGraphqlTiming,
  magentoGraphqlSignal,
} from "@/lib/graphql/runtime";
import { getAdminToken, hasAdminAuthRetryMarker } from "@/lib/session";

export type GraphQLErrorItem = {
  message: string;
  extensions?: {
    category?: string;
    [key: string]: unknown;
  };
};

export type GraphQLSessionKind = "admin" | "company";

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLErrorItem[];
};

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    public readonly errors: GraphQLErrorItem[] = [],
    public readonly status?: number,
    public readonly sessionKind: GraphQLSessionKind = "admin",
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
    throw new GraphQLRequestError("Admin authentication is required.", [], 401);
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
      scope: "admin",
      query,
      startedAt,
      outcome: "network-error",
    });
    throw new GraphQLRequestError("Magento GraphQL is unavailable.", [], 503);
  }

  if (!response.ok) {
    logMagentoGraphqlTiming({
      scope: "admin",
      query,
      startedAt,
      outcome: "http-error",
      status: response.status,
    });
    throw new GraphQLRequestError(`Magento GraphQL returned HTTP ${response.status}.`, [], response.status);
  }

  const body = (await response.json()) as GraphQLResponse<TData>;
  const authorizationRejected = body.errors?.some(
    (error) => error.extensions?.category === "graphql-authorization",
  );
  if (authorizationRejected && !(await hasAdminAuthRetryMarker())) {
    logMagentoGraphqlTiming({
      scope: "admin",
      query,
      startedAt,
      outcome: "authorization-rejected",
      status: response.status,
    });
    throw new GraphQLRequestError(
      body.errors?.[0]?.message || "Admin authorization failed.",
      body.errors ?? [],
      401,
      "admin",
    );
  }

  logMagentoGraphqlTiming({
    scope: "admin",
    query,
    startedAt,
    outcome: body.errors?.length ? "graphql-error" : "ok",
    status: response.status,
  });

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
    if (error.status === 401) {
      const authorizationRejected = error.errors.some(
        (item) => item.extensions?.category === "graphql-authorization",
      );
      redirect(
        error.sessionKind === "company"
          ? "/api/auth/session-expired?mode=company"
          : authorizationRejected
            ? "/api/auth/session-expired?reason=authorization"
            : "/api/auth/session-expired",
      );
    }

    const category = error.errors[0]?.extensions?.category;
    return category ? `${error.message} (${category})` : error.message;
  }
  return error instanceof Error ? error.message : "Unexpected backend error.";
}
