import pg from "pg";
import { getPgConnectionUrl } from "../lib/db.js";
import { loadDemoEnv } from "../lib/env.js";

loadDemoEnv();

async function main() {
  const url = getPgConnectionUrl();
  if (!url) throw new Error("Missing PG connection URL");
  const client = new pg.Client({
    connectionString: url,
  });
  await client.connect();

  const statsCount = await client.query("SELECT COUNT(*) FROM fcp_statements");
  const identCount = await client.query("SELECT COUNT(*) FROM fcp_raw_identifiers");
  console.log(`Raw Stats: ${statsCount.rows[0].count}, Raw Idents: ${identCount.rows[0].count}`);

  const idents = await client.query("SELECT * FROM fcp_raw_identifiers");
  console.log("\nRaw Identifiers:");
  console.table(idents.rows);

  const stats = await client.query("SELECT s.*, ri.raw_identifier FROM fcp_statements s JOIN fcp_raw_identifiers ri ON s.predicate_fingerprint = ri.identifier_fingerprint");
  console.log("\nStatements (with predicate name and type):");
  console.table(stats.rows.map(s => ({
    subj: s.subject_fingerprint.slice(-6),
    pred: s.raw_identifier,
    type: s.predicate_type,
    obj: s.object_fingerprint.slice(-6)
  })));

  const edges = await client.query(`
      SELECT s.subject_fingerprint, s.object_fingerprint
      FROM fcp_statements s
      INNER JOIN fcp_raw_identifiers pred ON pred.identifier_fingerprint = s.predicate_fingerprint
      WHERE pred.raw_identifier = 'https://www.w3.org/2002/07/owl#sameAs'
    `);
  console.log("\nRaw sameAs Edges in DB:");
  console.table(edges.rows);

  console.log("\n=== FULL MATERIALIZED VIEW CONTENTS ===");
  const fullView = await client.query(`
      SELECT 
        statement_fingerprint,
        subject_fingerprint_original,
        subject_fingerprint,
        subject_raw_identifier_original,
        subject_raw_identifier,
        subject_type_original,
        subject_type,
        subject_source_type_original,
        subject_source_type,
        predicate_raw_identifier,
        object_fingerprint_original,
        object_fingerprint,
        object_raw_identifier_original,
        object_raw_identifier
      FROM fcp_statements_identifiers_resolved
      ORDER BY statement_fingerprint
    `);
  console.table(fullView.rows);

  console.log("--- Alice Resolution Check ---");
  const res = await client.query(`
    SELECT 
      subject_raw_identifier_original,
      subject_raw_identifier,
      predicate_raw_identifier,
      object_raw_identifier
    FROM fcp_statements_identifiers_resolved
    WHERE subject_raw_identifier_original LIKE '%alice%'
    OR object_raw_identifier_original LIKE '%alice%'
    ORDER BY subject_raw_identifier_original, predicate_raw_identifier;
  `);

  console.table(res.rows);

  // Check if x.com/alice and github.com/alice have the same resolved raw identifier
  const aliceRes = res.rows.filter(r => r.predicate_raw_identifier === 'http://schema.org/name');
  console.log("\nResolved Names for Alice:");
  aliceRes.forEach(r => {
    console.log(`- Original: ${r.subject_raw_identifier_original} -> Resolved: ${r.subject_raw_identifier}`);
  });

  await client.end();
}

main().catch(console.error);
