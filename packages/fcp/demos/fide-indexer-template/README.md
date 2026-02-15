# Fide Indexer Template

**Tail Rekor (default) or ingest filesystem artifacts** and materialize to Postgres.

This template is intentionally independent of any specific attestor repo path.

| Command | Description |
|---------|-------------|
| `pnpm index` | Run indexer in default `rekor` mode (poll Rekor tiles + advance cursor) |
| `pnpm index:rekor` | Explicit Rekor mode |
| `pnpm index:filesystem` | Filesystem mode (verify statement-attestations + materialize statements) |
| `pnpm index:discover` | Discover GitHub repos by topic (default: `fide-context-registry`) and save to `.state` |
| `pnpm schema:reset` | DROP + CREATE schema (prompts for confirmation; use `--yes` to skip) |
| `pnpm reset` | Clear `fcp_raw_identifiers` and `fcp_statements` |

## Source Modes

### 1) Rekor mode (default)

- `FCP_INDEXER_SOURCE_MODE=rekor`
- Polls Rekor v2 checkpoints + entry bundles (`/checkpoint`, `/tile/entries/...`)
- Stores cursor at:
  - `packages/fcp/demos/fide-indexer-template/.state/rekor-cursor.json` (default)
- If no cursor exists, first run auto-bootstraps to a recent window (targeting ~24h) and then continues incrementally.

Optional env:

- `REKOR_BASE_URL` (default `https://log2025-1.rekor.sigstore.dev`)
- `FCP_REKOR_CURSOR_PATH` (default above)
- `REKOR_TIMEOUT_MS` (default `20000`)

Note: Rekor mode is fully independent and tails transparency entries only. It does not persist candidate files; it only updates cursor and logs candidate counts.

Topic cross-reference behavior:

- After running `index:discover`, `index:rekor` also checks DSSE entries whose verifier includes an x509 cert identity and matches discovered `OWNER/REPO`.
- This requires keyless GitHub OIDC signing (cert-based verifier). Local self-managed key submissions (public-key verifier only) will not match repo identity.

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
pnpm demo:fide-indexer-template:discover
pnpm demo:fide-indexer-template:rekor
```

Or for filesystem ingestion:

```bash
FCP_STATEMENT_ATTESTATIONS_PATH=... FCP_STATEMENTS_PATH=... pnpm demo:fide-indexer-template:filesystem
```

Discovery output path:

- `packages/fcp/demos/fide-indexer-template/.state/github-topic-repos.json`

Optional discovery env:

- `FCP_REGISTRY_TOPIC` (default `fide-context-registry`)
- `GITHUB_TOKEN` (recommended to avoid anonymous GitHub API rate limits)
- `FCP_DISCOVER_MAX_PAGES` (default `5`)
