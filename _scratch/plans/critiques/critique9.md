# FCP Schema Critique: critique9 (The Dual-ID Model)

*Draft: 2026-01-20*

---

## Executive Summary

Critique8 established the **Unified Envelope Model** where every interaction is a signed `FideClaimEnvelope`. However, it conflated the identity of the *fact* with the identity of the *signature*.

**Note on Protocol Refinement:** This critique represents a **Clean Slate** refinement. It intentionally breaks backward compatibility with previous versions to achieve semantic precision and cryptographic robustness. There is no legacy support for critique8; this is the new baseline for the FCP implementation.

---

## Formulas

All ID derivations in FCP use the single primitive `deriveFideId()`:

**Primitive:**
```
deriveFideId(input) = "0x" + last20Bytes(keccak256(toBytes(input)))
```

**Entity ID Formulas:**
```
anchorFideId (Standard) = deriveFideId(standard)           // e.g., deriveFideId("schema:Person"), deriveFideId("iso-639-3:eng")
anchorFideId (Direct String) = deriveFideId(string)         // e.g., deriveFideId("https://x.com/alice"), deriveFideId("https://x.com/alice")
anchorFideId (UUID) = deriveFideId(uuid)                    // e.g., deriveFideId("550e8400-e29b-41d4-a716-446655440000")
anchorFideId (CryptographicAccount) = deriveFideId(signer)
where signer = "fide:CryptographicAccount:" + rawAddress
statementFideId = deriveFideId( hash32(subjectFideId) + hash32(predicate) + hash32(objectFideId) )
attestationFideId = deriveFideId(signerSignature)
claimFideId = deriveFideId(attestationFideId + "_" + index)
```

Where:
- `hash32(x)` = `keccak256(toBytes(x))` (produces a 32-byte hash)
- `signer` is the namespaced account identifier (e.g., `"fide:CryptographicAccount:0x1234..."` for EVM, `"fide:CryptographicAccount:bc1q..."` for Bitcoin)
- `subjectFideId` and `objectFideId` are Fide IDs (hex addresses like `0x...`) that can be:
  - **Anchor Entities**: Any of the following:
    - **Standards**: `deriveFideId("schema:Person")`, `deriveFideId("iso-639-3:eng")` - For shared, immutable concepts
    - **Direct Strings**: `deriveFideId("https://x.com/alice")`, `deriveFideId("https://x.com/alice")`, `deriveFideId("@alice")`, `deriveFideId("PROD-12345")` - For mutable/emergent identifiers that can be used as `subjectFideId`
    - **UUIDs**: `deriveFideId(uuid)` - For truly random/private entities with no external identifier
    - **CryptographicAccounts**: `deriveFideId("fide:CryptographicAccount:" + rawAddress)` - For cryptographic keypairs
  - **Statement Entities**: Content-addressed facts (see `statementFideId` formula above)
  - **Attestation Entities**: Signature-addressed events (see `attestationFideId` formula above)
  - **Claim Entities**: Index-addressed links (see `claimFideId` formula above)
- `predicate` is a string (e.g., `"schema:name"` or `"keywords"`)

**Account Identity (Universal Account Model):**
- **Key-Centric Identity**: The entity ID is derived from the raw address (`0xAlice`) rather than chain-specific identifiers (`eip155:1:0xAlice`).
- **Cross-Chain Unification**: The same address on Ethereum, Optimism, and Base maps to the same `signerFideId`, preserving cross-chain reputation.
- **Namespace Storage**: The `signer` field stores the full namespace (`fide:CryptographicAccount:0xAlice`). The indexer derives `signerFideId` directly from this value, then strips the namespace prefix when verifying signatures against the raw address.

**Entity Creation Model:**
- **Anchor Entities** (`anchorFideId`): **Explicitly created** by deriving a Fide ID from:
  - **Standards** (e.g., `deriveFideId("schema:Person")`): For shared, immutable concepts
  - **Direct Strings** (e.g., `deriveFideId("https://x.com/alice")`): For mutable/emergent identifiers like emails, phone numbers, social handles, SKUs that can be used as `subjectFideId`
  - **UUIDs** (e.g., `deriveFideId(uuid)`): For truly random/private entities with no external identifier
  - **CryptographicAccounts** (e.g., `deriveFideId("fide:CryptographicAccount:0x...")`): For cryptographic keypairs
- **Statement, Attestation, and Claim Entities**: **Emergent/computed** by the indexer from claim content, signatures, and array positions.

**Note:** Because everything in FCP is an entity with a Fide ID, any entity type can be used as a `subjectFideId` or `objectFideId`, enabling recursive claims (claims about claims about claims).

**Reference Implementation (Viem):**
```typescript
import { keccak256, toBytes, slice } from 'viem';
const deriveFideId = (input: string): `0x${string}` => {
  return slice(keccak256(toBytes(input)), 12) as `0x${string}`;
};
```

---

## 1. The Problem: Fragmented Consensus

### 1.1 The Current Model (critique8)

In critique8, the Envelope ID is derived from the signer's signature:

```typescript
attestationFideId = deriveFideId(signerSignature)
```

This means: **Two people asserting the exact same thing get different IDs.**

### 1.2 Why This Breaks Consensus

**Scenario:** Three attestors independently verify that Batch #55 is "Organic."

| Attestor | Attestation ID | Statement Content |
|---------|---------------|-------------------|
| Attestor A | `0xaaa...` | `{ subject: "0xBatch55", predicate: "keywords", object: "Organic" }` |
| Attestor B | `0xbbb...` | `{ subject: "0xBatch55", predicate: "keywords", object: "Organic" }` |
| Attestor C | `0xccc...` | `{ subject: "0xBatch55", predicate: "keywords", object: "Organic" }` |

**The Problem:**
- Each attestor's attestation lives at a different address.
- There is no single point in the graph where we can count: *"3 attestors agree on this."*
- Consensus is fragmented across three unrelated attestation IDs.

### 1.3 The Bundle Problem (Bonus Fragmentation)

Even worse, if attestors bundle independent claims differently:

- **Attestor A:** `{ "Organic", "Fair Trade" }` → `0xaaa...`
- **Attestor B:** `{ "Organic" }` → `0xbbb...`

**The Result:** If we derive IDs from bundles, the graph thinks these are two completely different facts. You cannot query "Who measured Organic?" and get both auditors. You have fragmented consensus again.

---

## 2. The Solution: The Dual-ID Model

Every claim in FCP has **two distinct identifiers**. See the [Formulas](#formulas) section for complete derivation rules and the [SDK Helper Functions](#82-sdk-changes-helper-functions) section for implementation details.

| Entity Category | Name | Purpose |
|---------------|------|---------|
| **Anchor Entity** | `anchorFideId` | The **subject** (Person, Org, Place, Spec, etc.) |
| **Statement Entity** | `statementFideId` | The **fact** (Content-addressed anchor) |
| **Attestation Entity** | `attestationFideId` | The **act** (Signature-addressed signing event) |
| **Claim Entity** | `claimFideId` | The **link** (Specific instance for revocations) |

### 2.1 The Hierarchy of Entities

FCP adopts a unified "Everything is an Entity" model. This ensures universal addressability and allows the graph to be infinitely recursive (e.g., making a claim *about* a statement).

**Entity Creation Model:**
- **Anchor Entities**: **Explicitly created** by users/agents. You derive a Fide ID from:
  - **Standards** (e.g., `deriveFideId("schema:Person")`): For shared, immutable concepts
  - **Direct Strings** (e.g., `deriveFideId("https://x.com/alice")`): For mutable/emergent identifiers like emails, phone numbers, social handles, SKUs that can be used as `subjectFideId`
  - **UUIDs** (e.g., `deriveFideId(uuid)`): For truly random/private entities with no external identifier
  - **CryptographicAccounts** (e.g., `deriveFideId("fide:CryptographicAccount:0x...")`): For cryptographic keypairs
- **Statement, Attestation, and Claim Entities**: **Emergent/computed** by the indexer. These IDs are automatically derived from the content of claims, signatures, and array positions—you don't explicitly create them.

| Concept | Entity Category | Definition | Creation Model |
| --- | --- | --- | --- |
| **The Noun** | **Anchor Entity** | The subject matter (Person, Org, Place, Spec). The **hooks** of the graph. | **Explicit** (user derives from standard/direct string/UUID/account) |
| **The Fact** | **Statement Entity** | A reified fact. Content-addressed. | **Emergent** (indexer derives from claim content) |
| **The Act** | **Attestation Entity** | A signed event. Signature-addressed. | **Emergent** (indexer derives from signature) |
| **The Link** | **Claim Entity** | A specific instance. Index-addressed link for revocations. | **Emergent** (indexer derives from attestation + index) |

#### 2.1.1 Semantic Types (Anchor Entities)
While Statement, Attestation, and Claim entities have their types defined structurally by their ID derivation, **Anchor Entities** require explicit semantic typing. 

**Canonical Registry:** The [**Entity Types (`types.mdx`)**](/docs/fcp/entities/types) page is the official specification for the protocol's reserved `fide:*` namespace. 

*   Implementation code (indexers/SDKs) **MUST** treat `types.mdx` as the source of truth for valid Standard Anchor URNs.
*   When creating an Anchor Entity, you assign it one of the Strict Entity Types defined in the registry (e.g., `schema:Person`, `schema:Organization`, `fide:AutonomousAgent`).

**Type Assertion Pattern:**
To claim an entity is a person, you use:
- **Predicate:** `schema:type` (from Schema.org standard vocabulary)
- **Object:** `deriveFideId("schema:Person")` (from Schema.org)

**Example:**
```
Subject: 0xAlice → Predicate: schema:type → Object: deriveFideId("schema:Person")
```

**Namespace Distinction:**
- **`schema:type`**: Predicate from Schema.org (used to assert type relationships)
- **`schema:Person`**: Object from Schema.org (used as the type value for people)
- **`fide:AutonomousAgent`**: Object from FCP's namespace (used for types not in Schema.org)

**Note:** These semantic types apply *only* to Anchor Entities. You do not assign a `schema:type` claim with object `schema:Person` to a Statement or Attestation.

#### 2.1.2 Namespace Philosophy: Flat URNs (The Slot Architecture)

FCP intentionally avoids hierarchical nesting (e.g., `fide:type:Person`) in favor of a **Flat Namespace** (`schema:Person`). This is a defensive design decision validated by semantic web best practices and based on two critical principles:

1.  **The Slot Architecture**: The protocol relies on the **position** within the Fide Triple (Subject, Predicate, Object) to define a term's function. This is the standard way to manage flat namespaces in semantic systems (like RDF or OWL).
    *   **`schema:Person`** (a Noun/Anchor) is used in the **Object** slot with the `schema:type` predicate.
        *   Example: `Subject: 0xAlice` → `Predicate: schema:type` → `Object: deriveFideId("schema:Person")`
    *   **`fide:reasoning`** (a Verb/Predicate) is used in the **Predicate** slot.
        *   Example: `Subject: 0xAction` → `Predicate: fide:reasoning` → `Object: "I thought..."`
    
    Because these categories occupy different "slots" in the triple structure, they cannot collide technically. The **position** defines the function, eliminating the need for hierarchical prefixes like `fide:type:person` or `fide:pred:reasoning`.

2.  **Avoiding Taxonomy Rot**: Hierarchical names bake a specific classification theory into the URN itself. If a class is labeled `fide:anchor:person`, that URN becomes technically inaccurate if the protocol's internal taxonomy evolves. 
    *   **Today:** You might think "Person is an Anchor."
    *   **Tomorrow:** You might realize "Person is also a Legal Subject."
    *   **The Trap:** If you baked `anchor` into the name, you are stuck with a legacy classification. 
    
    A flat URN (like `schema:Person`) is **semantically immutable**—it remains a valid reference for the concept regardless of how high-level graph theory changes.

**Canonical Registries:**
- **`types.mdx`** is the Canonical Registry for **Types** (Nouns/Objects/Anchors).
- **Pattern guides** (e.g., `actions.mdx`) document **Predicate usage** (Verbs).

> **The Golden Ratio**: Flattened URNs ensure the protocol remains cryptographically stable, developer-friendly, and interoperable with existing flat standards like Schema.org or ISO. This approach has been validated as the correct strategy for semantic systems.

> **Functional Naming Rule:** Types like `fide:CryptographicAccount` are named for their **protocol function**, not their technical origin. An Ethereum address, a passkey, or a hardware enclave are all categorized as a `fide:CryptographicAccount`. Additional context (e.g., `on_network: "ethereum"`) is layered on via separate claims, ensuring the protocol remains cryptographically agnostic.

### 2.2 Terminology

| Term | Definition |
|------|------------|
| **Statement** | An unsigned fact. The timeless anchor for global consensus. |
| **Attestation** | A signed envelope (signature). The cryptographic proof that a signer asserted these facts. |
| **Claim** | The unique link between a Signer, a Fact, and a Point-in-Time. Used for `replaces` pointers. |
| **Evaluation** | *(Reserved)* A specific semantic schema (`FideEvaluation`) used for judging or scoring an entity. |

> **The Recursive Rule:** Because everything has a `FideId`, any entity category can be the `subject` of a new claim. This enables "Claims about Claims about Claims."

The `signerSignature` is the cryptographic "seal" that turns a collection of statements into a valid attestation.

1. **The Payload**: The signer constructs a `FideClaims` object (the manifest).
2. **The Protocol**: The signer uses the specified `signatureMethod` (e.g., **EIP-712** for EVM chains) to sign the manifest.
3. **The Key**: The signature is generated using the private key corresponding to the raw address (extracted from `signer` by stripping `fide:CryptographicAccount:` prefix).
4. **The Result**: The `signerSignature` is a hex-encoded signature string (format depends on `signatureMethod`).
5. **The Identity**: The `signer` field stores `"fide:CryptographicAccount:" + rawAddress`. The indexer derives `signerFideId` as `deriveFideId(signer)`, then strips the namespace prefix to get the raw address for signature verification.

### 2.3 The Chain of IDs (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                        ATTESTATION                              │
│  (Indexer derives: attestationFideId from signature)            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      FideClaims                           │  │
│  │  signedAt: "2026-01-20T12:00:00Z"                         │  │
│  │  subject: "0xBatch55..."                                  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  CLAIM [0]                                          │  │  │
│  │  │  (Indexer derives: statementFideId)                 │  │  │
│  │  │  predicate: "keywords"                              │  │  │
│  │  │  object: deriveFideId("Organic")                    │  │  │
│  │  │  objectLiteral: "Organic"                           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  CLAIM [1]                                          │  │  │
│  │  │  (Indexer derives: statementFideId)                 │  │  │
│  │  │  predicate: "keywords"                              │  │  │
│  │  │  object: deriveFideId("Fair Trade")                 │  │  │
│  │  │  objectLiteral: "Fair Trade"                        │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. The Three-Layer Model

FCP now operates on three conceptual layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: CONSENSUS                                              │
│  "What does the network believe about Statement X?"              │
│  Aggregates: Attestation count, weighted scores, verdicts        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: ATTESTATIONS                                           │
│  "Who said it, when, with what signature?"                       │
│  Contains: Signer, timestamp, signature, statements              │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: STATEMENTS                                             │
│  "What was claimed?"                                             │
│  Contains: Subject, predicate, object (content-addressed)        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Layer 1: Statements (Atomic Integrity)

A statement is a timeless, unsigned statement. To ensure global consensus, FCP enforces **Atomic Statements**.

**Rule:** Every item in the `claims` array generates exactly one Statement ID. **Never hash a list.**

**Derivation (Robust Hashing):**
To prevent collision attacks from string concatenation (e.g., `_` characters in predicates), components are hashed individually before being combined.

**The "One Primitive" Rule:**
In Fide, `deriveFideId(string)` is the **only** cryptographic primitive. See [Formulas](#formulas) for the complete derivation rules.

**Component Hashing Rule:**
To prevent "separator collisions" (where `A + BC` results in the same input as `AB + C`), we hash each component individually before concatenating them for the final hash. The `statementFideId` formula uses component hashing (see [Formulas](#formulas)).

**Why Full 32-Byte Hashes?**
- **Final ID:** 20 bytes (Ethereum-style address)
- **Intermediate Hashes:** Full 32 bytes (maximum entropy)
- **Rationale:** Using truncated 20-byte ingredients would reduce the entropy of the input. By using full 32-byte hashes as ingredients, we guarantee maximum collision resistance before truncating to the final 20-byte ID.

**Implementation Note:**
When concatenating hex strings, ensure you're working with raw bytes (hex without '0x' prefix) or use byte array concatenation. The `0x` prefix is a string representation artifact; the actual bytes are what matter for hashing.

```typescript
import { deriveFideId, keccak256, toBytes } from './fide-id';

// Step 1: Hash each component individually (produces 32-byte hashes)
const subjectHash = keccak256(toBytes(subject));           // Full 32 bytes
const predicateHash = keccak256(toBytes(claim.predicate)); // Full 32 bytes
const objectHash = keccak256(toBytes(claim.object));      // Full 32 bytes

// Step 2: Concatenate the 32-byte hashes (96 bytes total)
// Remove '0x' prefix from hex strings before concatenation (or use byte arrays)
const concatenated = subjectHash + predicateHash.slice(2) + objectHash.slice(2);

// Step 3: Derive final Fide ID (hashes concatenated result, then takes last 20 bytes)
const statementFideId = deriveFideId(concatenated);
```

**Why hash an ID?** Even if `subject` and `object` are already hex addresses, we hash them again to ensure every "slot" in the final derivation is a fixed-length 32-byte block. This makes the identity mathematically unique even if the predicates are variable-length URNs. The double-hashing is intentional and provides maximum collision resistance.

**Note on `objectLiteral`:** The literal is omitted from the ID derivation to prevent consensus fragmentation (e.g., "USA" vs "United States" pointing to the same FideId). The literal is strictly a **Pre-image Proof** used by the indexer to verify that an attestor isn't lying about the content of a hash.

**Crucially:** IDs are derived by the indexer from signed content; they are **NOT** included in the signed JSON payload to avoid redundancy and pre-image attacks.

---

## 4. Temporal Validity: Metadata, Not Identity

Temporal validity is **metadata about the attestation**, not part of the statement's identity.

| Field | Part of Statement ID? | Rationale |
|-------|------------------------|-----------|
| `subject` | ✅ Yes | Core identity |
| `predicate` | ✅ Yes | Core identity |
| `object` | ✅ Yes | Core identity |
| `objectLiteral` | ❌ No | Pre-image Proof (Verification only) |
| `validFrom` | ❌ No | Metadata (Opinion on time) |
| `validTo` | ❌ No | Metadata (Opinion on time) |
| `replaces` | ❌ No | Assertion Revocation (Points to `claimFideId`) |

> **Note on Literals:** Strict adherence to literal normalization (e.g. UUIDs must have empty literals) is critical. Variations in literals (`"Alice"` vs `"Alice Inc"`) will produce different Statement IDs, effectively splitting consensus. This is **intentional**—different literals represent different semantic concepts. If consensus aggregation is desired across similar literals (e.g., "USA" vs "United States"), this must be handled at the application/indexer layer through normalization rules, not at the protocol layer.

---

## 5. Patterns (Updated)

### 5.1 Atomic Statements (The Global Truth Layer)

For maximum deduplication, each attribute resolves to its own unique Statement ID. Everyone who claims "X is Organic" generates the exact same ID.

```typescript
// Attestation 1
{
  subject: "0xBatch55...",
  claims: [ { predicate: "keywords", object: "0x...", objectLiteral: "Organic" } ]
}
// Each claim generates a statementFideId (see Formulas section)

// Attestation 2 (Batch)
{
  subject: "0xBatch55...",
  claims: [ 
    { predicate: "keywords", object: "0x...", objectLiteral: "Organic" },
    { predicate: "keywords", object: "0x...", objectLiteral: "Fair Trade" }
  ]
}
// Result: Attestation FideId 2 links to TWO atomic statement FideIds.
// Consensus for "Organic" is now 2.
```

### 5.2 Workflow Grouping (Batch Attestations)

Batch attestations are for **efficiency**, not identity. They allow **any attestor (human, agent, or organization)** to sign once for multiple independent statements.

**Why this is critical for AI Agents:**
Autonomous agents often generate high-volume, semantically coupled data in a single "turn" (e.g., a 10-step reasoning trace, or a combined Thought + Action + Result event). 

- **Latency**: Generating a signature for every individual step in a 50-step trace adds significant overhead.
- **Transport Integrity**: Bundling prevents "spamming" the network with 50 separate envelopes for a single logical event.
- **Atomic Context**: The batch captures that these statements were generated as part of the same unified reasoning process.

The indexer breaks these into atomic statements in the junction table, ensuring that even if an agent bundles their "Reasoning" with their "Decision," the Decision remains globally comparable to others.

---

## 6. Indexer Schema (Updated)

### 6.1 Tables

```sql
-- Layer 1: Statements (Atomic/Content-Addressed)
CREATE TABLE fcp_statements (
  statement_fide_id TEXT PRIMARY KEY,  -- See Formulas section
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  object_literal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Layer 2: Attestations (Signature-Addressed)
CREATE TABLE fcp_attestations (
  attestation_fide_id TEXT PRIMARY KEY,  -- See Formulas section
  signer_fide_id TEXT NOT NULL,          -- Derived: deriveFideId(signer)
  signer TEXT NOT NULL,                  -- Namespaced account identifier (e.g., "fide:CryptographicAccount:0x1234..." for EVM, "fide:CryptographicAccount:bc1q..." for Bitcoin)
  signature_method TEXT DEFAULT 'eip712', -- Verification standard (eip712, solana-auth, bitcoin-message, etc.)
  signer_signature TEXT NOT NULL,        -- Hex-encoded signature bytes
  signed_at TIMESTAMPTZ NOT NULL,
  signed_message JSONB NOT NULL,
  indexed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: Decouples "Many-to-Many" Signers vs Facts
CREATE TABLE fcp_attestation_statements (
  attestation_fide_id TEXT REFERENCES fcp_attestations(attestation_fide_id),
  statement_fide_id TEXT REFERENCES fcp_statements(statement_fide_id),
  claim_index INTEGER,              
  claim_fide_id TEXT NOT NULL,           -- Indexed for fast 'replaces' resolution
  valid_from TIMESTAMPTZ,           -- Metadata in junction
  valid_to TIMESTAMPTZ,
  replaces TEXT,                    -- Points to a specific claimFideId (Assertion ID)
  PRIMARY KEY (attestation_fide_id, statement_fide_id, claim_index)
);

-- Indexes for efficient querying
CREATE INDEX idx_statements_spo ON fcp_statements(subject, predicate, object);
CREATE INDEX idx_statements_subject ON fcp_statements(subject);
CREATE INDEX idx_attestations_signer ON fcp_attestations(signer_fide_id);
CREATE INDEX idx_attestation_statements_statement ON fcp_attestation_statements(statement_fide_id);
CREATE INDEX idx_attestation_statements_attestation ON fcp_attestation_statements(attestation_fide_id);
CREATE INDEX idx_attestation_statements_claim_fide_id ON fcp_attestation_statements(claim_fide_id);
CREATE INDEX idx_attestation_statements_replaces ON fcp_attestation_statements(replaces) WHERE replaces IS NOT NULL;
```

### 6.2 The Consensus Query

```sql
-- The "Holy Grail": Trust Aggregation
SELECT 
  s.statement_fide_id,
  COUNT(DISTINCT a.signer_fide_id) AS attestor_count
FROM fcp_statements s
JOIN fcp_attestation_statements asst ON asst.statement_fide_id = s.statement_fide_id
JOIN fcp_attestations a ON a.attestation_fide_id = asst.attestation_fide_id
WHERE s.subject = '0xBatch55...'
GROUP BY s.statement_fide_id;
```

---

## 7. Assertion Revocation (The Replacement Logic)

The `replaces` field is the most subtle part of the Dual-ID model.

**Rule:** `replaces` must point to a specific **`claimFideId`**, not a `statementFideId`.

**Why?**
A replacement is an event-level correction of a specific signer's past mistake.
- **Signer A** says "The Sky is Green" (`claimFideId: 0x123`).
- **Signer A** later realizes the mistake and signs a new attestation saying "The Sky is Blue" with `replaces: 0x123`.

If `replaces` pointed to a `statementFideId`, Signer A would semantically be trying to "delete the concept of the Sky being Green" for the entire network. This would create a paradox if 50 other people also asserted the sky was green. By pointing to a `claimFideId`, Signer A is only revoking **their own specific assertion**.

**Result:** The Indexer uses the `replaces` pointer to "de-weight" the old claim from that specific signer while leaving others' claims untouched.

---

## 8. Migration Strategy

This is an **Indexer-Only Change**. The transport layer (`.jsonl` files) remains unchanged, but the indexer database schema and derivation logic are updated.

### 8.1 Transport Layer (Envelope Structure)

The envelope uses explicit fields to decouple **Identity** from **Verification Logic**:

```json
{
  "type": "FideClaimEnvelope",
  "signer": "fide:CryptographicAccount:0x1234...",  // Namespaced account identifier (EVM, Bitcoin, Solana, etc.)
  "signatureMethod": "eip712",          // Verification standard (default: "eip712")
  "signerSignature": "0xabc...",        // Hex-encoded signature bytes
  "signedMessage": {
    "signedAt": "2026-01-20T12:00:00Z",
    "subject": "0xBatch55...",
    "claims": [ ... ]
  }
}
```

**Field Descriptions:**
- **`signer`**: The namespaced account identifier (`fide:CryptographicAccount:0x...` for EVM, `fide:CryptographicAccount:bc1...` for Bitcoin, etc.). This ensures type safety and prevents collisions with other anchor types.
- **`signatureMethod`**: Tells the indexer which verification library to use (`eip712`, `solana-auth`, `bitcoin-message`, etc.). Defaults to `"eip712"`.
- **`signerSignature`**: The hex-encoded signature bytes. Format depends on `signatureMethod`.

**Identity Derivation:**
The indexer derives `signerFideId` as `deriveFideId(signer)`. When verifying signatures, the indexer strips the `fide:CryptographicAccount:` namespace prefix to extract the raw address (`0x1234...`) for signature verification. This ensures the same address maps to the same entity regardless of which chain the signature was created on.

### 8.2 SDK Changes (Helper Functions)

SDKs **MUST** export helper functions for ID derivation:

```typescript
/**
 * Derive account Fide ID from namespaced signer identifier (Universal Account Model)
 * Same address on Ethereum, Optimism, and Base maps to the same Fide ID
 * @param signer - Namespaced account identifier (e.g., "fide:CryptographicAccount:0x1234..." for EVM, "fide:CryptographicAccount:bc1q..." for Bitcoin)
 * @returns 20-byte Fide ID (Ethereum address format)
 */
export function deriveAccountFideId(signer: string): `0x${string}` {
  return deriveFideId(signer);
}

/**
 * Extract raw address from namespaced signer identifier
 * Used by indexer to get raw address for signature verification
 * @param signer - Namespaced account identifier (e.g., "fide:CryptographicAccount:0x1234...")
 * @returns Raw address string (e.g., "0x1234...")
 */
export function extractRawAddress(signer: string): string {
  if (!signer.startsWith('fide:CryptographicAccount:')) {
    throw new Error(`Invalid signer format: expected "fide:CryptographicAccount:..." but got "${signer}"`);
  }
  return signer.slice('fide:CryptographicAccount:'.length);
}

/**
 * Derive attestation Fide ID from signature
 * @param signerSignature - Hex-encoded signature string (format depends on signatureMethod)
 * @returns 20-byte Fide ID (Ethereum address format)
 */
export function deriveAttestationFideId(signerSignature: string): `0x${string}` {
  return deriveFideId(signerSignature);
}

/**
 * Derive claim Fide ID from attestation and claim index
 * Used for 'replaces' pointers in revocation workflows
 * @param attestationFideId - The attestation Fide ID (20-byte hex address)
 * @param index - Zero-based index of the claim in the claims array
 * @returns 20-byte Fide ID (Ethereum address format)
 */
export function deriveClaimFideId(
  attestationFideId: `0x${string}`, 
  index: number
): `0x${string}` {
  return deriveFideId(`${attestationFideId}_${index}`);
}

/**
 * Derive statement Fide ID from subject, predicate, and object
 * Uses component hashing for collision resistance
 * @param subjectFideId - Subject entity Fide ID (20-byte hex address, e.g., "0xAlice...")
 * @param predicate - Predicate string (e.g., "schema:name" or "keywords")
 * @param objectFideId - Object entity Fide ID (20-byte hex address, e.g., "0x...")
 * @returns 20-byte Fide ID (Ethereum address format)
 */
export function deriveStatementFideId(
  subjectFideId: `0x${string}`,
  predicate: string,
  objectFideId: `0x${string}`
): `0x${string}` {
  // Hash each component individually (produces full 32-byte hashes)
  const subjectHash = keccak256(toBytes(subjectFideId));     // 32 bytes
  const predicateHash = keccak256(toBytes(predicate));      // 32 bytes
  const objectHash = keccak256(toBytes(objectFideId));       // 32 bytes
  
  // Concatenate hex strings: remove '0x' prefix from 2nd and 3rd hashes
  // This ensures we're concatenating raw bytes, not ASCII '0x' characters
  const concatenated = subjectHash + predicateHash.slice(2) + objectHash.slice(2);
  
  // Final hash and truncate to 20 bytes (Ethereum-style address)
  return deriveFideId(concatenated);
}
```

**Usage Example (Revocation):**
```typescript
// Old claim ID (for revocation)
const oldAttestationID = deriveAttestationFideId(oldSignerSignature);
const oldClaimID = deriveClaimFideId(oldAttestationID, 2);

// New claim with replacement
const newClaim = {
  replaces: oldClaimID,  // Points to specific claim, not statement
  predicate: "keywords",
  object: deriveFideId("Corrected Value"),
  objectLiteral: "Corrected Value",
  // ...
};
```

### 8.3 Indexer Migration Steps

**Phase 1: Schema Migration**
1. Create new tables: `fcp_statements`, `fcp_attestations`, `fcp_attestation_statements`
2. Migrate existing `fcp_claims` → `fcp_attestations` (rename `claim_fide_id` → `attestation_fide_id`)
3. Extract unique `(subject, predicate, object)` tuples from `fcp_edges` → create `fcp_statements`
4. Build `fcp_attestation_statements` junction table from `fcp_edges` relationships

**Phase 2: Data Migration**
```sql
-- Extract unique statements from existing edges
INSERT INTO fcp_statements (statement_fide_id, subject, predicate, object, object_literal)
SELECT DISTINCT
  deriveStatementFideId(from_fide_id, predicate_fide_id, COALESCE(to_fide_id, value)),
  from_fide_id,
  predicate_fide_id,
  COALESCE(to_fide_id, value),
  value
FROM fcp_edges
WHERE claim_status = 'valid';

-- Migrate claims to attestations
INSERT INTO fcp_attestations (
  attestation_fide_id, 
  signer_fide_id, 
  signer,
  signature_method,
  signer_signature, 
  signed_at, 
  signed_message
)
SELECT 
  claim_fide_id,
  claim_signing_key_fide_id,
  'fide:CryptographicAccount:' || claim_signing_key_fide_id,  -- Construct signer field from signing key
  'eip712',  -- Default signature method
  claim_author_signature,  -- Legacy column name (will be renamed in migration)
  claim_signed_at,
  signed_message
FROM fcp_claims;

-- Build junction table
INSERT INTO fcp_attestation_statements (
  attestation_fide_id,
  statement_fide_id,
  claim_index,
  claim_fide_id,
  valid_from,
  valid_to,
  replaces
)
SELECT 
  e.claim_fide_id,
  s.statement_fide_id,
  e.claim_index,
  deriveClaimFideId(e.claim_fide_id, e.claim_index),
  e.claim_valid_from,
  e.claim_valid_to,
  NULL  -- replaces would need to be extracted from signed_message if present
FROM fcp_edges e
JOIN fcp_statements s ON 
  s.subject = e.from_fide_id AND
  s.predicate = e.predicate_fide_id AND
  s.object = COALESCE(e.to_fide_id, e.value)
WHERE e.claim_status = 'valid';
```

**Phase 3: Indexer Logic Update**
- Update ingestion pipeline to derive `statementFideId` and `claimFideId` on-the-fly
- Insert into new three-table structure instead of `fcp_edges`
- Maintain backward compatibility during transition period (dual-write to both schemas)

### 8.4 Terminology Alignment

**Old (critique8) → New (critique9):**
- `claimFideId` (envelope) → `attestationFideId`
- `claimFideId` (individual claim) → `claimFideId` (unchanged, but now derived from attestation)
- *(new)* → `statementFideId` (content-addressed fact)

**Note:** The term "claim" now specifically refers to the individual link (`claimFideId`), while "attestation" refers to the signed envelope (`attestationFideId`).

---

*"What was said. Who said it. How many agree. Three layers, two IDs, one truth."*
