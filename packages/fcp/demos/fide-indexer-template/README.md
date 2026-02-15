# Fide Indexer Template

**Tail Rekor (default) or ingest filesystem artifacts** and materialize to Postgres.

This template is intentionally independent of any specific attestor repo path.

| Command | Description |
|---------|-------------|
| `pnpm index` | Run indexer in default `rekor` mode (poll Rekor tiles + advance cursor) |
| `pnpm index:rekor` | Explicit Rekor mode |
| `pnpm index:filesystem` | Filesystem mode (verify statement-attestations + materialize statements) |
| `pnpm schema:reset` | DROP + CREATE schema (prompts for confirmation; use `--yes` to skip) |
| `pnpm reset` | Clear `fcp_raw_identifiers` and `fcp_statements` |

## Source Modes

### 1) Rekor mode (default)

- `FCP_INDEXER_SOURCE_MODE=rekor`
- Polls Rekor v2 checkpoints + entry bundles (`/checkpoint`, `/tile/entries/...`)
- Stores cursor at:
  - `packages/fcp/demos/fide-indexer-template/.state/rekor-cursor.json` (default)

Optional env:

- `REKOR_BASE_URL` (default `https://log2025-1.rekor.sigstore.dev`)
- `FCP_REKOR_CURSOR_PATH` (default above)
- `REKOR_TIMEOUT_MS` (default `20000`)

Note: Rekor mode tails transparency entries and updates cursor. To materialize FCP statements, the indexer must also be able to retrieve attestation artifacts and statement batches.

### 2) Filesystem mode

- `FCP_INDEXER_SOURCE_MODE=filesystem`
- Required env:
  - `FCP_STATEMENT_ATTESTATIONS_PATH` (or `FCP_ATTESTATIONS_PATH`)
  - `FCP_STATEMENTS_PATH`

In this mode, the indexer:

1. Loads the latest statement-attestation file
2. Loads matching statements by Merkle root
3. Verifies signature + Merkle root
4. Materializes to Postgres (`fcp_raw_identifiers`, `fcp_statements`)

## Database Setup

Use one of:

- `DATABASE_URL=postgresql://user:password@host:5432/database`
- `PG_HOST`, `PG_USER`, `PG_PASSWORD` (and optionally `PG_PORT`, `PG_DATABASE`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (schema:reset still requires direct Postgres URL)

Env loading order: repo root `.env` first, then `demos/fide-indexer-template/.env` overrides.

## Usage

From repo root:

```bash
pnpm demo:fide-indexer-template:rekor
```

Or for filesystem ingestion:

```bash
FCP_STATEMENT_ATTESTATIONS_PATH=... FCP_STATEMENTS_PATH=... pnpm demo:fide-indexer-template:filesystem
```
