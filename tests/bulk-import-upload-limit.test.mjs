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
  assert.match(nginx, /proxy_read_timeout 300s;/);
  assert.match(nginx, /proxy_send_timeout 300s;/);
});

test("bulk import keeps an explicit application-level file limit", () => {
  const actions = source("app/(admin)/bulk-import/actions.ts");

  assert.match(actions, /value\.size > MAX_FILE_BYTES/);
  assert.match(actions, /TextEncoder\(\)\.encode\(source\)\.byteLength > MAX_FILE_BYTES/);
});

test("large bulk CSV source stays server-side between Preview and Apply", () => {
  const actions = source("app/(admin)/bulk-import/actions.ts");
  const workspace = source("components/bulk-import-workspace.tsx");
  const staging = source("lib/bulk-import-staging.ts");

  assert.match(actions, /stageBulkImportCsv\(source\)/);
  assert.match(actions, /readStagedBulkImportCsv\(token\)/);
  assert.match(actions, /sourceCsv:\s*""/);
  assert.match(actions, /sourceToken/);
  assert.doesNotMatch(workspace, /name="sourceCsv"/);
  assert.match(workspace, /name="sourceToken"/);

  assert.match(staging, /randomBytes\(32\)\.toString\("hex"\)/);
  assert.match(staging, /MAX_AGE_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(staging, /mode:\s*0o600/);
  assert.match(staging, /Bulk import preview expired/);
});
