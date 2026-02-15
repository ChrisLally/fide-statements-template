# FCP Schema Critique v3: The Universal Entity Protocol

*Generated: 2026-01-14*

---

## Executive Summary

The final FCP architecture is built on one insight:

> **Everything is an Entity.**

Claims are entities. Traces are entities. Evaluations are entities. By giving every signed claim a `claimFideId`, the entire protocol collapses into a uniform graph where anything can link to anything.

**Final count: 5 schemas.**

---

## 1. The Core Insight: Universal Recursion

In traditional graph databases, it's hard to "talk about the edges." You can say "Alice knows Bob," but it's awkward to say "I trust that specific 'knows' claim."

By treating every claim as an entity with its own ID, we flatten the topology:
- **Nodes** = Entities (people, orgs, claims, traces, evaluations)
- **Edges** = Relationships between entity IDs

This unlocks:
- **Meta-moderation**: Evaluate an Evaluation
- **Precedent chains**: Link a Trace to prior Traces
- **Evidence graphs**: Attach proof to any claim
- **Appeals**: Create Evaluations that override prior Evaluations

---

## 2. The Consolidations

### 2.1 Claims Are Entities

Every signed claim gets a `claimFideId` derived from its signature. The claim content includes universal fields (`assertedAt`, `supersedes`) alongside schema-specific fields.

**Result:** All linking uses `FideEntityRelationship`. No bridge schemas needed.

### 2.2 Merge Verdict + Score → `FideEvaluation`

Since both target `subjectFideId`, they're the same structure:

```typescript
FideEvaluation {
    subjectFideId: bytes32,      // The entity being evaluated
    methodologyFideId: bytes32,  // The scoring/judgment methodology
    value: int32,                // The evaluation value (scale defined by methodology)
    confidence: uint8            // 0-100 confidence in this evaluation
}
```

**Scale is methodology-defined:**
- Fact-check methodology → values: -1, 0, 1
- Credit score methodology → values: 300-850
- Policy flag → value: -1, methodology: "spam-detection"

### 2.3 Merge Name → Attribute (with Temporal Fields)

Names are attributes with special slugs. To enable this, `FideEntityAttribute` gains temporal fields:

```typescript
FideEntityAttribute {
    subjectFideId: bytes32,
    attributeCategory: string,
    attributeSlug: string,
    attributeValue: string,
    validFromUTC?: string,   // When this attribute became true
    validToUTC?: string      // When this attribute stopped being true (revocation)
}
```

**Reserved slug conventions for names:**

| Slug Pattern | Meaning | Example |
|--------------|---------|---------|
| `name:primary` | Main display name | "Tesla, Inc." |
| `name:primary:legal` | Legal/registered name | "Tesla, Inc." |
| `name:alias:brand` | Brand/trading name | "Tesla" |
| `name:alias:nick` | Nickname/handle | "TSLA" |
| `name:alias:historical` | Former name | "Tesla Motors" |

**Example: Name change via temporal validity**
```typescript
// Maiden name (ended)
{ slug: "name:primary:legal", value: "Alice Smith", validFromUTC: "2000-01-01", validToUTC: "2024-06-14" }

// Married name (current)
{ slug: "name:primary:legal", value: "Alice Johnson", validFromUTC: "2024-06-15" }
```

---

## 3. The Final 5-Schema Protocol

| # | Schema | Layer | Purpose |
|---|--------|-------|---------|
| **1** | `FideEntityType` | Identity | Defines existence: "This ID is a Person / Trace / Claim" |
| **2** | `FideEntityRelationship` | Structure | Defines connections: edges between any entities |
| **3** | `FideEntityAttribute` | Data | Defines properties: names, skills, URIs, all with optional temporal validity |
| **4** | `FideDecisionTrace` | Action | Defines reasoning: the "work" being done |
| **5** | `FideEvaluation` | Trust | Defines judgment: verdicts, scores, and flags |

---

## 4. Schema Definitions

### 4.1 `FideEntityType`

Declare what kind of entity an ID represents.

```typescript
{
    fideId: bytes32,
    entityType: 'person' | 'organization' | 'place' | 'event' | 'product' | 
                'creative_work' | 'agent' | 'signing_key' | 'claim' | 'trace'
}
```

**Note:** `claim` and `trace` are now valid entity types since claims are entities.

### 4.2 `FideEntityRelationship`

Connect any entity to any other entity.

```typescript
{
    fromFideId: bytes32,
    toFideId: bytes32,
    relationshipCategory: 'work' | 'create' | 'own' | 'social' | 'trust' | 'control',
    relationshipDetail: string,  // e.g., "employee", "evidence", "precedent", "outcome"
    validFromUTC?: string,
    validToUTC?: string
}
```

**Common relationship details:**
- `control:signing_key` — Person controls a signing key
- `trust:evidence` — Claim is evidenced by document
- `trust:precedent` — Trace references prior trace
- `create:outcome` — Decision led to this outcome

### 4.3 `FideEntityAttribute`

Attach properties to entities, with optional temporal validity.

```typescript
{
    subjectFideId: bytes32,
    attributeCategory: 'skill' | 'interest' | 'industry' | 'media' | 'tag' | 'identity',
    attributeSlug: string,
    attributeValue: string,
    validFromUTC?: string,
    validToUTC?: string
}
```

**The `identity` category** holds names:
- `identity:name:primary` — Main display name
- `identity:name:alias:brand` — Brand name
- `identity:name:alias:historical` — Former name

### 4.4 `FideDecisionTrace`

Record reasoning and actions. The crown jewel of the protocol.

```typescript
{
    trace_id: uuid,
    generation_id: uuid,
    step_index: int,
    action: 'thought' | 'tool_call' | 'tool_result' | 'observation' | 
            'approval' | 'exception' | 'final_answer',
    input?: json,
    output?: json,
    context_snapshot?: json,
    reasoning?: string,
    confidence_score?: float,
    policyFideIds?: bytes32[]  // Policies that constrained this decision
}
```

### 4.5 `FideEvaluation`

Judge any entity (claims, traces, other evaluations).

```typescript
{
    subjectFideId: bytes32,      // The entity being evaluated
    methodologyFideId: bytes32,  // How this evaluation was produced
    value: int32,                // The judgment (scale defined by methodology)
    confidence: uint8            // 0-100 confidence
}
```

---

## 5. What Got Cut

| Original Schema | Disposition |
|-----------------|-------------|
| `FideEntityName` | Merged into `FideEntityAttribute` with `identity` category |
| `FideClaimVerdict` | Merged into `FideEvaluation` |
| `FideEntityScore` | Merged into `FideEvaluation` |
| `FidePolicyFlag` | Merged into `FideEvaluation` (value = -1, methodology = policy) |
| `FideGeneration` | Modeled as entity + relationships |
| `FideEvidence` | Modeled as `FideEntityRelationship` with `trust:evidence` detail |
| `FideContextLink` | Unnecessary (claims have entity IDs) |
| `FideSchemaNameDefinition` | Removed (application layer) |
| `FideIdentityProtocolDefinition` | Removed (application layer) |

**From 12 schemas to 5.** The protocol is now minimal and uniform.

---

## 6. The Claim Envelope Standard

### The Flattened Model

Everything signed is in `content`. The envelope is minimal metadata.

```typescript
// Signed content (schema-specific + universal fields)
interface SignedContent {
    // Universal fields (on ALL claims)
    assertedAt: string;              // When the signer claims to have made this
    supersedes?: `0x${string}`;      // Prior claim being overridden (same author only)
    
    // Schema-specific fields
    ...schemaFields
}

// The envelope
interface ClaimEnvelope {
    schemaFideId: `0x${string}`;     // Which schema (bytes32, derivable for core schemas)
    content: SignedContent;           // EVERYTHING SIGNED
    signature: `0x${string}`;         // EIP-712 signature of content
    claimFideId: `0x${string}`;       // Derived from signature (not signed)
}

// Indexer extends:
interface IndexedClaim extends ClaimEnvelope {
    indexedAt: string;                // Trusted external timestamp
    indexSource: string;              // Where anchored (e.g., "github:commit:abc123")
}
```

### Example: A Complete FideEvaluation Claim

```typescript
{
    schemaFideId: "0x7f3a...",  // Well-known ID for FideEvaluation
    content: {
        // Universal fields
        assertedAt: "2024-01-15T10:30:00Z",
        supersedes: null,
        
        // Schema-specific fields
        subjectFideId: "0xabc...",
        methodologyFideId: "0xdef...",
        value: 1,
        confidence: 85
    },
    signature: "0x123...",
    claimFideId: "0x456..."  // Derived from signature
}
```

**Rule:** `content` = signed. Everything else = metadata.

---

## 7. Schemas as Entities

### SchemaFideId

Schemas are identified by `bytes32` FideIds, not string names. This enables:
- **Versioning**: Each schema version has a distinct ID
- **Evolution**: New schemas can be proposed by anyone
- **Self-describing**: Schema entity contains field definitions

### Well-Known IDs for Core Schemas

The 5 core schemas have **deterministic IDs** derived from their names:

```typescript
// Derivation formula
schemaFideId = slice(keccak256("fcp:schema:{name}"), 12, 32)
```

| Schema | Derivation Seed | Well-Known ID |
|--------|-----------------|---------------|
| `FideEntityType` | `fcp:schema:FideEntityType` | `0x...` (derivable) |
| `FideEntityRelationship` | `fcp:schema:FideEntityRelationship` | `0x...` (derivable) |
| `FideEntityAttribute` | `fcp:schema:FideEntityAttribute` | `0x...` (derivable) |
| `FideDecisionTrace` | `fcp:schema:FideDecisionTrace` | `0x...` (derivable) |
| `FideEvaluation` | `fcp:schema:FideEvaluation` | `0x...` (derivable) |

**These IDs are computed locally** — no lookup required for core schemas.

### Schema Evolution

If a schema needs to change (add field, change type):

1. **Create a new schema entity** with updated field definitions
2. The new schema gets a new FideId
3. New claims use the new schemaFideId
4. Old claims still reference the old schemaFideId
5. Indexers can migrate/transform if needed

```
FideEvaluation v1.0  →  schemaFideId: 0xAAA  (4 fields)
FideEvaluation v2.0  →  schemaFideId: 0xBBB  (adds 'reason' field)
```

### Custom Schemas

Anyone can propose new schemas:

1. Create a schema entity (type: `schema` or `creative_work`)
2. Add attributes defining the field structure
3. Use that entity's FideId as `schemaFideId` in claims

This makes FCP extensible without protocol changes.

---

## 8. Claim ID Derivation

**Formula:**
```typescript
claimFideId = slice(keccak256(signature), 12, 32)
```

The claim's entity ID is derived from its signature. This means:
- Same content + same signer = same claimFideId (idempotent)
- Different `assertedAt` = different signature = different claimFideId

---

## 9. Supersession: Updating Your Own Claims

Signers can update their prior claims by creating a new claim with `supersedes` pointing to the prior claim's `claimFideId`.

### The Chain Rule

**A claim that has already been superseded cannot be superseded again.**

```
A (original)
 ↑
B (supersedes A) ← indexed first, accepted
 
C (supersedes A) ← REJECTED: A is already superseded by B
```

If you want to change again, you must supersede the latest in the chain:

```
A → B → C (valid chain)
```

### Indexer Logic

1. When claim C arrives with `supersedes: A`
2. Check: Is A already superseded by another claim from the same author?
3. If yes: Reject C (or accept but mark as "orphaned")
4. If no: Accept C as the supersession

### What This Enables

| Scenario | How It Works |
|----------|-------------|
| Changed evaluation | New evaluation with `supersedes` pointing to prior |
| Updated attribute | New attribute claim supersedes old |
| Corrected relationship | New claim supersedes old |
| Revocation | Superseding claim with null/void value |

---

## 10. The Two-Timestamp Model

Timestamps in FCP have a trust hierarchy.

### The Problem

Even if `assertedAt` is signed, a compromised key can create backdated claims. The signer's declared timestamp is not trustworthy on its own.

### The Solution: Two Timestamps

| Timestamp | Source | Signed? | Trustworthy? |
|-----------|--------|---------|-------------|
| `assertedAt` | Signer declares | ✅ Yes | ❌ No — signer can lie |
| `indexedAt` | Indexer observes | ❌ No | ✅ Yes — blockchain/git timestamp |

### Trust Hierarchy

1. **For ordering and conflicts**: Use `indexedAt` (trusted external timestamp)
2. **For signer's declaration**: Use `assertedAt` (what signer claims)
3. **For supersession chains**: Order by `indexedAt`, not `assertedAt`

### Key Compromise Detection

**Heuristic:** If `assertedAt` is significantly before `indexedAt`, flag as suspicious:

```
assertedAt: "2024-01-01T00:00:00Z"
indexedAt:  "2024-03-15T10:30:00Z"
→ Flag: "Claim asserted 74 days before indexing — possible backdating"
```

This doesn't prove compromise, but it's a signal for investigation.

### Why Sign `assertedAt`?

Even though it can be faked, signing it:
- Creates a legal declaration: "I claim this was true at time X"
- Enables temporal claims: "As of Jan 1, Alice worked at Company X"
- Provides audit trail: "Signer declared X, but it wasn't indexed until Y"

---

## 11. Why This Works

### 11.1 Universal Recursion

Because everything is an entity:
- You can **evaluate evaluations** (meta-moderation, appeals)
- You can **link traces to traces** (precedent chains)
- You can **attach evidence to anything** (claims, evaluations, traces)
- You can **supersede your own claims** (change your mind with audit trail)

### 11.2 Simplified Indexing

Indexers only understand 5 table shapes:
1. Types
2. Relationships
3. Attributes
4. Traces
5. Evaluations

Plus the envelope metadata (assertedAt, indexedAt, supersedes).

### 11.3 Future-Proof

New concepts don't require new schemas:
- **Bounties** = Entity (type: event) + Attributes (amount: $50) + Relationships (target: bug report)
- **Disputes** = Evaluation of an Evaluation
- **Credentials** = Attribute with temporal validity + Evidence relationship
- **Appeals** = Evaluation that supersedes prior Evaluation

---

## 12. Reserved Conventions

These are protocol recommendations, not schema enforcement:

### Attribute Slugs for Names
```
identity:name:primary           → Main display name
identity:name:primary:legal     → Legal/registered name
identity:name:alias:brand       → Brand/trading name
identity:name:alias:nick        → Nickname/handle
identity:name:alias:historical  → Former name (use validToUTC)
```

### Relationship Details
```
trust:evidence     → Links claim to supporting document
trust:precedent    → Links trace to prior trace
trust:sameAs       → Entity merge/alias
create:outcome     → Links decision to its result
control:key        → Person controls signing key
control:agent      → Person controls agent
```

### Evaluation Methodologies
```
methodology:fact-check     → Values: -1, 0, 1
methodology:reputation     → Values: 0-100
methodology:policy:spam    → Values: -1 (flagged), 0 (not flagged)
```

---

## 13. Migration Path

1. **Flatten envelope**: Move `assertedAt`, `supersedes` into signed content
2. **Use `schemaFideId`**: Replace schema name with bytes32 ID
3. **Compute well-known IDs**: Derive core schema IDs from `fcp:schema:{name}`
4. **Add indexer metadata**: `indexedAt`, `indexSource`
5. **Add `claimFideId` derivation**
6. **Add `validFromUTC` and `validToUTC` to `FideEntityAttribute`**
7. **Add `identity` to `attributeCategory` options**
8. **Create `FideEvaluation`** (merge of Verdict, Score, Flag)
9. **Deprecate old schemas**
10. **Implement supersession chain validation** in indexers

---

## 14. Conclusion

The Universal Entity Protocol achieves:

✅ **5 schemas** (down from 12)  
✅ **Everything is an entity** (claims, traces, evaluations)  
✅ **Universal linking** (anything can connect to anything)  
✅ **Temporal validity** (attributes and relationships support time bounds)  
✅ **Supersession chains** (update claims with audit trail)  
✅ **Two-timestamp model** (signer's assertion + trusted indexer time)  
✅ **Meta-recursion** (evaluate evaluations, link traces to traces)  
✅ **Future-proof** (new concepts don't need new schemas)  

This is the minimal, maximally expressive architecture for the Context Graph vision.

---

*"If you accept that everything is an entity, the entire graph becomes flat. Nodes all the way down."*
