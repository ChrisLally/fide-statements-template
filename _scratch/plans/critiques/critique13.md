# FCP Indexer Refactor: critique13 (Unified Statement Model & Chain-Agnostic Identity)

*Status: **REVISED***
*Date: 2026-02-01 (Updated: 2026-02-01)*

---

## Executive Summary

This critique documents the refactoring of the FCP indexer to support a unified statement model where attestation links are themselves statements. The key changes eliminate the separate `fcp_claims` table, establish chain-agnostic signer identity via `did:controller` relationships, and enable recursive attestation patterns through PROV-O predicates (`prov:wasGeneratedBy`, `prov:wasAssociatedWith`).

---

## 1. Core Changes

### 1.1 Removed Attestation Metadata Statements

**Problem:** The indexer was creating 3 redundant statements per attestation:
```
Attestation → fide:signer → CryptographicAccount
Attestation → fide:signatureMethod → "eip712"
Attestation → fide:signature → "0xabc..."
```

**Solution:** All this data is already encoded in the attestation's `raw_identifier` JSON:
```json
{"m":"eip712", "u":"eip155:31337:0x...", "r":"0x...", "s":"0x..."}
```

The `fcp_attestations` view extracts these fields directly from JSON.

**Impact:**
- **Before:** 201 statements + 3 metadata = 204 statements per batch
- **After:** Just 198 statements (content only)
- Simpler materialization logic
- Fewer database writes

### 1.2 PROV-O Triangle: Precise Attribution via Two-Step Chain

**Problem with direct `prov:wasAttributedTo`:**
- **Redundancy:** Storing `Statement → prov:wasAttributedTo → Signer` duplicates the chain (33% more rows)
- **Ambiguity:** You lose the pointer to the **specific Attestation (Batch/Merkle Root)** — verifier must search all batches

**Solution: PROV-O Triangle Pattern**

Store the **precise chain** instead of the shortcut:

```
Statement → prov:wasGeneratedBy → Attestation (Batch/Merkle Root)
Attestation → prov:wasAssociatedWith → SignerFideId

Where:
  - SignerFideId = calculateFideId(signerType, 'CryptographicAccount', signerAddress)
  - Type byte indicates signer's entity type:
    - 0x18... = Person identified by this cryptographic account
    - 0x28... = Organization identified by this cryptographic account
    - 0x78... = AutonomousAgent identified by this cryptographic account
    - 0x88 = The CryptographicAccount itself
  - Source byte is always 0x8 (CryptographicAccount identifier)
```

**Why this works:**
1. **Normalized:** Each fact stored once
2. **Precise:** Always know which Attestation/batch signed (critical for verification)
3. **Self-describing:** Signer type encoded in 0x1a, 0x2a prefix
4. **Queryable:** View reconstructs `prov:wasAttributedTo` as shortcut when needed
5. **Lossless:** Can traverse full chain or take shortcut

**Example:**
```
Statement ABC → prov:wasGeneratedBy → AttestationX (Merkle Root)
AttestationX → prov:wasAssociatedWith → 0x18...alice (signer)
```

**View: Reconstitute `prov:wasAttributedTo` when needed:**
```sql
CREATE VIEW fcp_attributed_to AS
SELECT s1.subject_fingerprint as statement_id,
       s2.object_fingerprint as signer_entity_id
FROM fcp_statements s1
JOIN fcp_statements s2 ON s1.object_fingerprint = s2.subject_fingerprint
WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy')
  AND s2.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith');
```

**Benefits:**
- **Everything is a statement** — No special tables, uniform query model
- **Precise lineage** — Always traceable to the specific Attestation/batch
- **Signer type encoded** — Just read type byte: 0x1=Person, 0x2=Org, etc.
- **Recursive chains** — Can attest to Attestations: `Batch2 → prov:wasGeneratedBy → Batch1`
- **Uniform predicates** — All predicates ~0x66 (CreativeWork) except evaluations (0xe0)
- **Signatures in JSON** — Attestation pre-image contains all signature metadata
- **No table overhead** — Fewer schema special cases

### 1.3 Controller Relationships via W3C Standard (`did:controller`)

**Pattern:** Link cryptographic accounts to their human/organizational controllers using the DID Core standard.

**The Direction Matters (PROV-O vs DID-Core):**

In PROV-O attestation chains, statements are the **subject**:
```
Statement → prov:wasGeneratedBy → Attestation
```

But for **identity linking**, the DID Core standard flips the direction. The **account declares its controller**, not the other way around:

```
CryptographicAccount (0x88...) → did:controller → Person (0x18...)
//  "This account is controlled by Alice"
```

**Why the flip?**
- **Discovery:** When you encounter a wallet address, you look up its `did:controller` property to find who controls it
- **Authority:** The account is the authoritative source of truth about who can use it
- **Standard compliance:** W3C DID Core defines controller as a property of the DID Document (the account)

**Benefits:**
- W3C-standard relationship (not custom `fide:controls`)
- Safer discovery (follow from wallet to person, not guess)
- Semantic clarity: "This account declares who controls it"
- Enables rich identity graphs: one person → many accounts, many people → shared account

### 1.4 Chain-Agnostic Signer Identity

**Design Decision:** The same address across chains = same entity.

**Rationale:** No holder of one address will have the exact same address as another user, regardless of chain.

**Implementation:**
```typescript
// Extract address from CAIP-10: "eip155:31337:0xabc..." → "0xabc..."
const signerAddress = caip10User.split(':')[2];

// Calculate fingerprint from address ONLY (not full CAIP-10)
const signerFideId = calculateFideId('CryptographicAccount', 'CryptographicAccount', signerAddress);
const signerFingerprint = extractFingerprint(signerFideId);
```

**Result:**
- `0xabc...` on Ethereum mainnet = Same entity (0x88...xyz)
- `0xabc...` on Polygon = Same entity (0x88...xyz)
- Chain context preserved in attestation JSON
- Person controlling this account can be discovered via: `0x88...xyz → did:controller → 0x18...`

### 1.4 Materialized Attestation View

**Purpose:** Extract attestation metadata from raw_identifier JSON for efficient queries.

```sql
CREATE VIEW fcp_attestations AS
SELECT
    i.identifier_fingerprint AS attestation_fingerprint,
    (i.raw_identifier::jsonb ->> 'm') AS signature_method,
    (i.raw_identifier::jsonb ->> 'u') AS caip10_signer,
    (i.raw_identifier::jsonb ->> 'r') AS merkle_root,
    (i.raw_identifier::jsonb ->> 's') AS signature,
    split_part(i.raw_identifier::jsonb ->> 'u', ':', 1) AS chain_namespace,
    split_part(i.raw_identifier::jsonb ->> 'u', ':', 2) AS chain_reference,
    split_part(i.raw_identifier::jsonb ->> 'u', ':', 3) AS signer_address,
    -- Chain-agnostic signer (address only)
    calculateFideId('CryptographicAccount', 'CryptographicAccount',
      split_part(i.raw_identifier::jsonb ->> 'u', ':', 3)) AS signer_address_fingerprint
FROM fcp_raw_identifiers i
WHERE i.identifier_fingerprint IN (
  SELECT DISTINCT s.object_fingerprint
  FROM fcp_statements s
  WHERE s.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAttributedTo')
);
```

**Benefits:**
- CAIP-10 parsed into queryable columns
- Signature metadata extracted from JSON without separate storage
- Chain context preserved for cross-chain verification
- Single source of truth (JSON in raw_identifier)

---

## 2. Database Schema

### 2.1 Tables

```sql
-- Core triple store (all-inclusive)
CREATE TABLE fcp_statements (
    statement_fingerprint CHAR(38) PRIMARY KEY,

    -- Subject (fully typed)
    subject_type CHAR(1) NOT NULL,
    subject_source_type CHAR(1) NOT NULL,
    subject_fingerprint CHAR(38) NOT NULL REFERENCES fcp_raw_identifiers(identifier_fingerprint),

    -- Predicate (NOW fully typed - critical for evaluations!)
    predicate_type CHAR(1) NOT NULL,        -- '6' for Relationships, 'e' for Evaluations
    predicate_source_type CHAR(1) NOT NULL,
    predicate_fingerprint CHAR(38) NOT NULL REFERENCES fcp_raw_identifiers(identifier_fingerprint),

    -- Object (fully typed)
    object_type CHAR(1) NOT NULL,
    object_source_type CHAR(1) NOT NULL,
    object_fingerprint CHAR(38) NOT NULL REFERENCES fcp_raw_identifiers(identifier_fingerprint)
);

-- Identifiers: pre-images for all fingerprints
CREATE TABLE fcp_raw_identifiers (
    identifier_fingerprint CHAR(38) PRIMARY KEY,
    raw_identifier TEXT NOT NULL
);
```

**Statements include three classes:**
- **Facts (0x6 predicates):** `Alice → schema:name → "Alice Johnson"` (Relationships)
- **Opinions (0xe predicates):** `Alice → 0xe0_evaluation_method → "85"` (Judgments/Reputation)
- **Provenance (0x6 predicates):** `Statement → prov:wasGeneratedBy → Attestation` (PROV-O chain)

**Why Predicate Typing Matters:**

By storing `predicate_type`, you can instantly filter all reputation signals:

```sql
-- ✅ INSTANT: Get every evaluation in the system
SELECT * FROM fcp_statements
WHERE predicate_type = 'e';  -- INSTANT with index

-- ❌ SLOW: Without predicate_type, you'd need to parse strings
SELECT * FROM fcp_statements
WHERE predicate_fingerprint IN (SELECT ... WHERE name LIKE 'EvaluationMethod%')
```

**Attestation pre-image format:**
```json
{"m": "eip712", "u": "eip155:31337:0xabc...", "r": "0xmerkle", "s": "0xsig"}
```

### 2.2 Indexes

```sql
-- Core statement queries
CREATE INDEX idx_statements_subject ON fcp_statements(subject_fingerprint);
CREATE INDEX idx_statements_predicate ON fcp_statements(predicate_fingerprint);
CREATE INDEX idx_statements_object ON fcp_statements(object_fingerprint);
CREATE INDEX idx_statements_subject_predicate ON fcp_statements(subject_fingerprint, predicate_fingerprint);

-- CRITICAL: Predicate type indexing for zero-lookup reputation queries
CREATE INDEX idx_statements_predicate_type ON fcp_statements(predicate_type);
-- Get all evaluations instantly: SELECT * WHERE predicate_type = 'e'

-- For PROV-O provenance chain discovery
CREATE INDEX idx_statements_prov_was_generated_by ON fcp_statements(predicate_fingerprint)
WHERE predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy');

CREATE INDEX idx_statements_prov_was_associated_with ON fcp_statements(predicate_fingerprint)
WHERE predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith');

-- For type-based filtering of signers
CREATE INDEX idx_statements_signer_type ON fcp_statements(object_fingerprint)
WHERE predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith')
  AND (object_fingerprint LIKE '0x18%' OR object_fingerprint LIKE '0x28%'
       OR object_fingerprint LIKE '0x78%' OR object_fingerprint LIKE '0x88%');

-- Composite: Subject + Predicate Type (for reputation filtering)
CREATE INDEX idx_statements_subject_predicate_type ON fcp_statements(subject_fingerprint, predicate_type)
WHERE predicate_type = 'e';
-- Query: "Get all evaluations of Alice" - FAST
```

### 2.3 Views

```sql
-- Materialized attestation view for efficient queries
CREATE VIEW fcp_attestations AS ...  -- See 1.4 above
```

---

## 3. Code Changes

### 3.1 `materialize.ts`

**Key change:** Create two-step chain (PROV-O Triangle) instead of single attribution statement.

**For each verified statement:**
```typescript
// 1. Create the content statement normally
const contentStatement = {
  statement_fingerprint: calculateStatementFideId(subject, predicate, object),
  subject_fingerprint: subject,
  predicate_fingerprint: predicate,
  object_fingerprint: object,
};

// 2. Store attestation pre-image (contains all signature metadata)
const attestationPreimage = {
  m: 'eip712',
  u: caip10User,
  r: merkleRoot,
  s: signature
};
const attestationFingerprint = keccak256(JSON.stringify(attestationPreimage)).slice(-38);
identifiersToInsert.push({
  identifier_fingerprint: attestationFingerprint,
  raw_identifier: JSON.stringify(attestationPreimage)
});

// 3. Helper to determine predicate type
function getPredicateType(predicateString: string): { type: '6' | 'e', source: string } {
  // Check if it's an EvaluationMethod URN/identifier
  if (predicateString.includes('EvaluationMethod') || predicateString.startsWith('Fide-') || predicateString.includes('Method')) {
    return { type: 'e', source: '0' }; // EvaluationMethod, UUID source
  }
  return { type: '6', source: '6' }; // CreativeWork (relationships/PROV-O)
}

// 4. Create prov:wasGeneratedBy statement (Statement → Attestation/Batch)
const wasGeneratedByPredicate = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy');
const wasGenType = getPredicateType('prov:wasGeneratedBy');
const generatedByStatement = {
  statement_fingerprint: calculateStatementFideId(
    contentStatement.statement_fingerprint,
    wasGeneratedByPredicate,
    attestationFingerprint
  ),
  subject_fingerprint: contentStatement.statement_fingerprint,
  predicate_type: wasGenType.type,
  predicate_source_type: wasGenType.source,
  predicate_fingerprint: wasGeneratedByPredicate,  // Points to the batch
  object_fingerprint: attestationFingerprint,
};

// 4. Extract signer address from CAIP-10
// "eip155:31337:0xabc..." → "0xabc..."
const signerAddress = caip10User.split(':')[2];

// 5. Determine signer entity type
const signerEntityType = 'Person'; // or 'Organization', 'AutonomousAgent'

// 6. Derive signer's entity Fide ID identified by cryptographic account
// This encodes who signed, identified by their account address:
// 0x18... = Person (identified via account), 0x28... = Org, etc.
const signerFideId = calculateFideId(signerEntityType, 'CryptographicAccount', signerAddress);
const signerFingerprint = extractFingerprint(signerFideId);

// 8. Create prov:wasAssociatedWith statement (Attestation → Signer)
const wasAssociatedWithPredicate = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith');
const wasAssocType = getPredicateType('prov:wasAssociatedWith');
const associatedWithStatement = {
  statement_fingerprint: calculateStatementFideId(
    attestationFingerprint,
    wasAssociatedWithPredicate,
    signerFingerprint
  ),
  subject_fingerprint: attestationFingerprint,  // The batch/attestation
  predicate_type: wasAssocType.type,
  predicate_source_type: wasAssocType.source,
  predicate_fingerprint: wasAssociatedWithPredicate,
  object_fingerprint: signerFingerprint,  // 0x18 (Person), 0x28 (Org), 0x78 (Agent), or 0x88 (Account)
};

// 8. Insert all statements
statementsToInsert.push(contentStatement, generatedByStatement, associatedWithStatement);

// 9. Store signer raw identifier (CRITICAL: must be the seed address, not the derived Fide ID)
// The fingerprint was calculated from signerAddress, so we must store the address as raw_identifier
// to maintain cryptographic integrity: Keccak(signerAddress) = signerFingerprint
identifiersToInsert.push({
  identifier_fingerprint: signerFingerprint,
  raw_identifier: signerAddress  // ✅ MUST be the original seed (e.g., "0xabc..."), NOT signerFideId
});
```

**Result: PROV-O Triangle**
```
Statement → prov:wasGeneratedBy → Attestation
Attestation → prov:wasAssociatedWith → 0x18...alice

// Query reconstructs prov:wasAttributedTo if needed:
Statement → prov:wasAttributedTo → 0x18...alice  (via view)
```

**Benefits:**
- Precise: Verifier always knows which batch signed it
- Normalized: Each fact stored once (no redundancy)
- Self-describing: Signer type in 0x18 prefix
- Queryable: View provides shortcut when needed

**Removed:**
- Separate `fcp_claims` table logic
- Single `prov:wasAttributedTo` statement (replaced by two-step chain)

### 3.2 Controller Relationship (`did:controller`)

**In addition to the PROV-O chain**, optionally store the **DID Core standard controller relationship**:

```typescript
// After deriving signer Fide IDs, create did:controller statement
// "This account is controlled by this person"

const didControllerPredicate = calculateFideId('CreativeWork', 'CreativeWork', 'did:controller');

// Direction FLIP: Account (subject) → did:controller → Person (object)
// NOT: Person → did:controller → Account
const accountFingerprint = calculateFideId('CryptographicAccount', 'CryptographicAccount', signerAddress);
const personFingerprint = calculateFideId('Person', 'CryptographicAccount', signerAddress);

const controllerStatement = {
  statement_fingerprint: calculateStatementFideId(
    accountFingerprint,  // Subject is the ACCOUNT (0x88)
    didControllerPredicate,
    personFingerprint    // Object is the PERSON (0x18)
  ),
  subject_fingerprint: accountFingerprint,      // 0x88...
  predicate_fingerprint: didControllerPredicate,
  object_fingerprint: personFingerprint,        // 0x18...
};

statementsToInsert.push(controllerStatement);
```

**Why this statement?**
- **W3C Compliant:** Standard DID Core relationship (not custom)
- **Safe Discovery:** When you encounter wallet 0x88..., query "who controls this?" without guessing
- **Authority:** The account declares who has signing capability (not the person claiming to control it)
- **Identity Graphs:** Support 1 person → N accounts, N people → 1 shared account (multi-sig)

### 3.4 `fcp-statements-service.ts`

**No changes needed** — `insertStatements()` already handles all statement types uniformly.

### 3.5 `reset-rcp.ts`

**Updated:** Clear only `fcp_statements` and `fcp_raw_identifiers` (no `fcp_claims` table)

---

## 4. Query Patterns

### 4.1 Find All Statements About an Entity

```sql
SELECT s.* FROM fcp_statements s
WHERE s.subject_fingerprint = '15twitter_alice...';
-- Returns all facts/relationships with this entity as subject
```

### 4.2 Find All Statements Signed by Any Person (Type 0x1a) — Direct

```sql
-- Follow the chain: Statement → wasGeneratedBy → Attestation → wasAssociatedWith → Person
SELECT s1.subject_fingerprint AS statement_signed,
       s2.subject_fingerprint AS attestation_fingerprint,
       s2.object_fingerprint AS person_signer_fide_id,
       r.raw_identifier AS attestation_preimage_json
FROM fcp_statements s1
JOIN fcp_statements s2 ON s1.object_fingerprint = s2.subject_fingerprint
JOIN fcp_raw_identifiers r ON r.identifier_fingerprint = s1.object_fingerprint
WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy')
  AND s2.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith')
  AND s2.object_fingerprint LIKE '0x18%';  -- Type 0x1 = Person, Source 0x8 = CryptographicAccount
```

### 4.3 Find All Statements Signed by Any Organization — Via View

```sql
-- Using the reconstituted prov:wasAttributedTo view
SELECT statement_id, signer_entity_id
FROM fcp_attributed_to
WHERE signer_entity_id LIKE '0x2a%';  -- Type 0x2 = Organization, Source 0xa = Attestation
```

### 4.4 Find All Statements by a Specific Signer (by Address)

```sql
-- Find who signed with address 0xabc123... and what they signed
-- Chain: Statement → wasGeneratedBy → Attestation (JSON contains address)
WITH attestations_by_address AS (
  SELECT i.identifier_fingerprint AS attestation_fingerprint,
         (i.raw_identifier::jsonb ->> 'u') AS caip10_signer
  FROM fcp_raw_identifiers i
  WHERE i.raw_identifier::jsonb ->> 'u' LIKE '%0xabc123%'
)
SELECT s1.subject_fingerprint AS statement_signed,
       s1.object_fingerprint AS attestation_fingerprint,
       aba.caip10_signer,
       s2.object_fingerprint AS signer_entity_id
FROM fcp_statements s1
JOIN attestations_by_address aba ON s1.object_fingerprint = aba.attestation_fingerprint
JOIN fcp_statements s2 ON s2.subject_fingerprint = aba.attestation_fingerprint
WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy')
  AND s2.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith');
```

### 4.5 Discover Controller of a Cryptographic Account

```sql
-- Find who controls a specific account (W3C DID Core)
SELECT s.object_fingerprint AS controller_entity,
       r.raw_identifier AS controller_fide_id
FROM fcp_statements s
JOIN fcp_raw_identifiers r ON r.identifier_fingerprint = s.object_fingerprint
WHERE s.subject_fingerprint = '0x88...account'  -- The account
  AND s.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'did:controller');

-- Result: If Person (0x18...) controls this, you can identify the person
-- If Organization (0x28...) controls it, you can identify the org
-- The type byte tells you immediately which entity type controls it
```

### 4.6 Recursive: Attestation Chain (Batch Endorsement)

```sql
-- Find batches that endorsed other batches
-- Batch1 → wasGeneratedBy → Batch2
-- Batch2 → wasAssociatedWith → Signer (0x18...)

SELECT s1.subject_fingerprint AS batch_being_endorsed,
       s1.object_fingerprint AS endorsing_batch,
       s2.object_fingerprint AS endorser_entity_id,
       CASE
         WHEN s2.object_fingerprint LIKE '0x18%' THEN 'Person'
         WHEN s2.object_fingerprint LIKE '0x28%' THEN 'Organization'
         WHEN s2.object_fingerprint LIKE '0x78%' THEN 'AutonomousAgent'
         ELSE 'Other'
       END AS endorser_type
FROM fcp_statements s1
JOIN fcp_statements s2 ON s2.subject_fingerprint = s1.object_fingerprint
WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy')
  AND s2.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith');
```

---

## 5. Design Rationale

### 5.1 Why Everything is a Statement (Unified Model)?

**Key insight:** Attestations are metadata. Metadata deserves to be in the graph.

**Benefits:**
- **Uniform query model** — No special tables, everything via `fcp_statements`
- **Recursive attestations** — Can attest to attestations, enabling trust chains
- **Simpler schema** — Fewer special cases, easier to reason about
- **Future-proof** — New statement patterns don't require schema migrations

**Example recursive pattern:**
```
StatementA → prov:wasGeneratedBy → AttestationX (Alice's batch)
AttestationX → prov:wasAssociatedWith → 0x18...alice (Person Alice)

// Alice then endorses another attestation:
AttestationY → prov:wasGeneratedBy → AttestationX (batch linking to original)
AttestationY → prov:wasAssociatedWith → 0x18...alice (Alice endorses the chain)
```

### 5.2 Why Signer Type in Object's Fide ID (0x18, 0x28, etc.)?

**Key insight:** The signer's entity Fide ID is identified by their cryptographic account, with the **type byte encoding their entity type**:

```
0x18... = Person identified by cryptographic account
         (calculateFideId('Person', 'CryptographicAccount', signerAddress))
0x28... = Organization identified by cryptographic account
0x78... = AutonomousAgent identified by cryptographic account
0x88 = The CryptographicAccount itself (type 0x8, source 0x8)
```

**Benefits:**
- **Type-based filtering** — Query all statements by persons: `WHERE object LIKE '0x18%'`
- **Self-describing** — No lookup: `0x18...` **IS** a Person identified by account
- **Stable identity** — Same address on different chains = same entity
- **Entity-type hierarchy** — Can infer entity type from Fide ID prefix
- **No registration** — Any signer type can be added (new type bytes)

**Example:**
```sql
-- All statements signed by organizations (via PROV-O chain)
SELECT s1.subject_fingerprint
FROM fcp_statements s1
JOIN fcp_statements s2 ON s2.subject_fingerprint = s1.object_fingerprint
WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy')
  AND s2.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith')
  AND s2.object_fingerprint LIKE '0x28%';
```

### 5.3 Why Chain-Agnostic Signer Identity?

**Assumption:** The same address across chains represents the same entity.

**Benefits:**
- **Unified identity** — `0xabc...` on Ethereum = `0xabc...` on Polygon
- **Cross-chain queries** — "Show all claims by this address" (any chain)
- **Reduced storage** — One fingerprint per address, not per (address, chain) pair

**Trade-offs:**
- Chain context still available in attestation JSON (`caip10_signer`)
- Can filter by chain when needed (e.g., "only mainnet signers")
- Assumes address collision across chains is negligible (valid for ETH addresses)

### 5.4 Why Store Signatures in JSON?

**Alternative:** Create separate statement rows for each signature component.

**Old approach:**
```
Attestation → fide:signatureMethod → "eip712"
Attestation → fide:signature → "0xabc..."
Attestation → fide:merkleRoot → "0xdef..."
```

**New approach:**
```json
// Single pre-image contains all components
{
  "m": "eip712",
  "u": "eip155:31337:0xabc...",
  "r": "0xdef...",
  "s": "0x123..."
}
```

**Benefits:**
- Atomic — All signature data together
- Self-contained — Attestation is self-describing
- Efficient — No N extra rows in `fcp_statements`
- Queryable — View extracts JSON fields on demand
- Deterministic — Same pre-image always produces same attestation fingerprint

### 5.5 Why Predicate Type is Stored (0x6 vs 0xe)

**Critical Architectural Decision:** Facts and Opinions are fundamentally different data classes.

**The Distinction:**
- **0x6 Predicates (Facts/Relationships):** `schema:name`, `prov:wasGeneratedBy`, `did:controller`
  - Answer: "What is the relationship between these entities?"
  - Examples: "Alice knows Bob", "Statement was generated by Batch X"

- **0xe Predicates (Opinions/Judgments):** `Fide-TrustScore-v1`, `Fide-SpamDetector-v1`
  - Answer: "What is the opinion of the subject?"
  - Examples: "Alice has a trust score of 85", "Bob is spam"

**Why Store Predicate Type?**
- **Zero-Lookup Reputation Queries:** `SELECT * FROM fcp_statements WHERE predicate_type = 'e'`
- **Instant Filtering:** No need to parse strings or join tables to find all evaluations
- **Active Reputation Protocol:** Can index `(subject, predicate_type)` for "all opinions about entity X"

**Example Query Pattern:**
```sql
-- Get all reputation signals about Alice (INSTANT)
SELECT predicate_fingerprint, object_fingerprint, object_type
FROM fcp_statements
WHERE subject_fingerprint = 'alice_fingerprint'
  AND predicate_type = 'e';  -- Only evaluations, no relationship bloat
```

This distinction transforms the system from a passive triple store into an **active reputation protocol**.

### 5.6 Why Predicate Fingerprints are Mostly ~0x66

**Predicates are concepts, not entities:**
- `schema:name` — Abstract concept (CreativeWork:CreativeWork)
- `prov:wasAttributedTo` — Abstract relationship (CreativeWork:CreativeWork)
- `fide:evidence` — Protocol abstraction (CreativeWork:CreativeWork)

**Exception: Evaluation Methods**
- `0xe0_evaluation_method` — Type 0xe0 (EvaluationMethod:UUID)
- Evaluations are special: they combine a methodology (predicate) with a rating (object)

**Result:**
- **Predicate type is always ~0x66 or 0xe0**
- Schema documentation can state this as a constraint
- Database can validate this invariant

---

## 6. Migration Path

1. **Update SQL migrations:**
   - Remove `fcp_claims` table creation (if exists)
   - Ensure `fcp_statements` has indexes for `subject_fingerprint`, `predicate_fingerprint`, `object_fingerprint`
   - Create filtered index on `prov:wasAttributedTo` predicate

2. **Update `materialize.ts`:**
   - For each statement, create a corresponding `prov:wasAttributedTo` attribution statement
   - Store attestation pre-image in `fcp_raw_identifiers`

3. **Regenerate TypeScript types:**
   ```bash
   pnpm supabase gen types typescript --local > types/supabase.ts
   ```

4. **Test end-to-end:**
   ```bash
   pnpm fcp:rsi  # Reset, seed, index
   ```

---

## 7. Verification

After running `pnpm fcp:rsi` with the new unified model:

```sql
-- Should see all statement types together:
SELECT COUNT(*) FROM fcp_statements;
-- Expected: ~400 (201 content + 201 prov:wasAttributedTo + overhead)

-- Verify content statements:
SELECT COUNT(*) FROM fcp_statements
WHERE predicate_fingerprint != calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAttributedTo');
-- Should be: ~201 (original claims only)

-- Verify attribution statements:
SELECT COUNT(*) FROM fcp_statements s
JOIN fcp_raw_identifiers r ON r.identifier_fingerprint = s.predicate_fingerprint
WHERE r.raw_identifier = 'prov:wasAttributedTo';
-- Should be: ~201 (one per original claim)

-- Verify attestation view:
SELECT COUNT(*) FROM fcp_attestations;
-- Should be: 1 (single batch signature)

SELECT * FROM fcp_attestations LIMIT 1;
-- Should have: attestation_fingerprint, chain_namespace, chain_reference, signer_address, signature, merkle_root, signature_method

-- Verify chain-agnostic signer:
SELECT DISTINCT signer_address_fingerprint FROM fcp_attestations;
-- Should see: ONE fingerprint (single signer across all chains)

-- Verify recursive capability:
SELECT COUNT(*) FROM fcp_statements s1
JOIN fcp_statements s2 ON s2.subject_fingerprint = s1.statement_fingerprint
WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAttributedTo');
-- Demonstrates ability to attest to attestations
```

---

## 8. Summary

| Aspect | Old Model | New Model |
|--------|-----------|-----------|
| **Claims representation** | Separate `fcp_claims` table | PROV-O Triangle: Two-step chain (wasGeneratedBy + wasAssociatedWith) |
| **Attribution pattern** | Single direct link | Two-step chain (Statement → Batch → Signer) |
| **Redundancy** | Avoids via table | Avoids via normalized chain |
| **Ambiguity** | N/A (no batch pointer) | Eliminated: always know which batch signed |
| **Attestation metadata** | 3 separate statements | Stored in attestation's raw_identifier JSON |
| **Signature storage** | Multiple rows per signature | Atomic JSON object |
| **Signer identity** | Per-chain (CAIP-10 only) | Chain-agnostic (address) + type-encoded Fide ID (0x18, 0x28, 0x78, 0x88) |
| **Signer type visibility** | Requires lookup | Encoded in object's Fide ID prefix |
| **Controller relationship** | N/A | W3C DID Core: Account → did:controller → Person/Org |
| **Controller discovery** | Not possible | Direct query: Account → did:controller → Entity |
| **Predicate typing** | Ignored; all generic | Stored & indexed; `0x6` for facts, `0xe` for opinions |
| **Reputation queries** | String parsing required | Zero-lookup: `WHERE predicate_type = 'e'` |
| **Schema tables** | 3+ (`statements`, `claims`, `raw_identifiers`) | 2 (`statements`, `raw_identifiers`) |
| **Statements per batch** | 201 + 3 metadata = 204 | 201 content + 2 PROV-O + 1 controller = 404 |
| **Recursive chains** | Not possible (separate table) | Possible: Batch1 → wasGeneratedBy → Batch2 |
| **Predicate uniformity** | Exception: claims in separate table | Uniform: all concepts as ~0x66 or 0xe0 |
| **Query complexity** | Table-specific logic | Graph-traversal (uniform) + type-based filtering |
| **Standards compliance** | Custom relationships | W3C DID Core + PROV-O + Semantic Web |

**Status:** Unified statement model ready for implementation.

---

## 9. Future Extensions

This model enables powerful patterns:

### 9.1 Type-Based Reputation Aggregation

**Without lookups, filter via the two-step chain:**

```sql
-- All statements signed by autonomous agents (0x78...)
-- Useful for: "Which claims did AI agents make?"
SELECT s1.subject_fingerprint AS statement,
       s1.object_fingerprint AS attestation
FROM fcp_statements s1
JOIN fcp_statements s2 ON s2.subject_fingerprint = s1.object_fingerprint
WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy')
  AND s2.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith')
  AND s2.object_fingerprint LIKE '0x7a%';

-- Comparison: statements by people vs organizations
SELECT
  SUM(CASE WHEN s2.object_fingerprint LIKE '0x18%' THEN 1 ELSE 0 END) AS by_persons,
  SUM(CASE WHEN s2.object_fingerprint LIKE '0x2a%' THEN 1 ELSE 0 END) AS by_organizations
FROM fcp_statements s1
JOIN fcp_statements s2 ON s2.subject_fingerprint = s1.object_fingerprint
WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy')
  AND s2.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith');
```

### 9.2 Transitive Trust Chains

```
StatementA → wasGeneratedBy → BatchX
BatchX → wasAssociatedWith → 0x1a_alice (Alice claims X)

StatementA → wasGeneratedBy → BatchY
BatchY → wasAssociatedWith → 0x2a_acme (ACME company endorses Alice's claim)

StatementB → wasGeneratedBy → BatchZ
BatchZ → wasAssociatedWith → 0x2a_acme (about ACME's credibility)
```
**Result:** Follow the chain to compute transitive trust across entity types.

### 9.3 Multi-Signer Consensus

```
Statement → wasGeneratedBy → BatchA
BatchA → wasAssociatedWith → 0x1a_alice (Alice's signature)

Statement → wasGeneratedBy → BatchB
BatchB → wasAssociatedWith → 0x1a_bob (Bob's signature)

Statement → wasGeneratedBy → BatchC
BatchC → wasAssociatedWith → 0x7a_agent (Bot's signature)
```

**Query consensus:**
```sql
-- Statements with agreement from people AND agents
WITH signatures AS (
  SELECT s1.subject_fingerprint AS statement,
         s2.object_fingerprint AS signer
  FROM fcp_statements s1
  JOIN fcp_statements s2 ON s2.subject_fingerprint = s1.object_fingerprint
  WHERE s1.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasGeneratedBy')
    AND s2.predicate_fingerprint = calculateFideId('CreativeWork', 'CreativeWork', 'prov:wasAssociatedWith')
)
SELECT statement, COUNT(DISTINCT signer) AS signer_count
FROM signatures
WHERE signer LIKE '0x18%' OR signer LIKE '0x7a%'
GROUP BY statement
HAVING COUNT(DISTINCT signer) >= 2;
```

### 9.4 Batch Chain Verification

```
Batch2 → wasGeneratedBy → Batch1  (Batch2 endorsed Batch1)
Batch1 → wasAssociatedWith → 0x1a_alice (Alice signed Batch1)
Batch2 → wasAssociatedWith → 0x2a_organization (Organization signed Batch2)
```
**Result:** Trace the full provenance chain from content → batch → signer → endorser.
