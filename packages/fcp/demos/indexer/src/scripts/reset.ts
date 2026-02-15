/**
 * Reset FCP tables
 *
 * Clears fcp_statements and fcp_raw_identifiers.
 *
 * Env: Option A — DATABASE_URL
 *      Option B — PG_HOST, PG_USER, PG_PASSWORD (etc.)
 *      Option C — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: pnpm reset
 */

import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  getPgConnectionUrl,
  getSupabaseConfig,
} from "../lib/db.js";
import { loadDemoEnv } from "../lib/env.js";

loadDemoEnv();

async function main() {
  console.log("🔄 Resetting FCP tables...\n");

  const pgUrl = getPgConnectionUrl();
  const supabase = getSupabaseConfig();

  if (pgUrl) {
    const pool = new Pool({ connectionString: pgUrl });
    try {
      console.log("Clearing fcp_statements...");
      await pool.query(
        "DELETE FROM fcp_statements WHERE statement_fingerprint >= $1",
        [""]
      );
      console.log("✓ Cleared fcp_statements");

      console.log("Clearing fcp_raw_identifiers...");
      await pool.query(
        "DELETE FROM fcp_raw_identifiers WHERE identifier_fingerprint >= $1",
        [""]
      );
      console.log("✓ Cleared fcp_raw_identifiers");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("does not exist") || msg.includes("relation")) {
        console.log("ℹ Tables do not exist (run migrations first)");
      } else {
        throw err;
      }
    } finally {
      await pool.end();
    }
  } else if (supabase) {
    const client = createClient(supabase.url, supabase.key);
    console.log("Clearing fcp_statements...");
    const { error: e1 } = await client
      .from("fcp_statements")
      .delete()
      .gte("statement_fingerprint", "");
    if (e1 && e1.code !== "PGRST116" && e1.code !== "PGRST204") {
      console.warn("⚠ Could not clear fcp_statements:", e1.message);
    } else {
      console.log("✓ Cleared fcp_statements");
    }

    console.log("Clearing fcp_raw_identifiers...");
    const { error: e2 } = await client
      .from("fcp_raw_identifiers")
      .delete()
      .gte("identifier_fingerprint", "");
    if (e2 && e2.code !== "PGRST116" && e2.code !== "PGRST204") {
      console.warn("⚠ Could not clear fcp_raw_identifiers:", e2.message);
    } else {
      console.log("✓ Cleared fcp_raw_identifiers");
    }
  } else {
    throw new Error(
      "Missing database config. Set either:\n" +
        "  A) DATABASE_URL\n" +
        "  B) PG_HOST, PG_USER, PG_PASSWORD\n" +
        "  C) SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  console.log("\n✅ Reset complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
