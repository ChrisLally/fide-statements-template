# FCP Schema Critique: critique11 (The Pure Triple Model)

*Draft: 2026-01-23 (Updated)*

---

## Executive Summary

Critique9 established the **Dual-ID Model** separating Statements from Attestations. However, it still required a structured envelope (FideAttestation) to hold signer info, signature, and statements.

**This critique proposes a radical simplification:** Everything is a triple. Even attestations are triples. The protocol has ONE primitive: the triple.

**Key Insights:**
1. The type byte in Fide IDs already tells indexers what they're looking at
2. Merkle trees enable batch signing while keeping everything as triples
3. The signer can be recovered from the signature (no explicit signer field needed)

---

## 1. The Pure Triple Model

### 1.1 Core Principle

**FCP has ONE primitive: the triple.**

```
(subject, predicate, object)
```

Everything — assertions, attestations, metadata — is expressed as triples.

```typescript
interface FideStatement {
  subjectFideId: address;
  subjectFideURN: string;
  predicateFideId: address;
  predicateFideURN: string;
  objectFideId: address;
  objectFideURN: string;
}
```

**That's the only schema.** There is no separate envelope.

### 1.2 Attestation: The Subject of a Claim

The attestation is **the subject of a claim entity**. It represents the signing event.

**Structure:**
- **Attestation Fide ID** = calculated from rawIdentifier (`signerAddress:signatureMethod:merkleRoot:signature`)
- **Attestation URN** = `fide:Attestation:${signerAddress}:${signatureMethod}:${merkleRoot}:${signature}` (contains verification data)

```typescript
// Attestation Fide ID = calculateFideId('a', '0', rawIdentifier)
const attestationFideId = calculateFideId('Attestation', 'UUID', `${signerAddress}:${signatureMethod}:${merkleRoot}:${signature}`);
// → 0xa0...
```

Like all entities in FCP, the attestation **emerges from the graph** — it exists because claims reference it as their subject.

### 1.3 Claims: The Triple That Gets Stored

A claim is a triple where:
- **Subject** = Attestation (the signing event)
- **Predicate** = `fide:attests`
- **Object** = Statement (the assertion being attested)

```typescript
// Claim triple — THE stored entity
{
  subjectFideId: attestationFideId,               // 0xa0... (derived from merkleRoot + signature)
  subjectFideURN: `fide:Attestation:${signerAddress}:${signatureMethod}:${merkleRoot}:${signature}`,  // Verification data here!
  predicateFideId: attestsPredicateID,            // 0x66...
  predicateFideURN: "fide:attests",
  objectFideId: statementFideId,                  // 0x00...
  objectFideURN: `fide:Statement:${...}`
}
```

**Key insight:** The `subjectFideURN` contains `merkleRoot:signature` — everything needed to:
1. Verify the attestation Fide ID was derived correctly
2. Recover the signer via `ecrecover(merkleRoot, signature)`
3. Verify the Merkle proof for selective disclosure

**All triples are Statements (`0x00`).** The indexer routes by pattern:
- **General statements** (any subject type) → `statements` table
- **Claims** (subject = Attestation `0xa0`) → `claims` table (optimized)
- **Evaluations** (predicate = EvaluationMethod `0xe*`) → `evaluations` table (optimized)

Attestations (`0xa0`) are **derived IDs** embedded as claim subjects, not stored separately.

### 1.4 The rawIdentifier Design Principle

The **rawIdentifier** is the string that gets hashed to create the fingerprint portion of a Fide ID.

```
FideId = "0x" + typeByte + hash(rawIdentifier)[last 36 chars]
```

**Design principle:**

> **If multiple pieces form ONE atomic identity, embed them in ONE rawIdentifier.**
> **If pieces are independently meaningful, make them separate entities.**

| Entity | rawIdentifier | Why? |
|--------|---------------|------|
| Person | `x.com/chrislally` | Single external identifier |
| Statement | `Subject + Predicate + Object` | Triple = atomic assertion |
| Attestation | `signerAddress:signatureMethod:merkleRoot:signature` | Atomic signing event + who signed it |

**For attestations specifically:**
- `merkleRoot` without `signature` = unsigned batch (useless)
- `signature` without `merkleRoot` = random bytes (useless)
- Together = atomic signing event = ONE rawIdentifier

The format (signer is ALWAYS required):
```
fide:Attestation:{signerAddress}:{signatureMethod}:{merkleRoot}:{signature}
```

We always include the `signer` to allow indexers to identify who signed without running expensive recovery crypto.

### 1.5 Why This Works

| Query | How |
|-------|-----|
| "What did Alice sign?" | Find claims where signer (recovered from URN) = Alice |
| "Show me the batch" | Group claims by subjectFideId (attestation ID) |
| "Verify this claim" | Parse rawIdentifier from URN, verify signature |

### 1.6 Signer Verification (Multi-Chain)

Since the `signerAddress` is always included in the URN, we simply verify that the signature matches the claimed signer:

```typescript
// Parse the rawIdentifier from the URN
const { signerAddress, signatureMethod, merkleRoot, signature } = parseAttestationURN(claim.subjectFideURN);

// Verify signature matches the claimed signer
const isValid = verifySignature(signatureMethod, merkleRoot, signature, signerAddress);

const signerFideId = calculateFideId('CryptographicAccount', 'CryptographicAccount', signerAddress);
```

**Signature methods:**
| Method | Verification | rawIdentifier Format |
|--------|--------------|---------------------|
| `EIP712` | `ecrecover(root, sig) === signerAddress` | `{signerAddress}:EIP712:{merkleRoot}:{signature}` |
| `BIP137` | `recover(root, sig) === signerAddress` | `{signerAddress}:BIP137:{merkleRoot}:{signature}` |
| `Ed25519` | `verify(signerAddress, root, sig)` | `{signerAddress}:Ed25519:{merkleRoot}:{signature}` |
| `Schnorr` | `verify(signerAddress, root, sig)` | `{signerAddress}:Schnorr:{merkleRoot}:{signature}` |

### 1.7 Merkle Trees for Batch Signing

When signing multiple statements:

1. **Build the Merkle tree:**
   ```
   Leaf 1: S1_FideId (hash of statement 1)
   Leaf 2: S2_FideId (hash of statement 2)
   Leaf 3: S3_FideId (hash of statement 3)
   → Merkle Root
   ```

2. **Sign the root:**
   ```
   signature = sign(merkleRoot)
   ```

3. **Derive attestation ID and create claims:**
   ```
   attestationID = hash(merkleRoot + signature)
   For each statement: create claim (attestationID, fide:attests, statementID)
   ```

### 1.8 Why Merkle Trees?

**Selective Disclosure.** This is the killer feature.

> "Did you sign this specific claim about Alice?"

Instead of revealing the entire batch (99 other claims), you provide:
1. The statement
2. The Merkle proof (path to root)
3. The claim (which contains the signature in its URN)

Verifier confirms: "Yes, this was signed" — **without seeing other claims**.

**Use cases:**
- Employee proves their own credential without revealing other employees
- Medical record: prove one diagnosis without revealing full history
- Large batches: verify one claim without downloading megabytes

---

## 2. Metadata as Predicates

What was previously inline metadata becomes regular triples:

| Old Field | New Predicate | Example Triple |
|-----------|---------------|----------------|
| `signedAt` | `fide:signedAt` | `(batchFideId, fide:signedAt, "2026-01-23T12:00:00Z")` |
| `validFrom` | `schema:validFrom` | `(statementFideId, schema:validFrom, "2026-01-01")` |
| `validTo` | `schema:validThrough` | `(statementFideId, schema:validThrough, "2026-12-31")` |
| `replaces` | `fide:replaces` | `(newClaimFideId, fide:replaces, oldClaimFideId)` |

**Note:** We use Schema.org predicates where exact matches exist (`schema:validFrom`, `schema:validThrough`). FCP-specific predicates (`fide:signedAt`, `fide:replaces`) are used where Schema.org lacks equivalents.

### 2.1 Why This Is Better

| Aspect | Before (envelope model) | After (pure triples) |
|--------|-------------------------|----------------------|
| **Schema count** | 2 (Statement + Attestation) | 1 (just Statement) |
| **Extensibility** | Add field = schema change | Add predicate = no change |
| **Uniformity** | Mixed (envelope + triples) | Pure triples |
| **Meta-assertions** | Complex | Natural (claims about claims) |

---

## 3. Predicates as Fide IDs

### 3.1 The Insight

Currently, predicates are strings (`"schema:name"`, `"fide:controls"`). But if subject and object are Fide IDs, why not predicates too?

**Benefits:**
- **Uniformity**: All three positions are fixed-length 0x addresses
- **Predicates become entities**: You can make claims ABOUT predicates
- **Graph consistency**: Same indexing, JOINs, and queries for all positions

### 3.2 Predicate Derivation

Predicates are CreativeWorks derived from their name:

```typescript
const predicateFideId = calculateFideId('CreativeWork', 'CreativeWork', 'schema:name');
// → 0x66...
```

---

## 4. The Single-Byte Type System

### 4.1 The Structure

```
[Byte 1: Type + Identifier Type] [Bytes 2-19: Identifier Fingerprint]
```

- **Byte 1** (2 hex chars): Combined **Type** + **Identifier Type**
  - First hex char: What it IS (entity type)
  - Second hex char: How it's IDENTIFIED (identifier type)
- **Bytes 2-19**: 18 bytes (144 bits) of Keccak-256 hash

**Total Fide ID length:** 40 hex characters (20 bytes)

### 4.2 Type Map (First Hex Char)

**Domain Entity Types:**

| Char | Type | Schema.org |
|------|------|------------|
| `1` | Person | `schema:Person` |
| `2` | Organization | `schema:Organization` |
| `3` | Place | `schema:Place` |
| `4` | Event | `schema:Event` |
| `5` | Product | `schema:Product` |
| `6` | CreativeWork | `schema:CreativeWork` |
| `7` | AutonomousAgent | — (FCP extension) |
| `8` | CryptographicAccount | — (FCP extension) |

**Protocol Entity Types:**

| Char | Type | Mnemonic | Description |
|------|------|----------|-------------|
| `0` | Statement | **0** = foundation | The protocol primitive — all triples (assertions, claims, evaluations) |
| `a` | Attestation | **A**ttestation | A signing event (subject of claims) |
| `e` | EvaluationMethod | **E**valuation | A methodology for evaluating entities |

**Semantic notes:**
- **Statement** (`0`) is the protocol primitive — not a domain type, but the foundational building block of the graph. Its identifier is calculated from S+P+O.
- **Attestation** (`a`) is semantically an Event — a signing event that happens at a specific time. It's derived from `signerAddress:signatureMethod:merkleRoot:signature`.
- **EvaluationMethod** (`e`) is semantically a Product — a methodology or service that is used to evaluate entities.

**Reserved Type chars:** `9`, `b`, `c`, `d`, `f` (future expansion).

### Pattern-Based Identification

Some statements have special meaning based on their **pattern**, not a separate type:

| Pattern | How Identified | Storage Table |
|---------|----------------|---------------|
| **Claim** | `subj_type = 'a'` (Attestation) | `claims` |
| **Evaluation** | `pred_type = 'e'` (EvaluationMethod) | `evaluations` |

**Examples:**
```typescript
// A claim (subj_type = 'a')
{
  subjectFideId: '0xa0...',      // Attestation → this is a claim!
  predicateFideId: '0x66...',    // fide:attests
  objectFideId: '0x00...'        // Statement being attested
}

// An evaluation (pred_type = 'e')
{
  subjectFideId: '0x00...',      // Statement being evaluated
  predicateFideId: '0xe5...',    // EvaluationMethod → this is an evaluation!
  objectFideId: '0x66...'        // Score/verdict (methodology-dependent)
}
```

### 4.3 Identifier Type Map (Second Hex Char)

| Char | Identifier Type | Description |
|------|-----------------|-------------|
| `0` | UUID | Calculated/derived (e.g., Statement from S+P+O, Attestation from merkleRoot+signature) |
| `5` | Product | External service ID (e.g., `x.com/elonmusk`) |
| `6` | CreativeWork | Name/label string |
| `8` | CryptographicAccount | Account address (wallet), ENS name |

### 4.4 Examples

| Fide ID Prefix | Meaning |
|----------------|---------|
| `0x15...` | Person identified by Product (X/Twitter account) |
| `0x18...` | Person identified by CryptographicAccount (ENS) |
| `0x28...` | Organization identified by CryptographicAccount (`acme.eth`) |
| `0x66...` | CreativeWork identified by name |
| `0x88...` | CryptographicAccount identified by address |
| `0x00...` | Statement (any triple, including claims and evaluations) |
| `0xa0...` | Attestation (derived from signerAddress:signatureMethod:merkleRoot:signature) |
| `0xe5...` | EvaluationMethod identified by Product (e.g., a scoring service URL) |
| `0xe6...` | EvaluationMethod identified by CreativeWork (e.g., methodology name) |

### 4.5 Why Single Byte?

| Aspect | Two Bytes | One Byte |
|--------|-----------|----------|
| Fide ID length | 42 chars | **40 chars** |
| Combinations | 65,536 | 256 (enough) |
| Parsing | 2 lookups | **1 lookup** |
| Philosophy | Flexible | **Constrained** |

> *"Constraint breeds discipline. If it doesn't fit in 16 types, express it as a predicate."*

---

## 5. ID Derivation Formulas

All Fide ID derivations use the three-argument signature for **readability**:

```
calculateFideId(type, identifierType, rawIdentifier) = 
  "0x" + TYPE_MAP[type] + ID_TYPE_MAP[identifierType] + last36HexChars(keccak256(rawIdentifier))
```

**Never combine type and identifierType** — keeping them separate enforces clarity.

### 5.1 Protocol Entity Formulas

| Entity | Type | Identifier Type | rawIdentifier | Result |
|--------|------|-----------------|---------------|--------|
| **Predicate** | `CreativeWork` | `CreativeWork` | name string | `0x66...` |
| **Statement** | `Statement` | `UUID` | S+P+O | `0x00...` |
| **Attestation** | `Attestation` | `UUID` | signerAddress:signatureMethod:merkleRoot:signature | `0xa0...` |
| **EvaluationMethod** | `EvaluationMethod` | `Product` | service URL | `0xe5...` |
| **EvaluationMethod** | `EvaluationMethod` | `CreativeWork` | methodology name | `0xe6...` |

**Key insight:** 
- Attestation Fide ID is derived from the compound rawIdentifier (subject of claims)
- Claims are Statements where `subj_type = 'a'`
- Evaluations are Statements where `pred_type = 'e'`

### 5.2 Example: Complete Flow

```typescript
// 1. Create an assertion (statement)
const statement1 = {
  subjectFideId: aliceFideId,      // 0x18... (Person, CryptographicAccount)
  predicateFideId: namePredicate,   // 0x66... (CreativeWork, CreativeWork)
  objectFideId: literalHash("Alice Smith"),
  // ... URNs
};
const s1_FideId = calculateFideId('Statement', 'UUID', 
  statement1.subjectFideId + statement1.predicateFideId + statement1.objectFideId);
// → 0x00...

// 2. Build Merkle tree from statement IDs
const merkleRoot = merkle([s1_FideId, s2_FideId, s3_FideId]);

// 3. Sign the merkle root
const signature = sign(merkleRoot);

// 4. Derive attestation ID (emerges as subject of claims)
const attestationRawID = `${signerAddress}:EIP712:${merkleRoot}:${signature}`;
const attestationFideId = calculateFideId('Attestation', 'UUID', attestationRawID);
// → 0xa0...

// 5. Create claim statements (one per statement in the batch)
// A claim is a Statement where subj_type = 'a' (Attestation)
const attestsPredicate = calculateFideId('CreativeWork', 'CreativeWork', 'fide:attests');
const claim1 = {
  subjectFideId: attestationFideId,                         // 0xa0... → identifies this as a claim!
  subjectFideURN: `fide:Attestation:${attestationRawID}`,   // Contains verification data
  predicateFideId: attestsPredicate,                        // 0x66...
  predicateFideURN: 'fide:attests',
  objectFideId: s1_FideId,                                  // 0x00...
  objectFideURN: `fide:Statement:${s1_FideId}`
};

// 6. Derive claim Fide ID (it's a Statement, not a separate type!)
const claim1FideId = calculateFideId('Statement', 'UUID', 
  attestationFideId + attestsPredicate + s1_FideId);
// → 0x00... (it's a Statement, but indexer routes to claims table based on subj_type='a')

// The claim IS a statement. The pattern (subj=Attestation) identifies it.
```

---

## 6. Verification Flow

### 6.1 Verifying a Single Claim (with Selective Disclosure)

Given:
- A claim triple
- The statement it references
- A Merkle proof (if batch > 1)

Verification:

```typescript
// 1. Extract signatureMethod, merkleRoot, and signature from claim's subjectFideURN
const { signerAddress, signatureMethod, merkleRoot, signature } = parseAttestationURN(claim.subjectFideURN);
// e.g., "fide:Attestation:0xsigner789:EIP712:0xabc123:0xsig456" → { signerAddress: "0xsigner789", ... }

// 2. Verify the attestation ID matches
const attestationRawID = `${signerAddress}:${signatureMethod}:${merkleRoot}:${signature}`;
const expectedAttestationID = calculateFideId('Attestation', 'UUID', attestationRawID);
assert(claim.subjectFideId === expectedAttestationID);

// 3. Compute statement Fide ID from the statement
const statementFideId = calculateFideId('Statement', 'UUID', S + P + O);
assert(claim.objectFideId === statementFideId);

// 4. Verify Merkle proof (proves statement was in the signed batch)
const isInBatch = verifyMerkleProof(statementFideId, merkleProof, merkleRoot);
assert(isInBatch);

// 5. Verify signature matches the claimed signer
const isValid = verifySignature(signatureMethod, merkleRoot, signature, signerAddress);
assert(isValid);

const signerFideId = calculateFideId('CryptographicAccount', 'CryptographicAccount', signerAddress);

// Result: We know WHO signed WHAT without seeing other claims
```

---

## 7. Indexer Storage Model

### 7.1 Design Principles

1. **Everything is a Statement** → One Fide ID type (`0x00`) for all triples
2. **Pattern-based routing** → Claims (subj=Attestation) and Evaluations (pred=EvaluationMethod) go to optimized tables
3. **Single type byte** → Combined type + identifier type in 2 chars
4. **Fingerprint as key** → 36-char hex string (18 bytes of hash)
5. **Global URN lookup** → Deduplicated raw identifiers
6. **No `0x` prefix** → Implied, saves 2 chars per ID

### 7.2 Schema

#### Statements Table (7 columns)

Stores all assertions as triples. All statements have `0x00` Fide ID prefix (Statement type).

```sql
CREATE TABLE statements (
  fingerprint         CHAR(36) PRIMARY KEY,  -- Implied: 0x00 prefix
  
  -- Subject (type byte = type + identifier type combined)
  subj_type_byte      CHAR(2),               -- e.g., '88' = CryptographicAccount by address
  subj_fingerprint    CHAR(36),
  
  -- Predicate
  pred_type_byte      CHAR(2),               -- Usually '66' = CreativeWork by name
  pred_fingerprint    CHAR(36),
  
  -- Object
  obj_type_byte       CHAR(2),
  obj_fingerprint     CHAR(36)
);
```

**Type byte examples:**
| Stored | Meaning |
|--------|---------|
| `15` | Person by Product (X/Twitter) |
| `18` | Person by CryptographicAccount (ENS) |
| `28` | Organization by CryptographicAccount |
| `66` | CreativeWork by name |
| `88` | CryptographicAccount by address |
| `a0` | Attestation (in claims, as subject) |
| `e5` | EvaluationMethod by Product (in evaluations, as predicate) |

#### Claims Table (3 columns)

**Pattern:** Statements where `subj_type_byte = 'a0'` (subject is Attestation) are routed here:

```sql
CREATE TABLE claims (
  fingerprint              CHAR(36) PRIMARY KEY,  -- Implied: 0x00 prefix (it's a Statement!)
  attestation_fingerprint  CHAR(36),              -- Implied: 0xa0 prefix
  statement_fingerprint    CHAR(36)               -- Implied: 0x00 prefix
);
```

**Why optimized:**
- Subject type is always `a0` (Attestation) — pattern-implied
- Predicate is always `fide:attests` — fixed, not stored
- Object type is always `00` (Statement) — pattern-implied

#### Evaluations Table (4 columns)

**Pattern:** Statements where `pred_type_byte LIKE 'e%'` (predicate is EvaluationMethod) are routed here:

```sql
CREATE TABLE evaluations (
  fingerprint              CHAR(36) PRIMARY KEY,  -- Implied: 0x00 prefix (it's a Statement!)
  subject_type_byte        CHAR(2),               -- What's being evaluated (entity type)
  subject_fingerprint      CHAR(36),              -- What's being evaluated
  method_fingerprint       CHAR(36),              -- The EvaluationMethod (0xe* predicate)
  result_fingerprint       CHAR(36)               -- The score/verdict (methodology-dependent)
);
```

#### URN Lookup Table (Global, 2 columns)

Maps fingerprints to their raw identifiers for display/reconstruction:

```sql
CREATE TABLE urn_lookup (
  fingerprint      CHAR(36) PRIMARY KEY,
  raw_identifier   TEXT                    -- Original string before hashing
);
```

**Examples:**

| fingerprint | raw_identifier |
|-------------|----------------|
| `a1b2c3...` | `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` |
| `d4e5f6...` | `schema:name` |
| `g7h8i9...` | `Alice Smith` |
| `j0k1l2...` | `0xMerkleRoot:0xSignature` |

### 7.3 Reconstructing Fide IDs

```sql
-- Statement Fide ID
SELECT '0x00' || fingerprint AS statement_fide_id FROM statements;

-- Full subject Fide ID from statement
SELECT '0x' || subj_type_byte || subj_fingerprint AS subject_fide_id 
FROM statements;

-- Claim Fide ID
SELECT '0x00' || fingerprint AS claim_fide_id FROM claims;  -- Claims are statements!

-- Attestation Fide ID (from claim)
SELECT '0xa0' || attestation_fingerprint AS attestation_fide_id FROM claims;
```

### 7.4 Query Examples

```sql
-- All claims linking to a specific statement
SELECT * FROM claims 
WHERE statement_fingerprint = 'abc123...';

-- All statements about a specific entity (by subject fingerprint)
SELECT * FROM statements 
WHERE subj_fingerprint = 'def456...';

-- All statements about CryptographicAccounts (type starts with '8')
SELECT * FROM statements 
WHERE subj_type_byte LIKE '8%';

-- All statements about Persons identified by X/Twitter (15 = Person by Product)
SELECT * FROM statements 
WHERE subj_type_byte = '15';

-- Find statement content with URN lookup
SELECT 
  s.fingerprint,
  u1.raw_identifier AS subject,
  u2.raw_identifier AS predicate,
  u3.raw_identifier AS object
FROM statements s
JOIN urn_lookup u1 ON u1.fingerprint = s.subj_fingerprint
JOIN urn_lookup u2 ON u2.fingerprint = s.pred_fingerprint
JOIN urn_lookup u3 ON u3.fingerprint = s.obj_fingerprint;

-- Recover signer from claim's attestation URN
SELECT 
  c.fingerprint AS claim_id,
  c.statement_fingerprint,
  u.raw_identifier AS attestation_urn  -- Contains merkleRoot:signature
  -- Application code parses URN and calls ecrecover()
FROM claims c
JOIN urn_lookup u ON u.fingerprint = c.attestation_fingerprint;
```

### 7.5 Storage Efficiency

| Table | Columns | Bytes per Row | Notes |
|-------|---------|---------------|-------|
| `statements` | 7 | ~120 | 36 + 3×(2+36) chars |
| `claims` | 3 | ~108 | 3×36 chars |
| `urn_lookup` | 2 | 36 + variable | Fingerprint + raw identifier |

**Key optimizations:**
- No `0x` prefix stored (implied)
- No `f` prefix for type bytes (implied) — saves 6 chars per statement
- No type bytes for claims (fixed structure)
- URNs deduplicated globally (same entity in 10K claims = 1 URN entry)

### 7.6 Indexer Responsibilities

The indexer:

1. **Parses incoming triples** → routes to `statements` or `claims` table based on pattern
2. **Populates `urn_lookup`** → inserts new fingerprint → raw_identifier mappings
3. **Recovers signers** → extracts signature from attestation URN, calls `ecrecover`
4. **Groups by attestation** → claims with same `attestation_fingerprint` = same batch
5. **Builds materialized views** for common queries (by signer, by entity, by predicate)

---

## 8. Summary

### 8.1 What Changed from Previous Critiques

| Aspect | critique9 | critique11 (updated) |
|--------|-----------|----------------------|
| **Schema** | Statement + Attestation envelope | Everything is a Statement (0x00) |
| **Attestation** | Structured envelope | Derived ID (0xa0), subject of claims |
| **Claim** | Separate type | Statement with pattern: subj=Attestation |
| **Evaluation** | Separate type | Statement with pattern: pred=EvaluationMethod |
| **Signer field** | Explicit `signerFideId` | Explicit in claim URN (required) |
| **Batch signing** | JSON array in envelope | Merkle tree |
| **Type system** | Two bytes (4 hex chars) | **Single byte (2 hex chars)** |
| **Fide ID length** | 42 chars | **40 chars** |
| **Storage** | Single table with full Fide IDs | Pattern-routed tables |

### 8.2 The Core Insight

> **FCP has ONE primitive: the Statement (triple).**
>
> Claims and Evaluations are Statements with specific patterns.
> Attestation is a derived ID that emerges as the subject of claims.
> EvaluationMethod is an entity type for predicates (methodologies/services).
> The pattern determines routing, not a separate type byte.

### 8.3 The Formula

```
calculateFideId(type, identifierType, rawIdentifier) → 40-char Fide ID
  = "0x" + TYPE_MAP[type] + ID_TYPE_MAP[identifierType] + hash(rawIdentifier)[last 36]

Three parts (kept separate for readability):
  [Part 1: Type]           → 1 hex char (what it IS)
  [Part 2: Identifier Type] → 1 hex char (how it's IDENTIFIED)  
  [Part 3: Fingerprint]    → 36 hex chars (hash of rawIdentifier)

Entity Types:
  0   = Statement (protocol primitive, the foundation)
  1-8 = Domain entities (Person, Org, Product, CryptographicAccount...)
  a   = Attestation (signing event — semantically an Event)
  e   = EvaluationMethod (methodology — semantically a Product)

Pattern-Based Routing:
  subj_type = 'a0' → route to claims table
  pred_type = 'e*' → route to evaluations table
  else            → route to statements table

Storage:
  statements (7 cols) = fingerprint + S/P/O with type_bytes
  claims (3 cols) = fingerprint + attestation_fp + statement_fp
  evaluations (4 cols) = fingerprint + subject + method_fp + result_fp
  urn_lookup (2 cols) = fingerprint → raw_identifier (global)
```

---

## 9. Design Decisions

### 9.1 Merkle Proofs → Reconstruct on Demand ✓

**What is a Merkle proof?**

The Merkle root is stored in the attestation. The proof is computed when needed.

```
           Root (stored in attestation)
          /    \
        AB      CD
       /  \    /  \
      A    B  C    D   ← leaves (statement Fide IDs)
```

To prove **A** is in the tree, provide:
- The leaf: A
- The proof: **[B, CD]** (sibling hashes along the path)

Verifier computes: `hash(hash(A, B), CD)` → Root ✓

**Size:** O(log n) hashes, not the whole tree.

**Storage approach:**

The indexer stores:
1. All statements (the leaves)
2. The attestation triple (with Merkle root as subject)

Proofs are **reconstructed on demand**. If the indexer knows all statements in a batch, it can rebuild the tree and generate any proof.

```sql
-- Indexer can reconstruct
SELECT * FROM statements WHERE batch_id = ?
-- Rebuild Merkle tree → generate proof for any leaf
```

### 9.2 Single-Statement Batches → No Special Case ✓

For a batch of one statement:
- "Merkle tree" = just the leaf
- Root = statement Fide ID
- Proof = empty (trivial)

The claim works the same:
```
attestation ID = hash(statementFideId + signature)
claim = (attestationID, fide:attests, statementFideId)
```

Where merkle root = the single statement. **No overhead, no special handling.**

---

*"One primitive: the Statement (0x00). Claims and Evaluations are patterns, not types. 40-char Fide IDs. Signer verified against URN. Patterns route to tables."*
