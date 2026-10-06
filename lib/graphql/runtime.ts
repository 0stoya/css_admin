const DEFAULT_TIMEOUT_MS = 15000;
const MAX_TIMEOUT_MS = 60000;

function configuredPositiveInteger(name: string, fallback: number, max: number) {
  const parsed = Number(process.env[name] ?? "");
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) return fallback;
  return parsed;
}

export function magentoGraphqlTimeoutMs() {
  return configuredPositiveInteger("MAGENTO_GRAPHQL_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
}

export function magentoGraphqlSignal() {
  return AbortSignal.timeout(magentoGraphqlTimeoutMs());
}

function graphQLOperationName(query: string) {
  return query.match(/\b(?:query|mutation)\s+([A-Za-z0-9_]+)/)?.[1] || "AnonymousGraphQL";
}

function timingThresholdMs() {
  const parsed = Number(process.env.MAGENTO_GRAPHQL_TIMING_THRESHOLD_MS ?? "0");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function logMagentoGraphqlTiming(input: {
  scope: "admin" | "company";
  query: string;
  startedAt: number;
  outcome: string;
  status?: number;
}) {
  if (process.env.MAGENTO_GRAPHQL_TIMING !== "1") return;

  const elapsedMs = Date.now() - input.startedAt;
  if (elapsedMs < timingThresholdMs()) return;

  const statusText = typeof input.status === "number" ? ` http=${input.status}` : "";
  console.info(
    `[magento:gql] scope=${input.scope} operation=${graphQLOperationName(input.query)} elapsed_ms=${elapsedMs} outcome=${input.outcome}${statusText}`,
  );
}
