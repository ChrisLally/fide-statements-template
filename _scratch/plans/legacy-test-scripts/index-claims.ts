/**
 * FCP Index Attestations Script
 *
 * Indexes FCP attestations from the local attestations directory into the database.
 * This script calls the existing FCP playground indexing logic.
 *
 * The indexing process:
 * 1. Ingests attestations from fide/attestations/ directory
 * 2. Verifies EIP-712 signatures
 * 3. Extracts Fide IDs and statements
 * 4. Materializes into fcp_raw_identifiers and fcp_statements tables
 * 5. Views automatically expose pattern-specific queries (attestations, statements, relationships, etc.)
 *
 * Usage: pnpm fcp:i
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { ingestAttestations } from '@/lib/fcp/indexer/ingest'
import { verifyAttestation } from '@/lib/fcp/indexer/verify'
import { materializeAttestationStandalone } from '@/lib/fcp/indexer/materialize'
import { runAllTests } from '@/lib/fcp/test/runner'

dotenv.config({ path: '../../.env' })

// Initialize Supabase service role client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseKey)
}

// Re-export the indexing logic with service role client
async function indexAttestations(client: ReturnType<typeof createClient<Database>>): Promise<{
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Record<string, number>;
  skippedReasons: Record<string, number>;
}> {

  // Ingest attestations
  const attestations = await ingestAttestations();

  const stats = {
    total: attestations.length,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: {} as Record<string, number>,
    skippedReasons: {} as Record<string, number>
  };

  // Process each attestation
  for (const attestation of attestations) {
    try {
      // Verify signature
      const verified = await verifyAttestation(attestation);

      if (!verified.isValid) {
        stats.failed++;
        const reason = `Invalid signature: ${verified.error || 'Unknown error'}`;
        stats.errors[reason] = (stats.errors[reason] || 0) + 1;
        continue;
      }

      // Materialize to Supabase using standalone function
      const result = await materializeAttestationStandalone(verified, client);

      if (result.success) {
        stats.successful++;
      } else {
        if (result.error?.includes('already indexed')) {
          stats.skipped++;
          const reason = result.error;
          stats.skippedReasons[reason] = (stats.skippedReasons[reason] || 0) + 1;
        } else {
          stats.failed++;
          const reason = result.error || 'Unknown error';
          stats.errors[reason] = (stats.errors[reason] || 0) + 1;
        }
      }
    } catch (error) {
      stats.failed++;
      const reason = error instanceof Error ? error.message : 'Unknown error';
      stats.errors[reason] = (stats.errors[reason] || 0) + 1;
    }

    stats.processed++;
  }

  // Refresh materialized view after all attestations are indexed
  if (stats.successful > 0) {
    try {
      console.log('\n🔄 Refreshing materialized view...');
      await client.rpc('refresh_fcp_statements_identifiers_resolved');
      console.log('✅ Materialized view refreshed');
    } catch (error) {
      console.warn('⚠️  Failed to refresh materialized view:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  return stats;
}

async function main() {
  try {
    console.log('🚀 Starting FCP attestation indexing...\n');

    const client = getSupabaseClient();
    const stats = await indexAttestations(client);

    console.log('\n📊 Indexing Results:');
    console.log(`Total attestations found: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Successful: ${stats.successful}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Skipped: ${stats.skipped}`);

    if (Object.keys(stats.errors).length > 0) {
      console.log('\n❌ Errors:');
      Object.entries(stats.errors).forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
    }

    if (Object.keys(stats.skippedReasons).length > 0) {
      console.log('\n⏭️  Skipped Reasons:');
      Object.entries(stats.skippedReasons).forEach(([reason, count]) => {
        console.log(`  ${reason}: ${count}`);
      });
    }

    if (stats.successful > 0) {
      console.log('\n✅ FCP attestation indexing complete!');

      // Run post-index tests
      console.log('\n');
      await runAllTests(client);
    } else if (stats.total === 0) {
      console.log('\nℹ️  No attestations found to index.');
    } else {
      console.log('\n⚠️  Indexing completed with issues. Check errors above.');
    }

  } catch (error) {
    console.error('❌ FCP indexing failed:', error);
    process.exit(1);
  }
}

main();
