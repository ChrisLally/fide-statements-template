# Fide Attestor Template

**Write statements → Sign batch (Ed25519) → Write artifacts** under `.fide/`.

Creates statements, signs batches with Ed25519 (zero-dependency), and writes:

- `.fide/statements/YYYY/MM/DD/{merkleRoot}.jsonl` (one statement per line)
- `.fide/statement-attestations/YYYY/MM/DD/{YYYY-MM-DD-HHmm}-{attestationIdShort}.jsonl` (one attestation line per file)
- `.fide/rekor-proofs/YYYY/MM/DD/` (reserved for Rekor artifacts)

| Command | Description |
|---------|-------------|
| `pnpm seed` | Seed test statements, sign with Ed25519, write `.fide/statements` and `.fide/statement-attestations` |

## Setup

1. Optional path overrides:
   - `FCP_STATEMENTS_PATH` (defaults to `.fide/statements`)
   - `FCP_STATEMENT_ATTESTATIONS_PATH` (defaults to `.fide/statement-attestations`)
   - `FCP_REKOR_PROOFS_PATH` (defaults to `.fide/rekor-proofs`)
   - `FCP_ATTESTATIONS_PATH` (legacy fallback for statement-attestations)
2. Run from repo root: `pnpm --filter fide-attestor-template seed`

Env loading order: repo root `.env` first, then `demos/fide-attestor-template/.env` overrides.

## Usage

```bash
pnpm --filter fide-attestor-template seed
```

## Signing

Uses **Ed25519** (native Web Crypto API, no viem). For Ethereum/wallet flows, use EIP-712 in your own app.

By default, `.fide/statements/`, `.fide/statement-attestations/`, and `.fide/rekor-proofs/` are committed (public).
