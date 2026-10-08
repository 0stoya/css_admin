import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("bulk imports allow 10 MiB CSVs with transport headroom", () => {
  const actions = source("app/(admin)/bulk-import/actions.ts");
  const config = source("next.config.ts");
  const nginx = source("deploy/nginx/admin.csscdn.co.uk.conf");

  assert.match(actions, /MAX_FILE_BYTES = 10 \* 1024 \* 1024/);
  assert.match(actions, /CSV files are limited to 10 MB\./);
  assert.match(config, /serverActions:\s*\{[\s\S]*bodySizeLimit:\s*"16mb"/);
  assert.match(nginx, /client_max_body_size 16m;/);
});

test("bulk import keeps an explicit application-level file limit", () => {
  const actions = source("app/(admin)/bulk-import/actions.ts");

  assert.match(actions, /value\.size > MAX_FILE_BYTES/);
  assert.match(actions, /TextEncoder\(\)\.encode\(source\)\.byteLength > MAX_FILE_BYTES/);
});
