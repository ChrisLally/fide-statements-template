# Indexer

**Pull from registry → Verify → Materialize** to Postgres.

Pulls attestations from a Fide attestation registry (e.g., GitHub repo with `fide-attestation-registry` topic, or local `demos/attestor/.fide/attestations/`), verifies signatures, and materializes into `fcp_raw_identifiers` and `fcp_statements`.

| Command | Description |
|---------|-------------|
| `pnpm schema:reset` | DROP + CREATE schema (prompts for confirmation; use `--yes` to skip) |
| `pnpm index` | Ingest attestations → verify → materialize → refresh views |
| `pnpm reset` | Clear `fcp_raw_identifiers` and `fcp_statements` |

## Setup

**Database** — use one of:

- **A) Full URL:** `DATABASE_URL` = `postgresql://user:password@host:5432/database`
- **B) Parts:** `PG_HOST`, `PG_USER`, `PG_PASSWORD` (and optionally `PG_PORT`, `PG_DATABASE`)
- **C) Supabase:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (schema:reset requires direct Postgres URL)

1. Set database env vars in `.env`
2. Run `pnpm schema:reset` (once at setup) to create tables and materialized view
3. Configure registry source (local dir or Git URL)

Env loading order: repo root `.env` first, then `demos/indexer/.env` overrides.

## Usage

```bash
pnpm --filter indexer index
```
