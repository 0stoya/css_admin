import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const STAGE_DIR = process.env.CSS_ADMIN_BULK_IMPORT_STAGE_DIR?.trim()
  || "/tmp/css-admin-bulk-import";
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_BYTES = 10 * 1024 * 1024;

function stagedPath(token: string) {
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error("Bulk import preview token is invalid.");
  }
  return join(STAGE_DIR, `${token}.csv`);
}

async function ensureStageDir() {
  await mkdir(STAGE_DIR, { recursive: true, mode: 0o700 });
}

async function cleanupExpired() {
  await ensureStageDir();
  const now = Date.now();
  const entries = await readdir(STAGE_DIR, { withFileTypes: true }).catch(() => []);

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.csv$/.test(entry.name)) return;
    const path = join(STAGE_DIR, entry.name);
    try {
      const metadata = await stat(path);
      if (now - metadata.mtimeMs > MAX_AGE_MS) {
        await rm(path, { force: true });
      }
    } catch {
      // A concurrent cleanup/read may already have removed the file.
    }
  }));
}

export async function stageBulkImportCsv(source: string) {
  await cleanupExpired();

  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes <= 0 || bytes > MAX_BYTES) {
    throw new Error("CSV files are limited to 10 MB.");
  }

  const token = randomBytes(32).toString("hex");
  await writeFile(stagedPath(token), source, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  return token;
}

export async function readStagedBulkImportCsv(token: string) {
  await cleanupExpired();

  const path = stagedPath(token);
  let metadata;
  try {
    metadata = await stat(path);
  } catch {
    throw new Error("Bulk import preview expired. Preview the CSV again.");
  }

  if (Date.now() - metadata.mtimeMs > MAX_AGE_MS) {
    await rm(path, { force: true });
    throw new Error("Bulk import preview expired. Preview the CSV again.");
  }
  if (metadata.size <= 0 || metadata.size > MAX_BYTES) {
    throw new Error("Staged bulk import is invalid.");
  }

  const source = await readFile(path, "utf8");
  if (Buffer.byteLength(source, "utf8") > MAX_BYTES) {
    throw new Error("Staged bulk import is invalid.");
  }
  return source;
}
