# Critique 20: Hybrid Data Availability (Git + Irys + Subsquid)

> Status: **Brainstorm / mental checkpoint only.**
>
> We are **not** moving forward with this architecture right now. The current plan is to stick with **Supabase** as the primary storage/query layer. If someone else wants to run their own Postgres-backed indexer, we can share the migration SQL/scripts so they can materialize the same tables/views in their own database.




----------------------------------------------




## Summary

FCP’s core primitives are **immutable, content-addressed Statements** (S‑P‑O) and **cryptographic Attestations** that prove authorship over one or many Statements.

This critique pivots from a “Git‑primary” model to a **Hybrid Data Availability (DA)** model:

- **Git for onboarding & iteration** (excellent DX, mutable)
- **Irys/Arweave for permanence & ordering** (immutable, timestamped)
- **Subsquid for standardized indexing** (replace bespoke pull/index scripts)

The goal is to improve **ordering**, **availability**, and **operational safety** without sacrificing developer ergonomics.

## What A Statement Is

A Statement is a canonical S‑P‑O assertion. It never changes; corrections are represented as new Statements (e.g., via a `replaces` relationship) rather than mutation.

Statements are content‑addressed:

- Preimage: canonical JSON of S/P/O identifiers (RFC 8785 canonical JSON; constrained schema recommended).
- ID: `keccak256(preimage)` → tail for fingerprint → `0x00...` (Statement entity id).

Immutability is structural: the Statement ID *is* the content hash.

## What An Attestation Is

An Attestation is the cryptographic wrapper proving authorship. One Attestation can cover **many Statements**:

1. Compute deterministic Statement IDs for drafted statements.
2. Build a Merkle tree over those Statement IDs.
3. Sign the Merkle root (plus signer/method metadata).

Verification:

- Verify signature over root.
- Verify inclusion of a specific Statement ID via Merkle proof.

## The Hybrid Storage Model (DA Layer)

### Tier 1: Git (Onboarding & Mutable)

- Role: the drafting table.
- Author action: `git push` signed JSONL payloads.
- Pros: familiar DX, free, forkable, auditable diffs.
- Cons: mutable history, unreliable timestamps, weak canonical ordering.

### Tier 2: Irys/Arweave (Sovereign & Permanent)

- Role: ledger of record.
- Author action: upload signed payload to Irys (direct or via relayer).
- Mechanism: Irys bundles → Arweave settlement.
- Pros: immutable, durable, trustless timestamps.
- Cost: low per payload (operator + network dependent).

#### Irys → Arweave settlement

Irys is best thought of as a **payment + bundling + UX layer**: you publish to Irys, and Irys settles bundles to Arweave. The permanence and “single shared DA” properties come from **Arweave**, not from any single indexer or Git host.

### The Preservation Bridge (Relayer)

A service that watches Git registries, validates new attestations, and publishes them to Irys.

This upgrades “Git‑available” data to “permanent DA” without forcing authors to learn new tooling on day one.

## Indexing: Subsquid (sqd)

We move away from bespoke “git pull + local verify + custom DB schema” flows.

Subsquid decouples:

1. **Ingest (firehose):** watch Irys tags (e.g., `App-Name: FideProtocol`) and optionally Git registries; write raw data to a lake.
2. **Process (validator):** validate signatures/schemas; apply allow/block policies; emit normalized rows.
3. **Serve (API):** write into PostgreSQL (via `schema.graphql`) and expose query APIs.

This makes indexing reproducible and reduces bespoke operational burden.

### Multi-transport ingestion (Git + Irys)

Subsquid is useful here because the “processor” is just code: it can ingest from **multiple transports** and normalize everything into one indexed state.

In a hybrid FCP deployment, the processor can:

- **Ingest Git registries** for fast onboarding and iteration (mutable, easy to publish).
- **Ingest Irys/Arweave** for permanence and stronger ordering signals (immutable, timestamped).
- **Deduplicate by content** (attestation identifier / content hash), not by location (repo/path).
- **Track transport metadata** (where it was found, when it was observed) without changing the underlying Statement/Attestation primitives.

This enables a simple policy:

- If an attestation appears on the permanent DA layer, prefer its permanent timestamp as the strongest “no later than” signal.
- If it only exists in Git so far, it can still be indexed for discovery, but treated as “not yet permanent” until it shows up on the DA layer.

Storage becomes the shared substrate; indexing becomes replaceable infrastructure.

### Indexing freedom

Once payloads are on the permanent DA layer, **anyone** can index the same underlying data:

- self-hosted indexers (Subsquid or custom)
- third-party indexing services
- competing public APIs

Storage becomes a shared substrate; indexing becomes replaceable infrastructure.

## Ordering & Timestamping

Git commit timestamps are not a cryptographic clock, and history can be rewritten.

In the hybrid model:

- **Irys timestamps are the canonical “no later than” signal** for published attestations when present.
- Git remains a practical discovery/onboarding transport, but is not the ordering root of truth.

This reduces (or eliminates) the need for a separate L2 “anchor root of roots” in v1.

## Compliance & “The Indexer’s Burden”

Permanent storage cannot delete bytes. Indexers still control what they *serve*.

Practical mitigation:

- **Protocol‑level blocklists** (IDs to ignore).
- Takedown = add ID to blocklist → indexer removes from query state (Postgres) → compliance on the read path.

## Data Model Mapping (Conceptual)

| Core Table | Role |
|---|---|
| `fcp_raw_identifiers` | Fingerprint → raw identifier (string) lookup |
| `fcp_statements` | Statement triple store (S‑P‑O) |
| `fcp_alias_resolution` | Indexer optimization: alias → primary mapping |

Attestation metadata can remain derivable from core triples, or be promoted to a first‑class materialized entity depending on indexing needs.

## Updated Answers to Open Questions

1. **Authoritative sequencing?** Hybrid: Irys timestamp is strongest when available; Git is onboarding transport.
2. **“First‑seen” definition?** Earliest valid timestamp across transports the indexer trusts (Irys preferred).
3. **Registry‑of‑registries?** Not required; discovery can be driven by Irys tags and Git topics.
4. **Owner vs payer?** The signer is the identity that matters for authorship; the transport payer/relayer is secondary metadata.

## UI / Product Implications

- Git registries remain the fastest way for developers to start publishing.
- Applications can prefer Irys‑published data when available for stronger ordering guarantees.
- Indexers converge on standardized ingestion + processing pipelines.
