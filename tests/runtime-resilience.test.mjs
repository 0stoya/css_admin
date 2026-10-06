import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin and company GraphQL calls use bounded upstream requests with optional timing", () => {
  const runtime = source("lib/graphql/runtime.ts");
  const adminClient = source("lib/graphql/client.ts");
  const companyClient = source("lib/graphql/customer-client.ts");

  assert.match(runtime, /MAGENTO_GRAPHQL_TIMEOUT_MS/);
  assert.match(runtime, /MIN_TIMEOUT_MS = 1000/);
  assert.match(runtime, /MAX_TIMEOUT_MS = 60000/);
  assert.match(runtime, /AbortSignal\.timeout/);
  assert.match(runtime, /MAGENTO_GRAPHQL_TIMING/);
  assert.match(adminClient, /signal:\s*magentoGraphqlSignal\(\)/);
  assert.match(companyClient, /signal:\s*magentoGraphqlSignal\(\)/);
  assert.match(adminClient, /Magento GraphQL is unavailable/);
  assert.match(companyClient, /Magento GraphQL is unavailable/);
});

test("health route is dependency-free and explicitly non-cacheable", () => {
  const health = source("app/api/health/route.ts");

  assert.match(health, /status:\s*"ok"/);
  assert.match(health, /service:\s*"css-admin"/);
  assert.match(health, /Cache-Control/);
  assert.doesNotMatch(health, /fetch\(/);
  assert.doesNotMatch(health, /getLocalPostgres/);
});

test("PM2 bounds memory and backs off restart loops", () => {
  const ecosystem = source("ecosystem.config.cjs");

  assert.match(ecosystem, /max_memory_restart:\s*"768M"/);
  assert.match(ecosystem, /exp_backoff_restart_delay:\s*100/);
});
