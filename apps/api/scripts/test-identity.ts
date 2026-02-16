/**
 * Test script for identity resolve endpoint and DB connectivity.
 * Run: pnpm test:identity (from repo root) or npx tsx scripts/test-identity.ts (from apps/api)
 */
import 'dotenv/config';
import { pgClient } from '@fide.work/db';

const BASE = process.env.API_BASE ?? 'http://localhost:3001';
const TIMEOUT_MS = 15000;

async function main() {
  console.log('Testing FCP API at', BASE, '\n');

  // 1. Health check (no DB)
  console.log('1. GET /v1/health');
  try {
    const healthRes = await fetch(`${BASE}/v1/health`, { signal: AbortSignal.timeout(5000) });
    const healthJson = await healthRes.json();
    console.log('   OK:', healthJson);
  } catch (err) {
    console.error('   FAIL:', err);
    console.log('\n   Is the API running? Try: pnpm dev:api');
    console.log('   If port 3001 is in use: lsof -i :3001');
    process.exit(1);
  }

  // 2. DB connectivity (through @fide.work/db package)
  console.log('\n2. DB connectivity');
  try {
    await pgClient`select 1`;
    console.log('   OK: Connected');
  } catch (err) {
    console.error('   FAIL:', err);
    console.log('   Identity endpoint needs DB. Ensure packages/db/.env has DATABASE_URL.');
  }

  // 3. Identity resolve (by parts: entityType + sourceType + rawIdentifier)
  console.log('\n3. POST /v1/identity/resolve');
  const payload = { entityType: 'Person', sourceType: 'Product', rawIdentifier: 'https://x.com/alice' };
  try {
    const res = await fetch(`${BASE}/v1/identity/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = await res.json();
    console.log('   Status:', res.status);
    console.log('   Response:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('   FAIL:', err);
    if (err instanceof Error && err.name === 'TimeoutError') {
      console.log('\n   Timeout - API may be waiting on DB.');
      console.log('   Ensure: 1) API running (pnpm dev:api), 2) DB reachable');
    }
    process.exit(1);
  }

  console.log('\nDone.');
}

main();
