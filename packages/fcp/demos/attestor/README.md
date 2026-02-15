# Attestor

**Write → Sign (Ed25519) → Write** to `demos/attestor/.fide/attestations/`.

Creates statements, signs batches with Ed25519 (zero-dependency), writes JSONL to the attestations directory. The indexer demo reads from this path.

| Command | Description |
|---------|-------------|
| `pnpm seed` | Seed test statements, sign with Ed25519, write to `demos/attestor/.fide/attestations/` |

## Setup

1. Set `FCP_ATTESTATIONS_PATH` to override the default (defaults to `demos/attestor/.fide/attestations`)
2. Run from repo root: `pnpm --filter attestor seed`

Env loading order: repo root `.env` first, then `demos/attestor/.env` overrides.

## Usage

```bash
pnpm --filter attestor seed
```

## Signing

Uses **Ed25519** (native Web Crypto API, no viem). For Ethereum/wallet flows, use EIP-712 in your own app.
