# FCP Schema Critique v2: The Minimal Explicit Protocol

*Generated: 2026-01-14*
*Updated: 2026-01-14 (Claims as Entities simplification)*

---

## Executive Summary

After multiple rounds of analysis, the final architecture is:

1. **Every signed claim has an entity ID** (`claimFideId`) included in the envelope.
2. **Claims are entities.** This means all linking (evidence, outcomes, precedents) uses `FideEntityRelationship`.
3. **No bridge schema needed.** The "universal linker" pattern is unnecessary when claims have entity IDs.

**Final count: 7 schemas** — a uniform model where everything is an entity.

---

## 1. The Key Insight: Claims Are Entities

### The Problem with the Bridge Pattern

The original consolidation proposed a `FideContextLink` schema to bridge:
- `string` (Claim Signatures) ↔ `bytes32` (Entity IDs)

This added complexity because claims were treated as a separate concept from entities.

### The Solution: Give Every Claim an Entity ID

Every signed claim now includes a `claimFideId` in its envelope:

```typescript
interface ClaimEnvelope {
    header: {
        version: '1.0';
        schema: SchemaName;
        timestamp: string;
        claimFideId: `0x${string}`;  // Derived from keccak256(signature)[12:32]
    };
    content: Record<string, unknown>;
    signature: `0x${string}`;
}
```

**Derivation formula:**
```typescript
claimFideId = slice(keccak256(signature), 12, 32)  // Last 20 bytes, as bytes32
```

**Why include it explicitly?**
- Easy to index and query claims by entity ID
- No need for every implementation to derive it
- Claim becomes a first-class entity, queryable like any other

---

## 2. What This Enables

With claims having entity IDs, all linking uses `FideEntityRelationship`:

| Use Case | How It Works |
|----------|--------------|
| **Evidence for a claim** | `FideEntityRelationship(claimFideId → evidenceEntityID, category: 'trust', detail: 'evidence')` |
| **Outcome of a decision trace** | `FideEntityRelationship(traceFideId → outcomeEntityID, category: 'create', detail: 'outcome')` |
| **Precedent reference** | `FideEntityRelationship(traceFideId → priorTraceFideId, category: 'trust', detail: 'precedent')` |
| **Verdict on a claim** | `FideClaimVerdict.subjectFideId = claimFideId` |

**No bridge schema needed.** The model is uniform: everything is an entity, everything links via relationships.

---

## 3. Schema Changes

### `FideClaimVerdict` Update

Change from signature-based to entity-based targeting:

```typescript
// Before
{
  subjectClaimSignature: string,  // ❌ String
  methodologyFideId: bytes32,
  verdict: int8,
  confidenceScore: uint8
}

// After
{
  subjectFideId: bytes32,         // ✅ Entity ID (the claim's fideId)
  methodologyFideId: bytes32,
  verdict: int8,
  confidenceScore: uint8
}
```

This also means `FideClaimVerdict` can now target **any entity** — claims, traces, or even other entities. The schema becomes more general.

### `FideContextLink` Removal

**Deleted.** No longer needed. All linking is done via `FideEntityRelationship`.

---

## 4. The Final 7-Schema Protocol

### Layer A: Identity (2 Schemas)

| Schema | Purpose |
|--------|---------|
| **`FideEntityType`** | "This ID is a Person / Trace / Claim" |
| **`FideEntityName`** | "This ID is named Alice" |

### Layer B: Graph Structure (2 Schemas)

| Schema | Purpose |
|--------|---------|
| **`FideEntityRelationship`** | All edges: entity↔entity, claim↔entity, trace↔outcome, precedent links |
| **`FideEntityAttribute`** | Entity properties (skills, media URIs, etc.) |

### Layer C: Decision Layer (1 Schema)

| Schema | Purpose |
|--------|---------|
| **`FideDecisionTrace`** | The reasoning record (input, output, action, reasoning, policyFideIds) |

### Layer D: Trust Layer (2 Schemas)

| Schema | Purpose |
|--------|---------|
| **`FideClaimVerdict`** | Judgments on any entity (claims, traces, etc.) |
| **`FideEntityScore`** | Aggregate reputation scores |

---

## 5. Summary Table

| Layer | Schemas | Count |
|-------|---------|-------|
| Identity | `FideEntityType`, `FideEntityName` | 2 |
| Graph | `FideEntityRelationship`, `FideEntityAttribute` | 2 |
| Decision | `FideDecisionTrace` | 1 |
| Trust | `FideClaimVerdict`, `FideEntityScore` | 2 |
| **Total** | | **7** |

---

## 6. What Got Cut

| Former Schema | Disposition |
|---------------|-------------|
| `FidePolicyFlag` | Merged into `FideClaimVerdict` (verdict = -1, methodology = policy) |
| `FideGeneration` | Modeled as Entity + Relationships |
| `FideEvidence` | Replaced by `FideEntityRelationship` with appropriate category/detail |
| `FideContextLink` | **Removed.** Claims have entity IDs, no bridge needed. |
| `FideSchemaNameDefinition` | Removed (handled at application layer) |
| `FideIdentityProtocolDefinition` | Removed (handled at application layer) |

---

## 7. The Claim Envelope Standard

Every signed claim includes:

```typescript
interface ClaimEnvelope {
    header: {
        version: '1.0';
        schema: SchemaName;
        timestamp: string;           // ISO 8601 UTC (metadata, not signed)
        claimFideId: `0x${string}`;  // Derived from signature, included for indexing
    };
    content: Record<string, unknown>;  // The claim data (signed)
    signature: `0x${string}`;          // EIP-712 signature
}
```

**Key points:**
- `claimFideId` is derived deterministically from the signature
- Including it explicitly makes claims queryable by entity ID
- The claim is now a first-class entity in the graph

---

## 8. Migration Path

1. **Add `claimFideId` to envelope header** — derived from `keccak256(signature)[12:32]`
2. **Change `FideClaimVerdict.subjectClaimSignature`** → `subjectFideId` (bytes32)
3. **Remove `FideEvidence`** — use `FideEntityRelationship` with `detail: 'evidence'`
4. **Remove `FideContextLink`** — no longer needed
5. **Add `policyFideIds`** to `FideDecisionTrace`
6. **Add `approval` and `exception`** to `FideDecisionTrace.action` enum

---

## 9. Conclusion

The "Claims are Entities" insight simplifies the protocol dramatically:

✅ **7 schemas** (down from 12)  
✅ **Uniform model** (everything is an entity)  
✅ **No bridge schema** (claims have entity IDs)  
✅ **Easy indexing** (query claims by `claimFideId`)  
✅ **Flexible verdicts** (can target any entity, not just claims)  

This is the minimal, type-safe architecture that can power the Context Graph vision.

---

*This critique incorporates the insight that claims should have explicit entity IDs, eliminating the need for signature-to-entity bridge schemas.*
