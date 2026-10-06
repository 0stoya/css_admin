import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("production nginx enables HTTP/2 and preserves streaming", () => {
  const nginx = source("deploy/nginx/admin.csscdn.co.uk.conf");

  assert.match(nginx, /listen 443 ssl http2;/);
  assert.match(nginx, /listen \[::\]:443 ssl http2;/);
  assert.match(nginx, /proxy_buffering off;/);
});
