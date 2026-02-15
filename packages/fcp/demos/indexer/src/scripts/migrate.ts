/**
 * Reset database schema (DROP + CREATE)
 *
 * Run ONLY at initial setup or when schema changes. Wipes all tables and data.
 * Executes migrations/schema.sql — drops fcp_statements, fcp_raw_identifiers,
 * and the materialized view, then recreates them.
 *
 * Requires a direct Postgres connection (DATABASE_URL or PG_* env vars).
 * Supabase REST config alone is not sufficient — use the project's Postgres URL.
 *
 * Usage: pnpm schema:reset
 *        pnpm schema:reset --yes  (skip confirmation, for CI)
 */

import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { getPgConnectionUrl } from "../lib/db.js";
import { loadDemoEnv } from "../lib/env.js";
import { FIDE_EVALUATION_METHODS } from "@fide.work/fcp";

loadDemoEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

function askConfirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function main() {
  const skipConfirm = process.argv.includes("--yes");

  if (!skipConfirm) {
    console.log("⚠ This will DROP and recreate fcp_statements, fcp_raw_identifiers, and the materialized view.");
    console.log("  All data will be lost.\n");
    const confirmed = await askConfirm("Type 'yes' to continue: ");
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  const url = getPgConnectionUrl();
  if (!url) {
    throw new Error(
      "Missing Postgres config. Set DATABASE_URL or PG_HOST + PG_USER + PG_PASSWORD"
    );
  }

  const schemaPath = join(__dirname, "../../migrations/schema.sql");
  let sql = await readFile(schemaPath, "utf-8");

  // Inject evaluation method URLs from SDK
  sql = sql.replace("{{FIDE_OWL_SAMEAS_PERSON_V1}}", FIDE_EVALUATION_METHODS.owlSameAsPerson);
  sql = sql.replace("{{FIDE_OWL_SAMEAS_ORGANIZATION_V1}}", FIDE_EVALUATION_METHODS.owlSameAsOrganization);

  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(sql);
    console.log("✅ Schema reset complete (with injected evaluation methods).");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
