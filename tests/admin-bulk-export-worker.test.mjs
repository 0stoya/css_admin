import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import load from "./helpers/load-typescript.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const csv = load(root, "lib/csv.ts");
const shared = load(root, "lib/bulk-export-csv.ts", { "./csv": csv });

function loadWorker() {
  const path = new URL("../worker/bulk-export-csv.ts", import.meta.url);
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: fileURLToPath(path),
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(output, {
    module: mod, exports: mod.exports, Buffer,
    console: { log() {} },
    require(specifier) {
      if (specifier === "node:fs/promises") return requireFs;
      if (specifier === "node:path") return { join };
      if (specifier === "../lib/bulk-export-csv") return shared;
      throw new Error("Unexpected worker dependency: " + specifier);
    },
  }, { filename: fileURLToPath(path) });
  return mod.exports.runBulkCsvExport;
}

const requireFs = { open: async (...args) => (await import("node:fs/promises")).open(...args),
  unlink: async (...args) => (await import("node:fs/promises")).unlink(...args) };
const runBulkCsvExport = loadWorker();
const UUID_A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const UUID_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

function company(id) {
  return {
    company_id: id, reference: "E" + id, parent_company_id: null,
    name: "Company " + id, status: true, sales_representative_id: null,
  };
}

function job(ids = [1, 2], kind = "bulk_users") {
  return {
    id: UUID_A, run_token: UUID_B, export_kind: kind,
    company_ids: ids, root_company_id: ids[0], total_companies: ids.length,
  };
}

function deps(dir, overrides = {}) {
  const completed = [];
  const finished = [];
  const base = {
    exportDir: dir,
    stopped: () => false,
    getServiceCompanies: async () => [company(1), company(2)],
    getManagement: async companyId => ({
      company_id: companyId, resources: [], roles: [],
      users: [{
        firstname: "John", lastname: "Smith", email: "JOHN@example.com",
        roles: [{ name: "Buyer" }],
      }],
    }),
    getControls: async (id) => ({
      company_id: id, role_controls: [],
      company_catalog: { product_restriction: true, allowed_product_skus: ["A", "B"] },
      purchase_controls: { templates: [] },
    }),
    getDescription: async id => "Description " + id,
    heartbeat: async count => { completed.push(count); },
    finish: async (name, size) => { finished.push({ name, size }); return true; },
    ...overrides,
  };
  return { config: base, completed, finished };
}

async function privateDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "css-admin-bulk-job-test-"));
  try { await fn(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test("worker writes a real private CSV with BOM, legacy newlines, progress, and finish", async () => {
  await privateDir(async dir => {
    const { config, completed, finished } = deps(dir);
    await runBulkCsvExport(job(), config);
    assert.deepEqual(completed, [1, 2]);
    assert.equal(finished.length, 1);
    const path = join(dir, UUID_A + "-" + UUID_B + ".csv");
    const file = await readFile(path);
    assert.equal(finished[0].size, file.byteLength);
    assert.equal(file.toString("utf8"),
      "\uFEFFfirst_name,last_name,email,role,company_ref\r\n" +
      "John,Smith,john@example.com,Buyer,E1\r\n" +
      "John,Smith,john@example.com,Buyer,E2\r\n");
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  });
});

test("large SKU export exceeds worker buffer but remains complete and ordered", async () => {
  await privateDir(async dir => {
    const skus = Array.from({ length: 14000 }, (_, i) => "SKU-" + String(i).padStart(6, "0"));
    const { config, completed } = deps(dir, {
      getServiceCompanies: async () => [company(1)],
      getControls: async () => ({
        company_id: 1, role_controls: [],
        company_catalog: { product_restriction: true, allowed_product_skus: skus },
      }),
    });
    await runBulkCsvExport(job([1], "bulk_company_products"), config);
    const file = await readFile(join(dir, UUID_A + "-" + UUID_B + ".csv"), "utf8");
    assert.ok(file.startsWith("\uFEFFsku,company_ref\r\nSKU-000000,E1\r\n"));
    assert.ok(file.endsWith("SKU-013999,E1\r\n"));
    assert.deepEqual(completed, [1]);
    assert.equal(file.split("\r\n").length, skus.length + 2);
  });
});

test("read failure removes private partial CSV and never publishes ready", async () => {
  await privateDir(async dir => {
    const { config, completed, finished } = deps(dir, {
      getManagement: async id => {
        if (id === 2) throw new Error("company 2 is unavailable");
        return {
          company_id: id, resources: [], roles: [], users: [
            { firstname: "One", lastname: "User", email: "one@example.com", roles: [] },
          ],
        };
      },
    });
    await assert.rejects(runBulkCsvExport(job(), config), /company 2 is unavailable/);
    assert.deepEqual(completed, [1]);
    assert.equal(finished.length, 0);
    assert.deepEqual(await readdir(dir), []);
  });
});

test("lease loss after file sync removes artifact instead of publishing", async () => {
  await privateDir(async dir => {
    const { config } = deps(dir, { finish: async () => false });
    await assert.rejects(runBulkCsvExport(job(), config), /lost its export-job lease/);
    assert.deepEqual(await readdir(dir), []);
  });
});

test("worker refuses to export revoked or missing company IDs before file creation", async () => {
  await privateDir(async dir => {
    const { config } = deps(dir, { getServiceCompanies: async () => [company(1)] });
    await assert.rejects(runBulkCsvExport(job(), config), /no longer visible/);
    assert.deepEqual(await readdir(dir), []);
  });
});
