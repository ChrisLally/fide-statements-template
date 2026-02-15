/**
 * FCP Reset Script
 * Clears all FCP (Fide Context Protocol) tables
 *
 * Pure Triple Model:
 * - fcp_raw_identifiers: Fingerprint ↔ Raw Identifier lookup
 * - fcp_statements: Core statements (Subject-Predicate-Object as fingerprints)
 * - All views (attestations, statements, relationships, etc.) derived from core tables
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

async function resetFCPTables() {
  // Initialize Supabase admin client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey)

  console.log('🔄 Resetting FCP tables...')

  // Pure Triple Model has 2 core tables:
  // 1. fcp_statements (delete first due to FK constraints)
  // 2. fcp_raw_identifiers (delete last)
  //
  // NOTE: No separate attestation junction table - PROV-O Triangle (Statement → wasGeneratedBy → Attestation)
  // handles attestation-statement relationships now
  // NOTE: fcp_alias_resolution table no longer exists - Evaluation-based trust via owl:sameAs (Critique 21)

  // Delete statements (has FK constraints to identifiers)
  console.log('Clearing fcp_statements...')
  const { error: statementsError } = await supabase
    .from('fcp_statements')
    .delete()
    .gte('statement_fingerprint', '')  // All fingerprints are >= empty string (matches all rows)
  if (statementsError) {
    if (statementsError.code !== 'PGRST116' && statementsError.code !== 'PGRST204') {
      console.warn('⚠️ Could not clear fcp_statements:', statementsError.message)
    } else {
      console.log('ℹ️ fcp_statements table does not exist (will be created on migration)')
    }
  } else {
    console.log('✓ Cleared fcp_statements table')
  }

  // Delete identifiers
  console.log('Clearing fcp_raw_identifiers...')
  const { error: identifiersError } = await supabase
    .from('fcp_raw_identifiers')
    .delete()
    .gte('identifier_fingerprint', '')  // All fingerprints are >= empty string (matches all rows)
  if (identifiersError) {
    if (identifiersError.code !== 'PGRST116' && identifiersError.code !== 'PGRST204') {
      console.warn('⚠️ Could not clear fcp_raw_identifiers:', identifiersError.message)
    } else {
      console.log('ℹ️ fcp_raw_identifiers table does not exist (will be created on migration)')
    }
  } else {
    console.log('✓ Cleared fcp_raw_identifiers table')
  }

  console.log('✓ FCP tables reset complete')
}

async function main() {
  try {
    console.log('🚀 Starting FCP reset...\n')

    await resetFCPTables()

    console.log('\n✅ FCP reset complete!')
    console.log('💡 Next steps:')
    console.log('  - Run migration: psql -f scripts/supabase/manual-migrations/fcp-indexer-supabase.sql')
    console.log('  - Seed attestations: pnpm fcp:s')
    console.log('  - Index attestations: pnpm fcp:i\n')
  } catch (error) {
    console.error('❌ FCP reset failed:', error)
    process.exit(1)
  }
}

main()
