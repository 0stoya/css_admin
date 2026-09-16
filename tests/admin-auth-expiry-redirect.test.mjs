import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("admin graphql authorization uses one-shot session recovery without throwing NEXT_REDIRECT inside execute", () => {
  const client = source("lib/graphql/client.ts");
  assert.match(client, /graphql-authorization/);
  assert.match(client, /hasAdminAuthRetryMarker/);
  assert.match(
    client,
    /if \(authorizationRejected && !\(await hasAdminAuthRetryMarker\(\)\)\) \{[\s\S]*throw new GraphQLRequestError/,
  );
  assert.match(client, /session-expired\?reason=authorization/);
  assert.doesNotMatch(
    client,
    /if \(authorizationRejected && !\(await hasAdminAuthRetryMarker\(\)\)\) \{\s*redirect\(/,
  );
});

test("authorization-triggered session expiry leaves a short retry marker", () => {
  const session = source("lib/session.ts");
  const route = source("app/api/auth/session-expired/route.ts");

  assert.match(session, /css_admin_auth_retry/);
  assert.match(session, /ADMIN_AUTH_RETRY_SECONDS = 300/);
  assert.match(session, /setAdminAuthRetryMarker/);
  assert.match(route, /reason/);
  assert.match(route, /authorization/);
  assert.match(route, /setAdminAuthRetryMarker/);
  assert.match(route, /\/login\?reason=expired/);
});
