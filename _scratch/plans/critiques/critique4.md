# FCP Schema Critique v4: The Universal Triple Protocol

*Generated: 2026-01-14*

---

## Executive Summary

The final evolution of FCP architecture:

> **One Schema. One Table. Everything is a Triple.**

By recognizing that all claims follow the Subject-Predicate-Object pattern, we collapse the entire protocol into a single schema. The predicate entity defines meaning, validation, and value types.

**Final count: 1 schema.**

---

## 1. The Core Insight

Every claim in the protocol is fundamentally:

> **Subject** (who/what) — **Predicate** (relationship/methodology) — **Object** (target/none)

With optional **Value** (data) and **Temporal Bounds** (validity period).

| Former Schema | Subject | Predicate | Object | Value |
|---------------|---------|-----------|--------|-------|
| `FideEntityType` | Entity | `type:person` | — | — |
| `FideEntityRelationship` | FromEntity | `rel:employment` | ToEntity | — |
| `FideEntityAttribute` | Entity | `attr:skill` | — | "Python" |
| `FideEntityName` | Entity | `attr:name:primary` | — | "Alice Johnson" |
| `FideEvaluation` | Target | Methodology | — | 1 (score) |
| `FideDecisionTrace` | Trace | `action:tool_call` | Generation | {json} |

**They're all the same structure.**

---

## 2. The Universal Triple Schema

```typescript
interface FideClaim {
    // === CLAIM METADATA (signed) ===
    claimedAt: string;                // When the signer asserts this claim was made
    supersedesClaim?: `0x${string}`;  // Prior claim being overridden (chain rule)
    
    // === THE TRIPLE (signed) ===
    subject: `0x${string}`;           // The entity this claim is about (bytes32)
    predicate: `0x${string}`;         // The relationship/methodology/type entity (bytes32)
    object?: `0x${string}`;           // Optional target entity (bytes32)
    
    // === VALUE (signed, optional) ===
    value?: string;                   // Predicate-defined type (string, number, JSON)
    
    // === TEMPORAL BOUNDS (signed, optional) ===
    claimValidFrom?: string;          // When this claim becomes valid
    claimValidTo?: string;            // When this claim expires/is revoked
}
```

---

## 3. The Envelope

```typescript
interface ClaimEnvelope {
    schemaFideId: `0x${string}`;      // The schema (for v1, there's only one)
    content: FideClaim;               // EVERYTHING SIGNED
    signature: `0x${string}`;         // EIP-712 signature of content
    claimFideId: `0x${string}`;       // Derived from signature
}

// Indexer extends:
interface IndexedClaim extends ClaimEnvelope {
    indexedAt: string;                // Trusted external timestamp
    indexSource: string;              // Where anchored
}
```

---

## 4. Field Definitions

### `claimedAt`
The timestamp the signer declares for when this claim was made.

- **Signed:** Yes
- **Trusted:** No (signer can lie)
- **Use:** Legal declaration, temporal assertion
- **Compare to:** `indexedAt` (trusted, added by indexer)

### `supersedesClaim`
The `claimFideId` of a prior claim being overridden.

- **Constraint:** Must be a claim by the same signer
- **Chain Rule:** A claim already superseded cannot be superseded again
- **Use:** Updates, revocations, corrections

### `subject`
The entity this claim is about. Always a `bytes32` FideId.

Examples:
- For a type claim: the entity being typed
- For a relationship: the "from" entity
- For an evaluation: the entity being judged

### `predicate`
The relationship, methodology, or type entity. Always a `bytes32` FideId.

The predicate entity defines:
- What the relationship means
- What value types are expected
- Validation rules

### `object`
Optional target entity. Used for entity-to-entity relationships.

Examples:
- "Alice works at Acme" → object = Acme
- "Trace belongs to Generation" → object = Generation entity
- "Alice is a person" → object = null (type is the predicate)

### `value`
Predicate-defined data field. Stored as string, interpreted based on predicate.

| Predicate Type | Value Contains |
|----------------|----------------|
| Type predicates | null (type is the predicate) |
| Attribute predicates | String value ("Python", "Alice Johnson") |
| Evaluation predicates | Numeric string ("1", "-1", "850") |
| Trace predicates | JSON string (`{"input": ..., "output": ...}`) |

**The predicate entity defines how to parse and validate this field.**

### `claimValidFrom`
When this claim becomes valid. ISO 8601 UTC.

Use cases:
- Future-dated claims ("Alice starts at Acme on Jan 1")
- Historical claims ("This was true as of 2020")

### `claimValidTo`
When this claim expires or was revoked. ISO 8601 UTC.

Use cases:
- Time-bounded relationships ("Employment ended Dec 31")
- Expiring credentials ("Certification valid until 2027")
- Historical corrections ("Name was X until she married")

---

## 5. How Former Schemas Map

### Entity Type

```typescript
// "Alice is a person"
{
    claimedAt: "2024-01-15T10:00:00Z",
    subject: "0xAlice...",
    predicate: "0xTypePerson...",  // Well-known predicate for type:person
    object: null,
    value: null
}
```

### Entity Relationship

```typescript
// "Alice works at Acme from 2020 to 2024"
{
    claimedAt: "2024-01-15T10:00:00Z",
    subject: "0xAlice...",
    predicate: "0xRelEmployment...",
    object: "0xAcme...",
    value: "employee",  // Optional: role detail
    claimValidFrom: "2020-01-01",
    claimValidTo: "2024-12-31"
}
```

### Entity Attribute (Name)

```typescript
// "Alice's legal name is Alice Johnson"
{
    claimedAt: "2024-01-15T10:00:00Z",
    subject: "0xAlice...",
    predicate: "0xAttrNamePrimaryLegal...",
    object: null,
    value: "Alice Johnson",
    claimValidFrom: "2024-06-15"  // When she took this name
}
```

### Entity Attribute (Skill)

```typescript
// "Alice has skill: Python"
{
    claimedAt: "2024-01-15T10:00:00Z",
    subject: "0xAlice...",
    predicate: "0xAttrSkill...",
    object: null,
    value: "Python"
}
```

### Evaluation (Verdict/Score)

```typescript
// "Claim X is valid per Methodology Y with confidence 85"
{
    claimedAt: "2024-01-15T10:00:00Z",
    subject: "0xClaimX...",
    predicate: "0xMethodologyY...",
    object: null,
    value: "{\"score\": 1, \"confidence\": 85}"  // Methodology defines structure
}
```

### Decision Trace

```typescript
// "Trace step 3: tool call with input/output"
{
    claimedAt: "2024-01-15T10:00:00Z",
    subject: "0xTraceEntity...",
    predicate: "0xActionToolCall...",
    object: "0xGenerationEntity...",
    value: "{\"stepIndex\": 3, \"input\": {...}, \"output\": {...}, \"reasoning\": \"...\"}"
}
```

---

## 6. Predicates as First-Class Entities

The predicate entity is the source of meaning. It defines:

1. **Semantics**: What this relationship/type/attribute means
2. **Value Schema**: How to parse the `value` field
3. **Cardinality**: One-to-one vs one-to-many
4. **Validation**: Constraints on subject, object, value

### Well-Known Predicates

Core predicates have deterministic IDs:

```typescript
predicateFideId = slice(keccak256("fcp:predicate:{name}"), 12, 32)
```

| Predicate | Derivation Seed |
|-----------|-----------------|
| `type:person` | `fcp:predicate:type:person` |
| `type:organization` | `fcp:predicate:type:organization` |
| `type:agent` | `fcp:predicate:type:agent` |
| `rel:employment` | `fcp:predicate:rel:employment` |
| `rel:control` | `fcp:predicate:rel:control` |
| `attr:name:primary` | `fcp:predicate:attr:name:primary` |
| `attr:skill` | `fcp:predicate:attr:skill` |
| `action:thought` | `fcp:predicate:action:thought` |
| `action:tool_call` | `fcp:predicate:action:tool_call` |

### Custom Predicates

Anyone can create new predicates:

1. Create a predicate entity (type claim where predicate = `type:predicate`)
2. Add attributes defining value schema, validation rules
3. Use that entity's FideId in claims

---

## 7. One Table for Indexers

```sql
CREATE TABLE claims (
    -- Identity
    claim_fide_id      BYTES32 PRIMARY KEY,
    
    -- The Triple
    subject            BYTES32 NOT NULL,
    predicate          BYTES32 NOT NULL,
    object             BYTES32,
    
    -- Value
    value              TEXT,
    
    -- Temporal
    claim_valid_from   TIMESTAMPTZ,
    claim_valid_to     TIMESTAMPTZ,
    
    -- Claim Metadata
    claimed_at         TIMESTAMPTZ NOT NULL,
    supersedes_claim   BYTES32,
    
    -- Signature
    signature          TEXT NOT NULL,
    schema_fide_id     BYTES32 NOT NULL,
    
    -- Indexer Metadata
    indexed_at         TIMESTAMPTZ NOT NULL,
    index_source       TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_subject ON claims(subject);
CREATE INDEX idx_predicate ON claims(predicate);
CREATE INDEX idx_object ON claims(object) WHERE object IS NOT NULL;
CREATE INDEX idx_supersedes ON claims(supersedes_claim) WHERE supersedes_claim IS NOT NULL;
```

### Query Examples

```sql
-- All claims about Alice
SELECT * FROM claims WHERE subject = '0xAlice...';

-- Alice's current name
SELECT value FROM claims 
WHERE subject = '0xAlice...' 
  AND predicate = '0xAttrNamePrimary...'
  AND (claim_valid_to IS NULL OR claim_valid_to > NOW())
  AND supersedes_claim IS NULL;

-- All evaluations using Methodology X
SELECT * FROM claims WHERE predicate = '0xMethodologyX...';

-- All "person" type claims
SELECT * FROM claims WHERE predicate = '0xTypePerson...';

-- Supersession chain for a claim
WITH RECURSIVE chain AS (
    SELECT * FROM claims WHERE claim_fide_id = '0xOriginal...'
    UNION ALL
    SELECT c.* FROM claims c
    JOIN chain ON c.supersedes_claim = chain.claim_fide_id
)
SELECT * FROM chain;
```

---

## 8. Supersession Rules

### The Chain Rule

A claim that has already been superseded cannot be superseded again.

```
A (original)
 ↑
B (supersedes A) ← indexed first, accepted
 
C (supersedes A) ← REJECTED: A is already superseded by B
```

Valid chain:
```
A → B → C (each supersedes the previous)
```

### Indexer Validation

1. When claim C arrives with `supersedesClaim: A`
2. Check: Is A already superseded by another claim from the same signer?
3. If yes: Reject C (or mark as "orphaned")
4. If no: Accept C

---

## 9. The Two-Timestamp Model

| Timestamp | Field | Source | Trusted? |
|-----------|-------|--------|----------|
| Claimed | `claimedAt` | Signer declares | ❌ No |
| Indexed | `indexedAt` | Indexer observes | ✅ Yes |

- Use `indexedAt` for ordering and conflict resolution
- Use `claimedAt` for signer's legal declaration
- Flag suspicious claims: `claimedAt` << `indexedAt`

---

## 10. Why This Works

### 10.1 Radical Simplicity

- **One schema** instead of 5 (or 12)
- **One table** for indexers
- **Uniform queries** for all claim types

### 10.2 Infinite Flexibility

New concepts don't require protocol changes:
- Create a new predicate entity
- Start using it in claims
- Indexers learn new predicates dynamically

### 10.3 Semantic Clarity

The predicate entity is the source of truth for meaning:
- What does this relationship mean?
- How should the value be parsed?
- What validation applies?

### 10.4 RDF Compatibility

This is essentially an RDF triple store with:
- Temporal validity
- Supersession chains
- Signed claims
- Entity IDs instead of URIs

---

## 11. Predicate Value Schemas

Well-known predicates define their value schemas:

| Predicate Category | Value Schema |
|--------------------|--------------|
| Type predicates | null (type is the predicate) |
| Name attributes | string: display name |
| Skill attributes | string: skill name |
| Media attributes | string: URI |
| Evaluation predicates | JSON: `{"score": int, "confidence": int}` |
| Trace predicates | JSON: `{"stepIndex": int, "input": json, "output": json, "reasoning": string}` |

Custom predicates define their own schemas via attributes on the predicate entity.

---

## 12. Migration from v3

| v3 Schema | v4 Representation |
|-----------|-------------------|
| `FideEntityType` | Claim with type predicate, no object, no value |
| `FideEntityRelationship` | Claim with rel predicate, object = target entity |
| `FideEntityAttribute` | Claim with attr predicate, value = attribute value |
| `FideDecisionTrace` | Claim with action predicate, value = JSON trace data |
| `FideEvaluation` | Claim with methodology predicate, value = JSON score |

**Steps:**
1. Define well-known predicates (derive IDs from names)
2. Convert existing claims to triple format
3. Update indexer to single-table model
4. Document predicate value schemas

---

## 13. The Complete Protocol

### The Schema (EIP-712)

```typescript
const FideClaimTypes = {
    FideClaim: [
        { name: 'claimedAt', type: 'string' },
        { name: 'supersedesClaim', type: 'bytes32' },
        { name: 'subject', type: 'bytes32' },
        { name: 'predicate', type: 'bytes32' },
        { name: 'object', type: 'bytes32' },
        { name: 'value', type: 'string' },
        { name: 'claimValidFrom', type: 'string' },
        { name: 'claimValidTo', type: 'string' }
    ]
};
```

### The Envelope

```typescript
interface ClaimEnvelope {
    schemaFideId: `0x${string}`;
    content: {
        claimedAt: string;
        supersedesClaim?: `0x${string}`;
        subject: `0x${string}`;
        predicate: `0x${string}`;
        object?: `0x${string}`;
        value?: string;
        claimValidFrom?: string;
        claimValidTo?: string;
    };
    signature: `0x${string}`;
    claimFideId: `0x${string}`;
}
```

### ID Derivations

```typescript
// Claim ID from signature
claimFideId = slice(keccak256(signature), 12, 32)

// Well-known predicate ID from name
predicateFideId = slice(keccak256("fcp:predicate:{name}"), 12, 32)

// Schema ID (there's only one for v1)
schemaFideId = slice(keccak256("fcp:schema:FideClaim:v1"), 12, 32)
```

---

## 14. Conclusion

The Universal Triple Protocol achieves:

✅ **1 schema** (down from 12 → 5 → 1)  
✅ **1 table** for indexers  
✅ **Subject-Predicate-Object** universality  
✅ **Predicate-defined values** (type flexibility)  
✅ **Temporal validity** (claimValidFrom, claimValidTo)  
✅ **Supersession chains** (immutable updates)  
✅ **Two-timestamp model** (claimedAt + indexedAt)  
✅ **Infinite extensibility** (new predicates, not new schemas)  

This is the minimal, maximally expressive architecture.

---

*"Everything is a triple. The predicate defines meaning."*
