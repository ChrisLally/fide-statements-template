# FCP Schema Critique v5: The Final Protocol Specification

*Generated: 2026-01-14*

---

## Executive Summary

After extensive analysis, the final FCP architecture is a **Bimodal Design**:

1. **Protocol Layer (4 Schemas)**: Optimized for **human readability** and **signing security**
2. **Storage Layer (1 Table)**: Optimized for **graph traversal** and **query performance**

The signer sees typed, meaningful fields. The database sees triples. Both get what they need.

**Final Protocol: 4 Explicit Schemas**

---

## 1.5 FideId Format: 20 Bytes (Ethereum-Compatible)

All identifiers in FCP are **20 bytes** (40 hex characters + `0x` prefix = 42 characters total), matching the Ethereum address format.

### Why 20 Bytes?

1. **Ethereum Compatibility**: Authorship keys are Ethereum addresses. Using the same format everywhere enables direct signature verification, block explorer lookups, and wallet UI interoperability.
2. **Sufficient Collision Resistance**: 20 bytes (160 bits) provides ~2^80 collision resistance (birthday attack), which is astronomically secure for identifiers.
3. **Clarity**: A single format for all IDs eliminates ambiguity. If it starts with `0x` and is 42 characters, it's a FideId.

### Derivation Formulas

```typescript
// Signing Key FideId (from public key)
// This IS an Ethereum address — recovered from EIP-712 signature
signingKeyFideId = slice(keccak256(publicKey), 12, 32)  // Last 20 bytes

// Claim FideId (from signature)
claimFideId = slice(keccak256(signature), 12, 32)  // Last 20 bytes

// Schema FideId (from structure/type hash)
schemaTypeString = "FideActionStep(string claimedAt,address claimSupersedes,address sessionFideId,...)"
schemaFideId = slice(keccak256(schemaTypeString), 12, 32)  // Last 20 bytes

// Predicate FideId (from canonical name)
predicateFideId = slice(keccak256("fcp:predicate:{name}"), 12, 32)  // Last 20 bytes

// Entity FideId
// Entities don't have their own ID — they ARE identified by the claimFideId
// of the first claim that references them (typically a type attribute claim)
```

### EIP-712 Type Mapping

| FideId Field | EIP-712 Type | Solidity Type |
|--------------|--------------|---------------|
| `fromFideId`, `toFideId`, `subjectFideId` | `address` | `address` |
| `relationshipType`, `attributeType`, `methodologyFideId` | `address` | `address` |
| `claimSupersedes` | `address` | `address` |

**Note:** While EIP-712 uses `address` (20 bytes), these are not necessarily "accounts" — they are content-addressed identifiers derived from hashes. The `address` type is used purely for its byte length.


## 1. Why Not the Other Options

### ❌ Rejected: 12 Schemas (Original)

The original FCP had 12 schemas:
- `FideEntityType`, `FideEntityName`, `FideEntityRelationship`, `FideEntityAttribute`
- `FideEvidence`, `FideDecisionTrace`, `FideGeneration`
- `FideClaimVerdict`, `FideEntityScore`, `FidePolicyFlag`
- `FideSchemaNameDefinition`, `FideIdentityProtocolDefinition`

**Why rejected:**
- **Redundancy**: `FidePolicyFlag` is just a verdict with value -1
- **Redundancy**: `FideEntityScore` is just an evaluation at entity level
- **Redundancy**: `FideEvidence` is just a relationship with type "evidence"
- **Governance bloat**: Definition schemas belong at application layer
- **Developer fatigue**: Too many schemas to learn

### ❌ Rejected: 8 Schemas (Critique v2)

Consolidated to 8 by merging PolicyFlag into Verdict and treating generations as entities.

**Why rejected:**
- Still had `FideContextLink` as a bridge schema
- Didn't recognize that claims could have entity IDs
- Unnecessary complexity in linking claims to entities

### ❌ Rejected: 7 Schemas (Critique v2 refined)

Added `claimFideId` to claims, removing the need for bridge schemas.

**Why rejected:**
- Still kept `FideEntityName` separate from `FideEntityAttribute`
- Didn't add temporal fields to attributes
- Names are just attributes with special slugs

### ❌ Rejected: 1 Schema / Universal Triple (Critique v4)

Collapsed everything into Subject-Predicate-Object triples.

**Why rejected (critical):**

1. **EIP-712 Readability Failure**
   ```
   // What users see with 5-schema:
   Sign DecisionTrace:
   - Action: "tool_call"
   - Input: "User asked for weather"
   - Output: "20°C"
   
   // What users see with 1-schema:
   Sign FideClaim:
   - Subject: 0x123abc...
   - Predicate: 0x456def...
   - Value: "{\"action\":\"tool_call\",\"input\":\"User asked...\"}"
   ```
   Users cannot verify what they're signing. This is a **security failure**.

2. **Validation Loss**
   - Protocol can't enforce that `stepIndex` is an integer
   - Malformed claims enter the graph undetected
   - Indexers must parse JSON to validate

3. **Query Performance**
   - Finding "all tool calls" requires JSON parsing every row
   - No indexing on structured fields inside JSON blobs

4. **Predicate Lookup Dependency**
   - To understand a claim, you must first look up the predicate entity
   - Introduces state dependency before ingestion

**Conclusion**: The Universal Triple is perfect for the **database layer** but dangerous for the **protocol layer**.

---

## 2. The Bimodal Architecture

### Protocol Layer: 5 Explicit Schemas

Users sign typed, readable claims. EIP-712 shows meaningful field names.

### Storage Layer: Triple Table

Indexers flatten claims into a uniform triple structure for graph traversal.

### The Mapping

| Protocol Schema | Storage Representation |
|-----------------|----------------------|
| `FideEntityRelationship` | `subject → rel:X → object` |
| `FideEntityAttribute` | `subject → attr:X → null, value: Y` (includes type via `fcp:attr:type`) |
| `FideActionStep` | `subject → action:X → session, value: {json}` |
| `FideEvaluation` | `subject → methodology → null, value: {score, confidence}` |

**The claim table stores the complete signed claim. The edges table stores derived triples for querying.**

---

## 3. The Final 4 Schemas

### 3.1 `FideEntityRelationship`

Connect entities with typed relationships.

```typescript
interface FideEntityRelationship {
    // Universal (signed)
    claimedAt: string;
    claimSupersedes?: `0x${string}`;
    
    // Schema-specific (signed)
    fromFideId: `0x${string}`;
    toFideId: `0x${string}`;
    relationshipType: `0x${string}`;  // Predicate entity ID
    claimValidFrom?: string;
    claimValidTo?: string;
}
```

**EIP-712 Types:**
```typescript
FideEntityRelationship: [
    { name: 'claimedAt', type: 'string' },
    { name: 'claimSupersedes', type: 'address' },
    { name: 'fromFideId', type: 'address' },
    { name: 'toFideId', type: 'address' },
    { name: 'relationshipType', type: 'address' },
    { name: 'claimValidFrom', type: 'string' },
    { name: 'claimValidTo', type: 'string' }
]
```

### 3.2 `FideEntityAttribute`

Attach properties to entities with optional temporal validity.

```typescript
interface FideEntityAttribute {
    // Universal (signed)
    claimedAt: string;
    claimSupersedes?: `0x${string}`;
    
    // Schema-specific (signed)
    subjectFideId: `0x${string}`;
    attributeType: `0x${string}`;  // Predicate entity ID (replaces category/slug)
    attributeValue: string;
    claimValidFrom?: string;
    claimValidTo?: string;
}
```

**EIP-712 Types:**
```typescript
FideEntityAttribute: [
    { name: 'claimedAt', type: 'string' },
    { name: 'claimSupersedes', type: 'address' },
    { name: 'subjectFideId', type: 'address' },
    { name: 'attributeType', type: 'address' },
    { name: 'attributeValue', type: 'string' },
    { name: 'claimValidFrom', type: 'string' },
    { name: 'claimValidTo', type: 'string' }
]
```

**Well-known attribute types (predicate IDs):**
- `fcp:attr:type` → Entity type (person, organization, agent, etc.)
- `fcp:attr:name:primary` → Primary display name
- `fcp:attr:name:legal` → Legal name
- `fcp:attr:skill` → Skill attribute
- `fcp:attr:media:uri` → Media URI

**Entity Type as Attribute:**
```typescript
// "Alice is a person"
{
    subjectFideId: "0xAlice...",
    attributeType: "0x...",  // fcp:attr:type predicate ID
    attributeValue: "person"
}
```

### 3.3 `FideActionStep`

Record executor reasoning and actions. **The crown jewel.**

This schema captures the "why" behind autonomous decisions or human-led workflows, enabling auditable precedent and accountability.

```typescript
interface FideActionStep {
    // Universal (signed)
    claimedAt: string;
    claimSupersedes: `0x${string}`;    // Use zero address if none
    
    // === IDENTITY ===
    sessionFideId: `0x${string}`;     // Links to the workflow/session (UUID truncated hash)
    stepIndex: number;                 // Order within session (0-indexed)
    
    // === THE "WHAT" ===
    action: string;                    // e.g., 'thought', 'tool_call', 'final_answer'
    status: 'success' | 'error';       // Action status
    
    // === THE "WHO" ===
    executorFideId: `0x${string}`;    // FideId of the entity performing the action
    
    // === THE "DATA" ===
    input?: string;                    // JSON string - parameters/context
    output?: string;                   // JSON string - result/response
    error?: string;                    // Error message if status = error
    
    // === THE "WHY" ===
    reasoning?: string;                // Natural language explanation/CoT
}
```

**EIP-712 Types:**
```typescript
FideActionStep: [
    { name: 'claimedAt', type: 'string' },
    { name: 'claimSupersedes', type: 'address' },
    { name: 'sessionFideId', type: 'address' },
    { name: 'stepIndex', type: 'uint256' },
    { name: 'action', type: 'string' },
    { name: 'status', type: 'string' },
    { name: 'executorFideId', type: 'address' },
    { name: 'input', type: 'string' },
    { name: 'output', type: 'string' },
    { name: 'error', type: 'string' },
    { name: 'reasoning', type: 'string' }
]
```

**Why These Fields Matter:**

| Field | Industry Need | Source |
|-------|--------------|--------|
| `status` + `error` | 20% of agent calls fail. Need to distinguish failure from empty result. | OpenTelemetry |
| `modelProvider` + `modelName` | A GPT-4 decision has different weight than Llama-8b. Models swap dynamically. | LangSmith |
| `metadata` | Enterprises ask: "How much did this decision cost?" (tokens, latency) | Business |

**Metadata JSON Schema (Suggested):**
```typescript
interface TraceMetadata {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    durationMs?: number;
    estimatedCostUsd?: number;
}
```

**Granularity: Session vs Step**

| Concept | OpenTelemetry | FCP | Definition |
|---------|---------------|-----|------------|
| **Session** | Trace | sessionFideId | Full workflow (User asks → Agent replies) |
| **Action** | Span | **FideActionStep** | Single atomic step (e.g., "Call Weather API") |

**Why atomic steps matter:**
- **Granular Trust**: Trust the Math Tool usage (Step 3) but not the Final Answer (Step 5)
- **Replayability**: Debug step-by-step where logic failed
- **Precedent Search**: "Find all action steps that failed with timeout errors"

**Linking:** Multiple `FideActionStep` claims share the same `sessionFideId`. Indexers reconstruct the full workflow using `stepIndex`.

**OpenTelemetry Integration Strategy**

FCP does not use OTel for *enforcement* (validation), but leverages it for **adoption** (ingestion).

**The "Trojan Horse" Approach:**

Instead of: *"Install the Fide SDK"*

Say: *"Already using OpenTelemetry? Just add the `FideSpanProcessor`."*

**Implementation:**
```typescript
// Lightweight OTel Plugin
class FideSpanProcessor implements SpanProcessor {
    onEnd(span: Span) {
        // 1. Validate span has required Fide fields
        if (!hasRequiredFields(span)) return;
        
        // 2. Convert OTel Span → FideActionStep
        const trace = convertToFideTrace(span);
        
        // 3. Sign with agent's wallet
        const signed = await signClaim(trace);
        
        // 4. Broadcast to Fide network
        await broadcastClaim(signed);
    }
}
```

**Why this works:**
- Developers already instrument with OTel (industry standard)
- No new SDK to learn — just add a processor
- FCP gets strict typing, OTel gets flexibility
- Leverages existing OTel ecosystem (Python, JS, Go, Rust, Java)

### 3.4 `FideEvaluation`

Judge any entity (claims, traces, other evaluations).

```typescript
interface FideEvaluation {
    // Universal (signed)
    claimedAt: string;
    claimSupersedes?: `0x${string}`;
    
    // Schema-specific (signed)
    subjectFideId: `0x${string}`;      // The entity being evaluated
    methodologyFideId: `0x${string}`;  // How this evaluation was produced
    value: number;                      // int32: score or verdict
    confidence: number;                 // 0-100
}
```

**EIP-712 Types:**
```typescript
FideEvaluation: [
    { name: 'claimedAt', type: 'string' },
    { name: 'claimSupersedes', type: 'address' },
    { name: 'subjectFideId', type: 'address' },
    { name: 'methodologyFideId', type: 'address' },
    { name: 'value', type: 'int256' },
    { name: 'confidence', type: 'uint8' }
]
```

**Usage patterns:**
- **Fact check**: `value = -1 | 0 | 1`, methodology = fact-check entity
- **Reputation score**: `value = 0-100`, methodology = reputation entity
- **Policy flag**: `value = -1`, methodology = policy entity (spam, harassment, etc.)

---

## 4. Well-Known Predicates Registry

The protocol defines predicates in two categories:

1. **Protocol (Structural)**: Strictly defined, universal meaning. Everyone agrees what these mean.
2. **Standard (Interoperability)**: Recommended patterns. Implementations will vary.

All predicate IDs are derived from their canonical names:

```typescript
predicateFideId = slice(keccak256("fcp:predicate:{name}"), 12, 32)
```

---

## 4.1 PROTOCOL: Entity Types (Strict)

**Status:** Protocol-defined. Universal meaning.

Used as `attributeValue` when `attributeType = fcp:attr:type`:

| Value | Description | Examples |
|-------|-------------|----------|
| `person` | A natural human being | Alice Johnson, Elon Musk |
| `organization` | A group with governance | Apple Inc., Uniswap DAO |
| `place` | A physical location | NYC, France |
| `event` | A happening with start/end time | WWDC 2024, Olympics |
| `product` | An item for utility or exchange | iPhone 15, Linux, Bitcoin |
| `creative_work` | Content for consumption | New York Times, Elden Ring |
| `agent` | An autonomous AI instance | Fide Agent v1.0 Instance |
| `signing_key` | A cryptographic key for claim authorship | 0x742d35cc... |
| `schema` | A schema definition | FideEvaluation v1.0 |
| `predicate` | A predicate/type definition | fcp:attr:skill |
| `methodology` | An evaluation methodology | fact-check-v1 |

**Why Protocol:** These are fundamental ontology. Everyone in the world agrees what "person" means.

---

## 4.2 PROTOCOL: Policy Flags (Strict)

**Status:** Protocol-defined. Universal meaning.

Used as `methodologyFideId` in `FideEvaluation` with `value = -1` (flagged) or `value = 0` (cleared):

| Predicate Name | Value Range | Description |
|----------------|-------------|-------------|
| `fcp:method:policy:spam` | -1, 0 | Spam/bulk content |
| `fcp:method:policy:harassment` | -1, 0 | Abusive/harassing content |
| `fcp:method:policy:misinformation` | -1, 0 | Demonstrably false information |
| `fcp:method:policy:nsfw` | -1, 0 | Adult/not-safe-for-work content |
| `fcp:method:policy:doxing` | -1, 0 | Revealing private information |
| `fcp:method:policy:illegal` | -1, 0 | Violates law/terms |

**Why Protocol:** These are universally understood policy violations. Everyone knows what "spam" means. The community can agree on whether something is spam without needing a custom methodology definition.

**Semantics:**
- `value = -1`: Content is flagged for this policy violation
- `value = 0`: Flag cleared/not applicable
- `confidence`: Certainty of the judgment (0-100)

---

## 4.3 PROTOCOL: Key Attribute Types (Strict)

**Status:** Protocol-defined. Required for basic entity display and resolution.

| Predicate Name | Purpose | Required For |
|----------------|---------|--------------|
| `fcp:attr:type` | Entity type | All entities |
| `fcp:attr:name:primary` | Primary display name | Entity display |
| `fcp:attr:name:alias` | Alternative name/nickname | Entity resolution, search |
| `fcp:attr:name:legal` | Legal/registered name | Legal contexts |

**Why Protocol:** 
- Without `type` and `primary`, you can't display an entity or know what it is
- Without `alias`, you can't resolve "Bob" → "Robert" or handle nicknames/abbreviations
- `alias` is fundamental to entity resolution and search functionality

---

## 4.4 PROTOCOL: Key Relationship Types (Strict)

**Terminology Note:** In FCP, **everything is an entity** - persons, organizations, agents, signing keys, and **claims themselves** all have FideIds. When we show direction:
- **Specific types** (`person`, `organization`, `claim`) indicate the expected entity type
- **`any`** means any entity type is valid
- **`any → any (same type)`** means both sides should be the same type (e.g., person → person, claim → claim)
- **Claims are entities**, so `claim → any entity` means a claim linking to any other entity (including other claims)

**Status:** Protocol-defined. Required for accountability and graph structure.

| Predicate Name | Direction | Description |
|----------------|-----------|-------------|
| `fcp:rel:control` | person/org → agent/signing_key/account | Technical/operational authority |
| `fcp:rel:sameAs` | any → any (same type) | Is alias/duplicate of |
| `fcp:rel:evidence` | claim → any entity | Links supporting evidence |
| `fcp:rel:ownership` | any → any | Indexer uses it to track **Asset Control** and transfer history. |
| `fcp:rel:trust` | any → any | Indexer uses it for **Web-of-Trust** calculations (Sybil resistance). |

**Why Protocol:** 
- `control` is essential for the **Accountability Loop**.
- `sameAs` is essential for entity resolution.
- `evidence` is fundamental to claim verification.
- `ownership` is required for indexers to manage asset transfer logic (invalidating old claims).
- `trust` is required for calculating Sybil-resistance scores (PageRank).

**Control vs Ownership:**
- **`fcp:rel:control`** (PROTOCOL): Technical/operational authority
  - Examples: Person controls Agent, Person controls @username account, Org controls API key
  - Semantic: "Can authenticate as / act on behalf of"
- **`fcp:rel:ownership`** (PROTOCOL): Legal/economic possession  
  - Examples: Person owns Laptop, Company owns Trademark, Person owns Property
  - Semantic: "Has legal/economic rights to"
  - Why Protocol: Indexers need to track asset transfer history (A sends to B -> A no longer owns).

---

## 4.5 PROTOCOL: Action Step Types (Strict)

**Status:** Protocol-defined. Standard action vocabulary.

| Action | Description |
|--------|-------------|
| `thought` | Internal reasoning step |
| `tool_call` | Invocation of external tool |
| `tool_result` | Result returned from tool |
| `observation` | Observation of environment |
| `approval` | Human approval/validation |
| `exception` | Policy override or exception |
| `final_answer` | Final output to user |

**Why Protocol:** These map to standard agent loop patterns. Interoperability requires shared vocabulary.

---

## 4.6 STANDARD: Attribute Types (Interoperability)

**Status:** Standard patterns. Implementations may vary.

| Predicate Name | Purpose | Notes |
|----------------|---------|-------|
| `fcp:attr:name:brand` | Brand/trading name | Distinct from primary/alias - see below |
| `fcp:attr:skill` | Skill or capability | Consider industry taxonomies (O*NET, ESCO) |
| `fcp:attr:industry` | Industry classification | Consider NAICS/GICS |
| `fcp:attr:media:uri` | Media resource URI | Any `ipfs://`, `https://`, `ar://` |
| `fcp:attr:media:avatar` | Avatar image URI | Subset of media |
| `fcp:attr:description` | Text description | Freeform |
| `fcp:attr:url:website` | Website URL | Freeform |
| `fcp:attr:url:social` | Social media URL | Freeform |
| `fcp:attr:location` | Location string | Consider structured formats |
| `fcp:attr:tag` | Freeform tag | Folksonomy |

**Why Standard:** These are common patterns, but applications may have different needs. Use these for interoperability, or define your own with `myapp:attr:custom`.

### Name Type Distinctions

**When to use each name type:**

| Type | Use Case | Example |
|------|----------|----------|
| `fcp:attr:name:primary` | The main display name everyone uses | "Nike" |
| `fcp:attr:name:alias` | Alternative names, nicknames, abbreviations | "Bob" for Robert, "NYC" for New York City |
| `fcp:attr:name:legal` | Official registered legal name | "Nike, Inc." |
| `fcp:attr:name:brand` | Marketing/trading name distinct from legal entity | "Just Do It" campaign, "Air Jordan" product line |

**Why `brand` is Standard, not Protocol:**
- Brand names are **marketing constructs** that may or may not map 1:1 to entities
- "Air Jordan" could be a brand name on Nike (organization) OR a separate product entity
- Applications have different needs for brand modeling (attribute vs entity vs relationship)
- No universal consensus on brand semantics

### URI Naming Clarification

**All URI fields use `uri` (not `url`):**
- `fcp:attr:media:uri` - Generic media resource (images, videos, audio)
- `fcp:attr:url:website` - Specific to HTTP(S) website URLs
- `fcp:attr:url:social` - Specific to social media profile URLs

**Why the distinction:**
- `uri` = Universal Resource Identifier (supports `ipfs://`, `ar://`, `https://`, etc.)
- `url` = Uniform Resource Locator (typically `https://` only)
- Media can be stored on IPFS/Arweave, so we use the broader `uri` term
- Websites are typically HTTP(S), so `url` is semantically clearer

---

## 4.7 STANDARD: Relationship Types (Interoperability)

**Status:** Standard patterns. Implementations may vary.

| Predicate Name | Direction | Notes |
|----------------|-----------|-------|
| `fcp:rel:employment` | person → organization | Common HR pattern |
| `fcp:rel:membership` | person/org → organization | Generic membership |
| `fcp:rel:created` | person/org → any | Authorship |
| `fcp:rel:partOf` | any → any | Composition |
| `fcp:rel:locatedIn` | any → place | Location |
| `fcp:rel:attendedBy` | event → person | Event attendance |
| `fcp:rel:fundedBy` | any → person/org | Funding |
| `fcp:rel:precedent` | claim (action step) → claim (action step) | Decision precedent |
| `fcp:rel:outcome` | claim (action step) → any | Decision outcome |

**Why Suggested:** Useful patterns, but specific applications may need more granular types (e.g., `employment:contractor` vs `employment:fulltime`).

---

## 4.8 NOT DEFINED: Evaluation Methodologies

**Status:** NOT protocol-defined. Create your own.

The protocol **does not** define methodologies like:
- `fcp:method:reputation` ❌
- `fcp:method:trust` ❌
- `fcp:method:quality` ❌
- `fcp:method:fact-check` ❌

**Why Not Defined:** 

> "Reputation" means different things to different people. A credit score methodology is vastly different from a social reputation methodology.

**What To Do Instead:**

1. Create a methodology entity (type: `methodology`)
2. Add attributes defining:
   - How scores are calculated
   - What value range means
   - What inputs are considered
3. Use that entity's FideId as `methodologyFideId` in evaluations

**Example:**
```typescript
// 1. Create methodology entity
{
    subjectFideId: "0xMethodologyEntity...",
    attributeType: "fcp:attr:type",
    attributeValue: "methodology"
}

// 2. Add attributes describing it
{
    subjectFideId: "0xMethodologyEntity...",
    attributeType: "fcp:attr:name:primary",
    attributeValue: "PageRank Trust Score v2"
}

{
    subjectFideId: "0xMethodologyEntity...",
    attributeType: "fcp:attr:description",
    attributeValue: "Graph-based trust propagation using PageRank algorithm..."
}

// 3. Use it in evaluations
{
    subjectFideId: "0xTargetEntity...",
    methodologyFideId: "0xMethodologyEntity...",
    value: 85,
    confidence: 90
}
```

**The signer is accountable.** The methodology provides context, but the signer's reputation determines trust in the score.

---

## 4.9 SDK Requirements

### The Critical Rule

> **Developers will not look up hex codes in documentation.**
>
> You MUST ship predicates as **importable code**, not just documentation.

### Required Package: `@fide/semantics`

```typescript
// @fide/semantics - The Predicate Library

// === CORE ENTITY TYPES ===
export const ENTITY_TYPE = {
    PERSON: 'person',
    ORGANIZATION: 'organization',
    PLACE: 'place',
    EVENT: 'event',
    PRODUCT: 'product',
    CREATIVE_WORK: 'creative_work',
    AGENT: 'agent',
    AUTHORSHIP_KEY: 'signing_key',
    SCHEMA: 'schema',
    PREDICATE: 'predicate',
    METHODOLOGY: 'methodology',
} as const;

// === CORE ATTRIBUTE PREDICATES ===
export const ATTR = {
    TYPE: '0x...',           // fcp:attr:type
    NAME_PRIMARY: '0x...',   // fcp:attr:name:primary
    NAME_ALIAS: '0x...',     // fcp:attr:name:alias
    NAME_LEGAL: '0x...',     // fcp:attr:name:legal
} as const;

// === CORE RELATIONSHIP PREDICATES ===
export const REL = {
    CONTROL: '0x...',        // fcp:rel:control
    SAME_AS: '0x...',        // fcp:rel:sameAs
    EVIDENCE: '0x...',       // fcp:rel:evidence
} as const;

// === CORE POLICY FLAGS ===
export const POLICY = {
    SPAM: '0x...',           // fcp:method:policy:spam
    HARASSMENT: '0x...',     // fcp:method:policy:harassment
    MISINFORMATION: '0x...',  // fcp:method:policy:misinformation
    NSFW: '0x...',           // fcp:method:policy:nsfw
    DOXING: '0x...',         // fcp:method:policy:doxing
    ILLEGAL: '0x...',        // fcp:method:policy:illegal
} as const;

// === SUGGESTED ATTRIBUTE PREDICATES ===
export const ATTR_SUGGESTED = {
    NAME_BRAND: '0x...',
    SKILL: '0x...',
    INDUSTRY: '0x...',
    MEDIA_URI: '0x...',
    MEDIA_AVATAR: '0x...',
    DESCRIPTION: '0x...',
    URL_WEBSITE: '0x...',
    URL_SOCIAL: '0x...',
    LOCATION: '0x...',
    TAG: '0x...',
    // ... etc
} as const;

// === SUGGESTED RELATIONSHIP PREDICATES ===
export const REL_SUGGESTED = {
    EMPLOYMENT: '0x...',
    MEMBERSHIP: '0x...',
    OWNERSHIP: '0x...',
    CREATED: '0x...',
    PART_OF: '0x...',
    LOCATED_IN: '0x...',
    ATTENDED_BY: '0x...',
    FUNDED_BY: '0x...',
    PRECEDENT: '0x...',
    OUTCOME: '0x...',
} as const;

// === UTILITY FUNCTIONS ===
export function getPredicateName(id: string): string | null;
export function getPredicateFideId(name: string): string;
export function isCorePredicate(id: string): boolean;
export function getCorePredicates(): Predicate[];
```

### Usage Pattern

```typescript
import { ATTR, REL, POLICY, ENTITY_TYPE } from '@fide/semantics';

// Create a "person" entity
const typeClaim = {
    subjectFideId: aliceFideId,
    attributeType: ATTR.TYPE,
    attributeValue: ENTITY_TYPE.PERSON
};

// Add primary name and alias
const primaryName = {
    subjectFideId: aliceFideId,
    attributeType: ATTR.NAME_PRIMARY,
    attributeValue: "Alice Johnson"
};

const aliasName = {
    subjectFideId: aliceFideId,
    attributeType: ATTR.NAME_ALIAS,
    attributeValue: "Ally"
};

// Flag content as spam
const spamFlag = {
    subjectFideId: claimFideId,
    methodologyFideId: POLICY.SPAM,
    value: -1,
    confidence: 95
};

// Create accountability relationship (Person → Agent)
const controlAgent = {
    fromFideId: personFideId,
    toFideId: agentFideId,
    relationshipType: REL.CONTROL
};

// Control digital asset (Person → Social Media Account)
const controlAccount = {
    fromFideId: personFideId,
    toFideId: twitterAccountFideId,
    relationshipType: REL.CONTROL
};

// Add account handle as separate attribute claim
const accountHandle = {
    subjectFideId: twitterAccountFideId,
    attributeType: ATTR.NAME_PRIMARY,
    attributeValue: "@alice_dev"
};

// Link evidence to a claim
const evidenceLink = {
    fromFideId: claimFideId,
    toFideId: evidenceEntityFideId,
    relationshipType: REL.EVIDENCE
};

// Ownership (legal/economic) - uses suggested predicate
import { REL_SUGGESTED } from '@fide/semantics';

const ownershipClaim = {
    fromFideId: personFideId,
    toFideId: laptopFideId,
    relationshipType: REL_SUGGESTED.OWNERSHIP
};

// Add laptop serial number as separate attribute claim
const laptopSerial = {
    subjectFideId: laptopFideId,
    attributeType: ATTR_SUGGESTED.DESCRIPTION,
    attributeValue: "Serial: ABC123"
};
```

### Why This Matters

| Approach | Developer Experience | Adoption |
|----------|---------------------|----------|
| Docs only | "What's the hex for 'name'?" | ❌ Friction |
| NPM package | `import { ATTR }` | ✅ Instant |

**Industry Precedent:**
- **Schema.org**: Succeeded because they published standard vocabularies
- **ActivityPub**: Namespaces are importable (`@context`)
- **OpenTelemetry**: Semantic conventions are NPM packages

---

## 5. The Claim Envelope

Every claim is wrapped in an envelope:

```typescript
interface ClaimEnvelope {
    schemaFideId: `0x${string}`;              // Which of the 4 schemas (canonical structure hash)
    schemaName?: string;                       // Optional human-readable name (not signed, for debugging)
    signedMessage: SignedMessage;              // The typed claim data (signed)
    claimAuthorshipKeyFideId: `0x${string}`;  // The signing key that signed this claim
    claimAuthorSignature: `0x${string}`;      // EIP-712 signature from the signing key
    claimFideId: `0x${string}`;               // Derived from signature (claim's entity ID)
}

// Indexer extends:
interface IndexedClaim extends ClaimEnvelope {
    indexedAt: string;                      // Trusted external timestamp
    indexSource: string;                    // Where anchored
}
```

**Note on `schemaName`:** This is optional metadata for debugging and display. It is NOT signed and does not affect claim validity. Indexers can validate it matches `schemaFideId` or ignore it.

**Note on derivations:**
- `claimAuthorshipKeyFideId` = Derived from recovering the public key from `claimAuthorSignature` (last 20 bytes of `keccak256(publicKey)`)
- `claimFideId` = `slice(keccak256(claimAuthorSignature), 12, 32)` - the claim's entity ID

### Derivations: Entities All the Way Down

**Core principle:** Everything in FCP is an entity. Claims are how entities come into existence. Schemas, predicates, persons, and claims themselves all get their IDs the same way — from signatures.

```typescript
// ALL IDs derive from signatures
claimFideId = slice(keccak256(signature), 12, 32)
```

| Concept | How It Gets an ID |
|---------|-------------------|
| Entity (person, org) | Someone signs a type claim → claimFideId |
| Schema | Someone signs a "schema definition" claim → claimFideId |
| Predicate/Type | Someone signs a "predicate definition" claim → claimFideId |
| Any claim | Signature → claimFideId |

**We derive schema IDs from their structure (EIP-712 type hash):**

```typescript
schemaFideId = keccak256(schemaStructureString)
```

**Why Structure-Aware IDs?**
- **Content-Addressable Schemas**: Changes to schema fields automatically result in a new ID.
- **Interoperability**: Any implementer can derive the same ID for the same schema structure.
- **Security**: Prevents schema spoofing (signing a different structure than what's claimed).

### Entity Resolution: The sameAs Pattern

If two people create the same schema (same content, different signatures):

```
Alice's claim: {schemaName: "FideEvaluation", fields: "..."} → claimFideId: 0xAAA
Bob's claim:   {schemaName: "FideEvaluation", fields: "..."} → claimFideId: 0xBBB
```

They're **different entities** with different IDs. Resolution happens via `sameAs` relationships:

```
0xBBB → sameAs → 0xAAA  (Bob's is an alias for Alice's)
```

Community consensus (or indexer policy) determines which is canonical:
- Most sameAs references wins
- Earliest indexed wins
- Most trusted author wins

### Bootstrap: Genesis Claims

The protocol defines 4 "genesis" schema claims signed by a well-known protocol key:

1. `FideEntityRelationship` schema
2. `FideEntityAttribute` schema
3. `FideActionStep` schema
4. `FideEvaluation` schema

These genesis claims are:
- Published in the protocol spec with their signatures
- Referenced by all implementations
- Can be superseded if the protocol evolves (governance process)

---

## 6. Universal Claim Fields

All 4 schemas include these fields (signed):

| Field | Type | Purpose |
|-------|------|---------|
| `claimedAt` | string | Signer's declared timestamp (not trusted alone) |
| `claimSupersedes` | address? | Prior claim being overridden (chain rule) |

Optional temporal fields (on Relationship and Attribute):

| Field | Type | Purpose |
|-------|------|---------|
| `claimValidFrom` | string? | When this claim becomes valid |
| `claimValidTo` | string? | When this claim expires |

---

## 7. The Two-Timestamp Model

| Timestamp | Field | Source | Trusted? |
|-----------|-------|--------|----------|
| Claimed | `claimedAt` | Signer declares | ❌ No |
| Indexed | `indexedAt` | Indexer observes | ✅ Yes |

- Use `indexedAt` for ordering and conflict resolution
- Use `claimedAt` for signer's legal declaration
- Flag suspicious: `claimedAt` significantly before `indexedAt`

## 8. Validation Responsibilities

Different layers of the system validate different things:

| Validation | Responsible Party | When | Action on Failure |
|------------|-------------------|------|-------------------|
| **Schema structure** (required fields, types) | Signer/Wallet | At signing time | Refuse to sign |
| **Signature validity** | Indexer | At ingestion | Reject claim |
| **Schema ID matches content** | Indexer | At ingestion | Reject claim |
| **Supersession chain rule** | **Indexer** | At ingestion | Soft reject (mark invalid) |
| **Duplicate supersession** | **Indexer** | At ingestion | Soft reject (mark orphaned) |
| **Timestamp sanity** | Indexer | At ingestion | Flag suspicious |
| **Business logic** | Application | At query/display | Filter or warn |

### Why the Indexer Enforces Chain Rules

The signer **cannot know** if claim A is already superseded — they don't have global state. Only the indexer has the full claim history and can enforce consistency.

**Indexer supersession validation:**
1. Receive claim C with `claimSupersedes: A`
2. Verify C is signed by the same author as A
3. Query: "Is A already superseded by another claim from this author?"
4. If yes: **Soft reject** — store with `status: 'invalid'`, `reason: 'duplicate_supersession'`
5. If no: Accept and index normally

### Hard Reject vs Soft Reject

| Strategy | Behavior | Use When |
|----------|----------|----------|
| **Hard reject** | Don't store the claim | Signature invalid, schema malformed |
| **Soft reject** | Store with invalid status | Chain rule violation, suspicious timestamp |

**Soft reject is preferred for chain violations** because:
- Creates audit trail ("someone tried to double-supersede")
- Allows investigation of potential key compromise
- Preserves data for forensics

---

## 9. Supersession Rules

### The Chain Rule

A claim already superseded cannot be superseded again.

```
A (original)
 ↑
B (supersedes A) ← accepted
 
C (supersedes A) ← REJECTED: A already superseded by B
```

Valid chain:
```
A → B → C (each supersedes the previous)
```

---

## 10. Storage Layer (Recommended Reference Implementation)

**Note:** The protocol does not mandate how indexers store data. Implementers can use any database, schema, or architecture that meets their needs. This section provides a **recommended reference implementation** for interoperability.

Indexers may use a two-table design for flexibility:

### Why Two Tables?

| Table | Purpose |
|-------|---------|
| `claims` | **Source of truth.** Complete signed claims, never modified. |
| `edges` | **Query optimization.** Derived triples for graph traversal. Can be rebuilt from claims. |

This separation allows:
- Complex claims (like DecisionTrace) to generate multiple edges
- Pure graph algorithms on the edges table
- Rebuilding edges without losing source data

### Schema

```sql
CREATE TABLE claims (
    claim_fide_id               BYTES32 PRIMARY KEY,
    schema_fide_id              BYTES32 NOT NULL,
    schema_name                 TEXT,                  -- Optional human-readable name
    content                     JSONB NOT NULL,        -- Complete signed content
    claim_signing_key_fide_id BYTES32 NOT NULL,     -- The signing key that signed this
    claim_author_signature      TEXT NOT NULL,         -- EIP-712 signature
    claimed_at                  TIMESTAMPTZ NOT NULL,
    claim_supersedes            BYTES32,
    indexed_at                  TIMESTAMPTZ NOT NULL,
    index_source                TEXT NOT NULL,
    status                      TEXT DEFAULT 'valid'   -- 'valid', 'invalid', 'orphaned'
);

CREATE TABLE edges (
    id                 SERIAL PRIMARY KEY,
    claim_fide_id      BYTES32 NOT NULL REFERENCES claims,
    from_fide_id       BYTES32 NOT NULL,
    predicate          BYTES32 NOT NULL,
    to_fide_id         BYTES32,
    value              TEXT,
    claim_valid_from   TIMESTAMPTZ,           -- Maps to claimValidFrom
    claim_valid_to     TIMESTAMPTZ            -- Maps to claimValidTo
);

CREATE INDEX idx_claims_schema ON claims(schema_fide_id);
CREATE INDEX idx_claims_signing_key ON claims(claim_signing_key_fide_id);
CREATE INDEX idx_claims_supersedes ON claims(claim_supersedes) WHERE claim_supersedes IS NOT NULL;
CREATE INDEX idx_edges_from ON edges(from_fide_id);
CREATE INDEX idx_edges_predicate ON edges(predicate);
CREATE INDEX idx_edges_to ON edges(to_fide_id) WHERE to_fide_id IS NOT NULL;
```

**Note:** For simpler use cases, a single table with extracted columns may suffice. The edges table is optional.

### Claim → Edge Mapping

| Schema | from_fide_id | predicate | to_fide_id | value |
|--------|--------------|-----------|------------|-------|
| EntityType | fideId | `type:{entityType}` | null | null |
| EntityRelationship | fromFideId | relationshipType | toFideId | null |
| EntityAttribute | subjectFideId | attributeType | null | attributeValue |
| FideActionStep | subjectFideId-derived | `action:{action}` | sessionFideId | {json} |
| Evaluation | subjectFideId | methodologyFideId | null | `{value, confidence}` |

---

## 11. Summary: The Evolution

```
v1 (Original):     12 schemas  →  Too many, redundant
v2 (Consolidated):  8 schemas  →  Still had bridge schemas
v2 (Refined):       7 schemas  →  Claims as entities, no bridge
v3 (Minimal):       5 schemas  →  Merged evaluations, temporal attributes
v4 (Universal):     1 schema   →  Beautiful for storage, dangerous for signing
v5 (Bimodal):       4 schemas (protocol) + 1 table (storage)  →  ✅ THE ANSWER
```

---

## 12. Conclusion

The Bimodal Architecture achieves:

✅ **4 typed schemas** for human-readable signing  ", "StartLine": 544, "TargetContent": "✅ **5 typed schemas** for human-readable signing  
✅ **1 triple table** for machine-optimized querying  
✅ **EIP-712 readability** — users see meaningful fields  
✅ **Protocol validation** — typed fields prevent malformed claims  
✅ **Query performance** — indexed edges, no JSON parsing  
✅ **Supersession chains** — immutable updates with audit trail  
✅ **Two-timestamp model** — signer declaration + trusted indexer time  
✅ **Temporal validity** — relationships and attributes can expire  

**The Universal Triple is the goal for the machine. The Explicit Schemas are the goal for the human.**

---

*"Sign with types. Store with triples. Query with graphs."*

---

# Appendix A: Detailed Entity Type Reference

The following entity types are used as `attributeValue` when `attributeType = fcp:attr:type`. These notes are preserved from the existing `schemas.ts` documentation.

## A.1 Entity Types

### `person`
A natural human being (living or deceased).

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Biologically human |
| **Examples** | Alice Johnson, Elon Musk |
| **Schema.org** | schema:Person |

### `organization`
A group of people or entities working for a purpose.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Has members/governance |
| **Examples** | Apple Inc., Uniswap DAO, Red Cross |
| **Schema.org** | schema:Organization |

### `place`
A physical location or spatial region.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Has coordinates/address |
| **Examples** | NYC, France, Madison Square Garden |
| **Schema.org** | schema:Place |

### `event`
A happening at a specific time and place.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Has a start/end date |
| **Examples** | WWDC 2024, Coachella, Olympics |
| **Schema.org** | schema:Event |

### `product`
An item, tool, or asset created for utility or exchange.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Utilitarian - used to *do* something |
| **Examples** | iPhone 15, Tesla Model S, Linux, Bitcoin, ChatGPT |
| **Schema.org** | schema:Product, schema:SoftwareApplication |

### `creative_work`
Information, art, or content created for consumption.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Informational - used to *know* or *feel* |
| **Examples** | New York Times, Joe Rogan Experience, Elden Ring, The Bible |
| **Schema.org** | schema:CreativeWork |

### `agent`
An autonomous reasoning entity (AI instance) capable of non-deterministic decision-making based on context.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Acts as a proxy for a controller |
| **Examples** | Fide Agent v1.0 Instance, Deployment #abc123 |
| **Note** | Refers to running instances, not code (code is `product`) |

### `signing_key`
A cryptographic key used for claim authorship. The technical "passport" for signing claims and establishing accountability.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Derived from last 20 bytes of `keccak256(publicKey)` |
| **Examples** | 0x742d35cc6637b3d0ad579e2ff2b4e3b4c2a6b5f8 |
| **Purpose** | Authorship keys derive signing authority from control relationships |

### `schema`
A schema definition entity.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Defines the structure of claims |
| **Examples** | FideEvaluation v1.0 |
| **Note** | Genesis schemas are signed by protocol key |

### `predicate`
A predicate/relationship type definition.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Defines meaning of relationships and attributes |
| **Examples** | fcp:attr:skill, fcp:rel:employment |

### `methodology`
An evaluation methodology.

| Aspect | Detail |
|--------|--------|
| **Key Trait** | Defines how evaluations are produced |
| **Examples** | fact-check-v1, reputation-score-v2 |

---

## A.2 The Decision Tree

To determine which type applies:

1. **Is it a human being?** → `person`
2. **Is it a group, company, or government?** → `organization`
3. **Is it a location you can go to?** → `place`
4. **Is it a happening with a start/end time?** → `event`
5. **Is it a tool, asset, software, or good?** → `product`
6. **Is it media, content, or art?** → `creative_work`
7. **Is it an AI instance making decisions?** → `agent`
8. **Is it a cryptographic key for authorship?** → `signing_key`

---

## A.3 Product vs Creative Work

The hardest boundary. Use the **Primary Intent** rule:

- **Product**: Primary value is **utility** - you use it to *do* something
- **Creative Work**: Primary value is **consumption** - you use it to *know* or *feel* something

### The Tie-Breaker Test

> "If I replace it with a different version, is it the same entity?"

- **The Hammer Test (Product)**: If I trade my iPhone 15 for another iPhone 15, I don't care. Fungible tools.
- **The Book Test (Creative Work)**: If I trade "Elden Ring" for "Call of Duty," I care. Not fungible.

| Entity | Type | Reasoning |
|--------|------|-----------|
| Software (Linux, Excel) | `product` | Tools for performing functions |
| Video Games (Elden Ring) | `creative_work` | Value is in the specific experience |
| Digital Assets (Bitcoin) | `product` | Assets with utility |
| Podcasts, Newspapers | `creative_work` | Information consumption |

---

## A.4 Brands Are Not Entity Types

Brands are **names/identity** attached to organizations or products, not separate entities.

- "Nike" is a name claim attached to the `organization` Nike Inc.
- "Air Jordan" is a name claim attached to the `product` line.

---

## A.5 Abstract Concepts Must Be Anchored

**Protocol Requirement:** Abstract concepts must be anchored to concrete entities.

- **Movement Concepts** → Anchor to the `organization` leading it
- **Event Concepts** → Anchor to the `event` that occurred
- **Ideological Concepts** → Anchor to `creative_work` expressing the idea

**Why:** Unanchored concepts create semantic swamps.

---

## A.6 The Accountability Loop

FCP creates a clear chain of responsibility:

**Person → controls → Agent → controls → Signing Key → signs → Claim**

- A **person** controls an **agent** (via relationship claim)
- The **agent** controls an **signing key** (via relationship claim)
- The **signing key** signs **claims**, establishing a clear chain of accountability
- The **signing key** serves as the cryptographic "passport" for the agent

---

# Appendix B: Detailed Relationship Types

## B.1 Relationship Categories (Preserved from schemas.ts)

| Category | Description | Mutable? | Examples |
|----------|-------------|----------|----------|
| `work` | Professional or economic ties | Yes | employee, board member, founder |
| `create` | Authorship or origination | **No** | author, composer, inventor |
| `own` | Legal or physical possession | Yes | owner, collector |
| `social` | Personal or human ties | Yes | friend, spouse, colleague |
| `trust` | Reputation and safety signals | Yes | trust, block, report |
| `control` | Technical authority over entity | Yes | person controls signing_key |

## B.2 Directionality Rules

| Relationship Type | Directed? | Rationale |
|-------------------|-----------|-----------|
| `social:peer` | No | Mutual by definition |
| `social:follows` | Yes | One-way assertion |
| `work:lead` | Yes | Team has specific lead |
| `trust:sameAs` | No | Symmetric merge |

## B.3 Entity Merging via `sameAs`

When `trust:sameAs` relationships accumulate, indexers can merge entity identities, allowing queries for one entity to return combined attributes from all linked aliases.

---

# Appendix C: Migration Notes

## C.1 What STAYS THE SAME

The following valuable documentation from `schemas.ts` should be preserved in the final implementation:

| Content | Location | Status |
|---------|----------|--------|
| Entity type decision tree | FideEntityType notes | ✅ Preserve |
| Product vs Creative Work distinction | FideEntityType notes | ✅ Preserve |
| Brand handling rules | FideEntityType notes | ✅ Preserve |
| Abstract concept anchoring | FideEntityType notes | ✅ Preserve |
| Accountability loop (Person → Agent → Key) | FideEntityType notes | ✅ Preserve |
| Primary vs Alias name rules | FideEntityName notes | ✅ Move to attribute docs |
| Name format/capitalization rules | FideEntityName notes | ✅ Move to attribute docs |
| Relationship directionality | FideEntityRelationship notes | ✅ Preserve |
| Temporal field usage (key rotation) | FideEntityRelationship notes | ✅ Preserve |
| Evidence types and privacy guidelines | FideEvidence notes | ✅ Move to relationship docs |
| Action step as searchable precedent | FideActionStep notes | ✅ Preserve |
| Methodology transparency spectrum | FideEntityScore notes | ✅ Move to evaluation docs |

## C.2 What CHANGES

| Old Schema | New Representation | Migration |
|------------|-------------------|-----------|
| `FideEntityType` | `FideEntityAttribute` with `attributeType = fcp:attr:type` | Merge into attribute |
| `FideEntityName` | `FideEntityAttribute` with `attributeType = fcp:attr:name:*` | Merge into attribute |
| `FideClaimVerdict` | `FideEvaluation` | Merge (verdict = value, same methodology pattern) |
| `FideEntityScore` | `FideEvaluation` | Already same structure |
| `FidePolicyFlag` | `FideEvaluation` with policy methodology | value = -1, methodology = policy type |
| `FideActionStep` | `subject → action:X → session, value: {json}` | Model as entity, not schema |
| `FideSchemaNameDefinition` | Removed (application layer) | Not needed in protocol |
| `FideIdentityProtocolDefinition` | Removed (application layer) | Not needed in protocol |

## C.3 New Protocol Elements

| Element | Description |
|---------|-------------|
| `claimedAt` | Universal field: signer's declared timestamp |
| `claimSupersedes` | Universal field: prior claim being overridden |
| `claimValidFrom` | Temporal: when claim becomes valid |
| `claimValidTo` | Temporal: when claim expires |
| `schemaFideId` | Envelope metadata: which schema (from signature) |
| `claimFideId` | Envelope metadata: claim's entity ID (from signature) |
| `indexedAt` | Indexer metadata: trusted external timestamp |
| `indexSource` | Indexer metadata: where anchored |

## C.4 Field Naming Changes

| Old Field | New Field | Reason |
|-----------|-----------|--------|
| `trace_id` | `traceID` | camelCase consistency |
| `generation_id` | `generationID` | camelCase consistency |
| `step_index` | `stepIndex` | camelCase consistency |
| `context_snapshot` | `contextSnapshot` | camelCase consistency |
| `confidence_score` | `confidenceScore` | camelCase consistency |
| `subjectClaimSignature` | `subjectFideId` | Claims are entities now |
| `verdict` | `value` | Unified with scores |
| `scoreValue` | `value` | Unified with verdicts |

---

# Appendix D: Predicate Naming Conventions

## D.1 Namespace Structure

```
fcp:{category}:{subcategory}:{specific}
```

| Category | Purpose | Examples |
|----------|---------|----------|
| `attr` | Attribute types | `fcp:attr:type`, `fcp:attr:name:primary` |
| `rel` | Relationship types | `fcp:rel:employment`, `fcp:rel:control` |
| `method` | Evaluation methodologies | `fcp:method:fact-check`, `fcp:method:reputation` |
| `action` | Action step types | `fcp:action:tool_call`, `fcp:action:thought` |

## D.2 Extensibility

Anyone can create new predicates by:

1. Creating a predicate entity (type claim where attributeValue = "predicate")
2. Adding attributes defining its purpose and value schema
3. Using that entity's FideId in claims

Protocol-defined predicates use the `fcp:` namespace. Application-specific predicates should use their own namespace (e.g., `myapp:attr:custom`).
