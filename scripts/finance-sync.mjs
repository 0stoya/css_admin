#!/usr/bin/env node

/* global process, console */

import { existsSync } from "node:fs";
import {
  extractOglCustomers,
  fetchDirectOglFinance,
  finishFinanceSyncRun,
  getDirectOglFinanceConfig,
  mapWithConcurrency,
  oglRequest,
  openFinanceDatabase,
  saveDirectOglFinanceSnapshot,
  startFinanceSyncRun,
} from "./finance-sync-lib.mjs";

if (!process.env.CSS_ADMIN_OGL_API_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
} else if (!process.env.CSS_ADMIN_OGL_API_URL && existsSync(".env.production")) {
  process.loadEnvFile(".env.production");
}

function parseArgs(argv) {
  const options = {
    cref: null,
    limit: null,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--cref") {
      options.cref = argv[index + 1]?.trim() || null;
      index += 1;
      continue;
    }

    if (arg.startsWith("--cref=")) {
      options.cref = arg.slice("--cref=".length).trim() || null;
      continue;
    }

    if (arg === "--limit") {
      options.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }

  return options;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function discoverCustomers(config, options) {
  if (options.cref) {
    return [{ cref: options.cref, name: null, stopped: false }];
  }

  const rows = await oglRequest("customers", config);
  const customers = extractOglCustomers(rows);
  return options.limit ? customers.slice(0, options.limit) : customers;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getDirectOglFinanceConfig();
  const customers = await discoverCustomers(config, options);

  if (!customers.length) {
    throw new Error("OGL returned no customer CREFs to sync.");
  }

  let sql = null;
  let runId = null;
  let runFinished = false;

  if (!options.dryRun) {
    sql = openFinanceDatabase();
    runId = await startFinanceSyncRun(sql);
  }

  try {
    const results = await mapWithConcurrency(
      customers,
      config.concurrency,
      async (customer) => {
        const summary = await fetchDirectOglFinance(customer.cref, config);

        if (!options.dryRun) {
          await saveDirectOglFinanceSnapshot(sql, summary);
        }

        return {
          cref: customer.cref,
          name: customer.name,
          stopped: customer.stopped,
          summary,
        };
      },
    );

    const successes = [];
    const failures = [];

    results.forEach((result, index) => {
      const customer = customers[index];
      if (result.status === "fulfilled") {
        successes.push(result.value);
        return;
      }

      const failure = {
        cref: customer.cref,
        message: errorText(result.reason),
      };
      failures.push(failure);
      console.error(`[finance-sync] ${failure.cref}: ${failure.message}`);
    });

    const status = failures.length === 0
      ? "PASS"
      : successes.length > 0
        ? "PARTIAL"
        : "FAIL";

    if (!options.dryRun) {
      await finishFinanceSyncRun(sql, runId, {
        status,
        customersDiscovered: customers.length,
        companiesSynced: successes.length,
        failures,
      });
      runFinished = true;
    }

    const output = {
      status,
      dry_run: options.dryRun,
      customers_discovered: customers.length,
      companies_synced: successes.length,
      companies_failed: failures.length,
      concurrency: config.concurrency,
      sample: successes.slice(0, 3).map(({ cref, name, stopped, summary }) => ({
        cref,
        name,
        stopped,
        year: summary.year,
        year_to_date: summary.year_to_date,
        last_365_days: summary.last_365_days,
        last_order_date: summary.last_order_date,
        refreshed_at: summary.refreshed_at,
      })),
      failures: failures.slice(0, 10),
    };

    console.log(JSON.stringify(output, null, 2));

    if (status === "FAIL") process.exitCode = 1;
    else if (status === "PARTIAL") process.exitCode = 2;
  } catch (error) {
    if (sql && runId !== null && !runFinished) {
      try {
        await finishFinanceSyncRun(sql, runId, {
          status: "FAIL",
          customersDiscovered: customers.length,
          companiesSynced: 0,
          failures: [{ cref: "*", message: errorText(error) }],
        });
      } catch (finishError) {
        console.error(`[finance-sync] could not record failed run: ${errorText(finishError)}`);
      }
    }

    throw error;
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(`[finance-sync] fatal: ${errorText(error)}`);
  process.exitCode = 1;
});
