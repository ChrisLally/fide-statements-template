# Critique 23: Off-Chain ID Math and Signature Agility (v1)

**Date**: 2026-02-07
**Decision**: Adopt SHA-256 for v1 Fide ID derivation (off-chain-first), keep signature-method agility, and lock v1 math before release
**Status**: ✅ Approved (Pre-release execution plan)

## Context

We are pre-release and off-chain-first.  
Fide IDs are not currently intended for on-chain recomputation, so EVM hash parity is optional.

## Final Position

### 1. ID Derivation (v1)

For v1, we standardize on:
- Hash: **SHA-256**
- Fingerprint: **last 19 bytes** (38 hex chars)
- Shape: `did:fide:0x{type}{source}{fingerprint}`

Why:
- No dependency on EVM-specific hashing
- Better standard-library portability across runtimes
- Cleaner lightweight SDK story for agents

### 2. Signature Strategy (separate concern)

Attestation signatures remain method-agnostic:
- Protocol stores method + signer + root/message + signature
- Verifiers decide supported methods by policy

Initial method set for v1:
- `eip155` + message signing
- extension path for `ed25519:raw`, `webauthn:p256`, and others

### 3. Architecture Rule

Identity math and signing math are decoupled:
- `calculateFideId` uses SHA-256
- Attestation signatures can still be EIP-712/signMessage or non-EVM methods

## What We Will Update Now

### A. Documentation

- Fix inconsistencies:
  - global search for `Keccak` in docs
  - replace with `SHA-256` except in EIP-712 signing sections (which should keep Keccak references)
  - explicitly verify `identifiers.mdx` and generated/reference docs like `fcp.txt`
- Add explicit **ID Derivation Invariant (v1)**:
  - SHA-256
  - last 19 bytes
  - deterministic statement rawIdentifier handling before `calculateFideId`
- Add **Signature Method Registry**:
  - supported methods
  - verifier policy model
  - extension rules
- Add explicit note: **Fide IDs are off-chain protocol identifiers; on-chain recomputation is not a v1 requirement**

### B. Code

- Update `calculateFideId` implementation to SHA-256 (all supported SDK/runtime implementations)
- Refactor verifier routing to use `signatureMethod` + signer namespace
- Add method allowlist/policy gate in verifier config
- Add tests for:
  - deterministic ID outputs from shared vectors
  - cross-language parity (TS + Python vectors)
  - unicode/emoji inputs (e.g., `Alice 🚀`)
  - empty/whitespace inputs
  - supported/unsupported signature methods

### C. Data and Migrations (pre-release reset allowed)

- Regenerate seeded IDs, evaluation method IDs, and derived statement IDs under SHA-256
- Rebuild local/test attestations and re-index
- Update SQL/docs/comments that reference Keccak-derived constants

### D. Freeze Rule (pre-launch)

- Lock v1 algorithm and fingerprint extraction before public release:
  - no silent algorithm swaps after freeze
  - any future algorithm change requires explicit versioned strategy

## What We Will Not Change in This Critique

- We are not adding on-chain Fide ID derivation requirements for v1
- We are not introducing `did:fide:v2` now
- We are not coupling ID derivation to EVM constraints

## Optional Future Path (only if needed)

If we later need on-chain interoperability:
- define a versioned profile/namespace strategy
- provide dual-derivation tooling and migration guidance
- avoid retroactive reinterpretation of v1 IDs

## Implementation Checklist

### Must Do (Pre-release)
- [ ] Docs cleanup: global grep for `Keccak` and replace with `SHA-256` except EIP-712 signing sections
- [ ] Decision log: add "Why SHA-256 for v1?" rationale to project docs (ADR, CHANGELOG, or inline in `identifiers.mdx`)
- [ ] Publish v1 ID derivation invariant (SHA-256 + last-19-bytes)
- [ ] Update `identifiers.mdx`: replace Keccak references with SHA-256 and update code samples to `crypto.subtle` (JS) and `hashlib` (Python) for zero-dependency examples
- [ ] Update all SDK/runtime `calculateFideId` paths to SHA-256
- [ ] Regenerate seed/method/statement-derived IDs for v1 test data
- [ ] Publish signature method registry and verifier policy rules
- [ ] Add golden vectors for deterministic cross-language parity in `test/fixtures/id-derivation-vectors.json` (used by all SDK implementations)

### Defer
- [ ] Versioned profile for optional on-chain alignment (if demanded later)

## Bottom Line

For v1, we optimize for off-chain protocol utility:
- **SHA-256 IDs**
- **deterministic cross-runtime portability**
- **agile signature verification**

This keeps the system lightweight and coherent for pre-release launch without importing unnecessary on-chain constraints.
