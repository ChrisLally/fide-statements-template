# Critique 19: Architectural Pivot — Source Type 0 Naming (UUID → Statement)

**Date**: 2026-02-03 (updated: 2026-02-04)
**Decision**: Rename source type 0 from "UUID" to "Statement"
**Status**: Implementation in progress

## The Change

Replace all instances of "UUID" as a source type identifier with "Statement" throughout the FCP codebase.

### Before (Random Math):
```typescript
export const SOURCE_TYPE_MAP = {
  UUID: "0",
  ...TYPE_MAP
} as const;
```

### After (Structural Math):
```typescript
export const SOURCE_TYPE_MAP = {
  Statement: "0",
  ...TYPE_MAP
} as const;
```

## Why This Matters: The Architectural Pivot

This is **not just a rename**. It represents a fundamental shift in how FCP models identity.

### The Problem with "UUID"

The term "UUID" describes the **mechanism** (a universally unique identifier) but obscures the **principle** we're implementing:

- **Mechanism-focused**: "UUID" suggests random, disconnected IDs
- **Principle-obscured**: Doesn't explain WHY we use source 0 or WHAT it's for
- **Protocol-naive**: Implies UUIDs are a generic concept, not FCP-specific

### The Principle: Statement-Anchored Identity

Source type 0 represents a **protocol-native** identity model where entities are identified by **their founding statement** in the Fide Context Graph:

- **0x00** = Statement identified by its content hash (S-P-O triple)
- **0x10** = Person identified by their founding statement (not an external database)
- **0xa0** = Attestation identified by its content hash (batch signing commitment)

**Critical insight (UPDATED)**: For **Domain Entities** like Person or Organization using source type `0` (Statement), the `rawIdentifier` is the **full 42-char Genesis Statement Fide ID string** (e.g., `"0x00..."`), not the sliced 38-char fingerprint substring.

This keeps the math uniform (no special cases): `calculateFideId(type, source, rawIdentifier)` always hashes its `rawIdentifier`.

- `0x00` (Statement) → derived from canonical JSON of the S-P-O triple (content-addressed)
- `0x10` (Person) → derived from the Genesis Statement **ID** (the full `"0x00..."` string)
- The Statement itself is queryable/auditable: "What statement introduced this entity to the protocol?"

This is fundamentally different from random UUIDs — the Person's ID literally points to the statement that introduced them to the protocol.

## Architectural Implications

This naming change enforces a critical pattern throughout FCP:

### Before: Random Math
```typescript
// How would we calculate a Person ID with "UUID"?
const personId = calculateFideId('Person', 'UUID', randomUUID());
// Problem: Where did this person come from? No protocol history.
```

### After: Structural Math
```typescript
// How do we calculate a Person ID with "Statement"?
// Step 1: Create a founding statement
const foundingStatement = {
  s: personExternalId,  // e.g., 0x15... (via Product) or 0x18... (via Account)
  p: 'schema:type',
  o: personTypeId       // e.g., 0x66... (schema:Person)
};

// Step 2: Calculate Genesis Statement ID (0x00...)
const genesisStatementFideId = calculateFideId('Statement', 'Statement', canonicalJsonSPO(foundingStatement));

// Step 3: Derive the protocol-native Person ID from the Genesis Statement ID
const personId = calculateFideId('Person', 'Statement', genesisStatementFideId);
// Result: Person's ID points back to protocol fact
```

### Key Differences

| Aspect | UUID (Random Math) | Statement (Structural Math) |
|--------|--------------------|-----------------------------|
| **Identity Anchor** | Random, disconnected | Protocol-native founding statement |
| **Provenance** | Lost (no history) | Built-in (trace back to statement) |
| **Collision Risk** | External (UUID collisions) | Zero (content-addressed) |
| **Authority** | External database | Fide Context Graph = Source of Truth |
| **Multi-signer Agreement** | Can't detect (different UUIDs) | Built-in (same fingerprint) |

## Implementation Changes Required

### 1. TypeScript Type Maps (`lib/fcp/fide-id.ts`)
- Rename `UUID` to `Statement` in `SOURCE_TYPE_MAP`
- Update `calculateStatementFideId()` to use `'Statement'` instead of `'UUID'`
- Update `fideIdToUrn()` to map `'0'` to `'Statement'`

### 2. Documentation (`content/docs/fcp/identifiers.mdx`)
- Update `ID_MAP` examples (TypeScript & Python)
- Clarify that source 0 is "entity identified by FCP Statement"
- Add explanation of Statement-Anchoring model
- Show examples: 0x00, 0x10, 0xa0 with Statement source

### 3. Database Schema (`scripts/supabase/manual-migrations/fcp-tables-supabase.sql`)
- Update enum comment for `fcp_source_identifier_type`
- Clarify source 0 = "Statement: Entity identified by FCP Statement (content-addressed)"

### 4. Codebase Search & Replace
Replace all `'UUID'` string literals used with `calculateFideId()`:
- `json-claim-editor.tsx`: Pattern templates (11 instances)
- `attestation-helpers.ts`: Test data generation (2 instances)
- `batch-signer.ts`: Merkle tree construction (1 instance)
- `materialize.ts`: Attestation ID calculation (1 instance)
- `seed-test-claims.ts`: Test data creation (5 instances)

**Total**: ~20 instances across the codebase

## Business & Technical Benefits

### 1. Protocol-Native Identity

Unlike external sources (Passport, Twitter, Bank Account), **Source 0 identity is intrinsic to FCP**:

**The Analogy:**
- **Source 5 (Passport/Twitter)** = Issued by an external authority
  - If Twitter shuts down, your Source 5 ID becomes a dead link
  - You depend on Twitter's continued existence
  - **Vendor lock-in risk**

- **Source 0 (Protocol-Native)** = Inherent to the system, like DNA
  - Rooted in the protocol's own mathematics
  - Valid forever, regardless of external systems
  - **No vendor lock-in**

**Business Value:** Customers don't depend on any single platform. Their identity lives in the Fide Context Graph itself.

### 2. Built-in Provenance
Every entity's ID tells you where it came from:
- "Know this Person? Look up their 0x10 ID in the graph to find their Genesis Statement"
- "Want to audit this Attestation? Check its 0xa0 ID against the Merkle root"
- Complete audit trail: "Who introduced this entity to the protocol? When? Under what authority?"

### 3. Protocol Authority (Fide Context Graph = Source of Truth)
Fide Context Graph becomes the **authoritative source** for identity:
- No external databases needed for identity resolution
- Same statement = same entity across all systems (deterministic)
- Enables cross-system identity reconciliation without federation protocols
- Parties in different trust domains can discover they're talking about the same person

### 4. Multi-signer Coordination Without Consensus
Multiple parties can independently attest to the SAME statement (same fingerprint):
- Query: "Who else believes this Person is Alice?"
- Answer: Look for multiple attestations pointing to same 0x10 Genesis Statement
- No UUID collision issues (content-addressed mathematics guarantees uniqueness)
- Agreement emerges organically from shared protocol, not from voting

### 5. Developer Experience
Clearer mental model:
- "Everything in FCP is a statement"
- "Identity is rooted in statements"
- "Source 0 is native FCP; sources 5,6,8,a are imports from external systems"
- Developers stop thinking about "generating" IDs and start thinking about "discovering" them

## Semantic Correctness

The Fide ID structure now reads correctly as **all nouns**:

| Prefix | Reading | Meaning |
|--------|---------|---------|
| `0x00` | "**Statement** identified by **Statement**" | S-P-O triple, content-addressed |
| `0x10` | "**Person** identified by **Statement**" | Person's ID is derived from their Genesis Statement ID (`0x00...`) |
| `0x15` | "**Person** identified by **Product**" | Person known by Twitter/domain handle |
| `0x18` | "**Person** identified by **CryptographicAccount**" | Person known by wallet address |
| `0x66` | "**CreativeWork** identified by **CreativeWork**" | Concept/predicate like "schema:worksFor" |
| `0xa0` | "**Attestation** identified by **Statement**" | Batch commitment, content-addressed by Merkle root |

**Key insight:** The Genesis Statement for 0x10 could be ANY **Subject-statement** involving the person — a type declaration, a name assignment, a relationship declaration, or even a self-referential statement. The protocol doesn't care which one **is** — only that:
1. The entity is the Subject (active declaration, not passive mention)
2. It is deterministically selected by the sequencing source (registry ordering and/or anchors)
3. All indexers using the same sequencing source compute the same Genesis Statement ID (`0x00...`)

This is consistent across all 10+ entity types × 7 source types.

## Risk Assessment

### Low Risk
- ✅ Purely mechanical rename (no behavioral changes)
- ✅ All instances are string literals, easy to find & replace
- ✅ TypeScript type system catches incompleteness
- ✅ Backward compatibility not required (internal protocol)

### Migration Path
1. Update type maps and documentation
2. Compile TypeScript (will error on missed instances)
3. Fix all compilation errors
4. No database migration needed (enum values unchanged, just renamed)

## Decision Rationale (Expert Consensus)

This change was recommended by FCP architecture experts as **correct and necessary** because:

1. **Naming coherence**: "Statement" aligns with all other entity type nouns
2. **Principle clarity**: Explains WHAT source 0 is (protocol-native) not just HOW it works (hashed)
3. **Architectural truth**: Reflects the actual design: entities ARE their statements
4. **Future-proof**: Supports statement-centric identity model as protocol evolves

## Critical Problem Solved: Distributed Consensus on Genesis Statements

The Statement-anchored identity model solves a fundamental coordination problem in distributed systems.

### The Problem: Competing Genesis Candidates

When multiple Subject-statements could serve as a genesis candidate (e.g., published in the same window/event or introduced by different parties):

**Without deterministic tie-breaking:**
- System A picks Statement A as the Genesis Statement → computes primary 0x10 ID from Genesis A
- System B picks Statement B as the Genesis Statement → computes primary 0x10 ID from Genesis B
- **Result**: Different systems have different IDs for the same entity
- **Outcome**: Context amnesia — the very problem FCP solves becomes unsolved

**The Critical Requirement (UPDATED):**
Every indexer in the distributed Fide Context Graph must arrive at the **exact same decision** for which statement is canonical **given the same sequencing source**.

In practice, “first-seen” is subjective unless sequenced. So for global convergence, we must define (and implementations must share) a deterministic ordering source such as:

- canonical Git registry history / merge ordering (trusted-witness model), and/or
- anchored batch roots in a sequenced system (L2 / EAS / on-chain), and/or
- a multi-witness anchoring policy (earliest anchored inclusion by a trusted witness set).

### The Solution: Deterministic Selection + Tie-Breaking Algorithm (UPDATED)

#### 1. The "Subject-Only" Genesis Rule (Primary Requirement)

**Only statements where the entity is the SUBJECT can qualify as a Genesis Statement.**

This enforces an **"active declaration"** model: entities are only "officially born" into the protocol when there's a statement *about* them as the primary focus, not merely a mention.

**Why "Subject-Only":**
- **Eliminates ambiguity** — No guessing which random mention should anchor the identity
- **Enforces data hygiene** — Developers follow "Declare-then-Reference" pattern
- **Semantic purity** — Part 1 entity type is only set when entity is explicitly declared as Subject
- **Separates identity from mention** — Being referenced doesn't create an identity; being declared does
- **Aligns with Fide ID semantics** — "Person identified by Statement" means a statement where the person is the primary subject

**Rule Application:**
```
Statements about Alice in same Attestation:
  ✅ A1: alice → rdf:type → Person           (Alice is Subject) ← ONLY CANDIDATES
  ✅ A2: alice → schema:name → "Alice"       (Alice is Subject) ← ONLY CANDIDATES
  ❌ B1: acme → schema:employee → alice      (Alice is Object) ← INELIGIBLE
  ❌ B2: bob → foaf:knows → alice            (Alice is Object) ← INELIGIBLE

If A1 or A2 exist → Genesis = earliest by sequencing source (registry ordering and/or anchors); lexical fingerprint sort only breaks ties
If only B1/B2 exist → Alice has NO 0x10 ID yet (remains "Phantom Entity")
```

**The Guarantee:**
Every 0x10 Fide ID represents an explicit declaration. The entity was formally introduced to the protocol as the Subject of a statement.

#### 2. Sequencing Source (Primary Selector)

After filtering to Subject-statements, select the Genesis Statement by the agreed sequencing source (so independent indexers converge):

- **Registry-first (trusted witness)**: canonical Git registry history / merge ordering (e.g., protected branch merge order).
- **Anchor-first (sequenced)**: earliest anchored inclusion (e.g., lowest block height / earliest log index) among the trusted anchor set.

#### 3. Lexical Sort (Final Tie-Breaker)

If the sequencing source yields a tie (same publication event/window), break ties by lexical sort on the Statement fingerprint (the 38-char tail of the `0x00...` Statement ID).

#### 4. Full Deterministic Algorithm (Subject-Only + Sequencing + Lexical Tie-Break)

```
Input: Set of all statements in the protocol
       Entity E (the entity we're finding Genesis for)
Output: Single Genesis Statement ID (`0x00...`) (identical across all indexers using the same sequencing source)
        OR: NULL if E never appears as a Subject (entity remains "Phantom")

Step 1: IDENTIFY SUBJECT-ROLE STATEMENTS
        From all statements in protocol:
          - Collect statements where E is in the Subject position
          - Let this set = SubjectStatementsForE

        If SubjectStatementsForE is empty (E never appears as Subject):
          → Return NULL (entity has no 0x10 ID yet)
          → Entity is a "Phantom" — refer to "Handling Phantom Entities" section

Step 2: ORDER by SEQUENCING SOURCE
        Order SubjectStatementsForE using the agreed sequencing source:
          - canonical registry ordering (Git history / merge ordering), and/or
          - earliest trusted anchor inclusion ordering.

Step 5: GUARANTEE
        - All indexers independently execute this algorithm **with the same sequencing source**
        → All compute the same Genesis Statement ID (`0x00...`) for entity E
        → All compute the same 0x10 ID for entity E
        → Only statements where E is the Subject are considered
```

### The Business Logic: "Genesis Statement" as Birth Certificate

For non-technical stakeholders:

- **The 0x10 ID** is the entity's **FCP Birth Certificate** — the canonical identity anchor
- Even if multiple records are filed in the same sequencing window (e.g., same Attestation batch), the protocol has a deterministic way to pick "the official first record"
- The algorithm uses the sequencing source first, then lexical fingerprint tie-break to decide which record is primary within a window
- Once the 0x10 ID is established, all other statements become "additional context" linked to that primary identity
- Different parties can independently make claims about the same person; indexers converge when they share the same sequencing source (registry ordering and/or trusted anchors) and canonicalization rules

**The Power of Determinism:**
- No voting rounds needed
- No Byzantine fault tolerance overhead
- No leader election
- No centralized database
- Every system computes the same result **given the same sequencing source**

### Why "0" is the Perfect Symbol

Using **0** for source type "Statement" encodes this principle perfectly:

- **0 = Index 0** → "The first record in the entity's protocol history"
- **0 = Ground Zero** → "The foundational fact from which all other identity claims derive"
- **0 = Origin Point** → "All other sources (Product, Account, CreativeWork) are imports; this is native to FCP"
- **0 = Genesis** → "The founding statement that anchors the entity's existence in the distributed ledger"

The symbol itself communicates: **"This entity's identity is rooted at index 0 — the Genesis Statement."**

### Example: Multi-Party Coordination

Three entities sign statements about Alice in a single Attestation:

| Statement | Fingerprint | Role | Status |
|-----------|-------------|------|--------|
| "Alice rdf:type Person" | `...abc123` | Subject | ✅ Genesis candidate |
| "Alice schema:name 'Alice'" | `...def456` | Subject | ✅ Genesis candidate |
| "Acme schema:employee Alice" | `...xyz789` | Object | ❌ Ineligible |

**Protocol Logic (Subject-Only + Sequencing + Lexical Tie-Break):**
1. All three statements are in the same Attestation (same sequencing window)
2. **Filter for Subject-only**: [abc123, def456] (xyz789 is Object, excluded)
3. Tie-break (same window) by lexical fingerprint: abc123 < def456
4. **Genesis Statement ID** = the `0x00...` Statement Fide ID for the chosen Subject-statement (abc123)
5. **Alice's 0x10 ID** is derived from that Genesis Statement ID string (`"0x00..."`) = permanent anchor

**Result:** Even though Acme tried to define Alice (indirectly, as Object):
- Only statements where Alice is the Subject can be Genesis candidates
- The employment relation (xyz789) is ignored for identity purposes
- Alice's type declaration (abc123) becomes the canonical anchor
- **All indexers using the same sequencing source compute the same 0x10 ID**
- No coordination protocol needed
- Only Subject-statements count toward Genesis

**Key insight:** This enforces "active declaration over passive mention." Acme's statement about employing Alice is valid context, but it doesn't create her identity. Her identity only exists when she (or someone acting on her behalf) is the Subject of a declaration.

## Technical Accuracy: Uniform Hashing (UPDATED)

**Critical clarification for implementation teams:**

We keep one derivation rule: `calculateFideId(type, source, rawIdentifier)` always hashes its `rawIdentifier` (no source-specific special cases).

```
Layer 1: Statement ID derivation (0x00...)
         Raw Input: canonical JSON of {s, p, o} (RFC 8785)
         Hash: Keccak-256(JSON) → take tail for fingerprint
         Result: 0x00... (Statement identified by its content)

Layer 2: Domain entity ID derivation with source type 0 (Statement) (0x10/0x20/...)
         Raw Input: the full Genesis Statement Fide ID string, e.g. "0x00..."
         Hash: Keccak-256("0x00...") → take tail for fingerprint
         Result: 0x10... (Person/Org/etc. derived from Genesis Statement ID)

Queryability
         To find "what introduced entity X":
         1. Resolve entity X to its Genesis Statement ID (0x00...) using your sequencing policy
         2. Fetch the Statement (0x00...) from the graph to inspect its S-P-O content
```

## Visual: Genesis Algorithm Decision Tree

For technical teams implementing the deterministic algorithm:

```
Input: Set of statements about Entity E

        ┌──────────────────────────────────┐
        │ Filter: SUBJECT statements only  │
        │ (E must be the Subject)          │
        └──────────────┬───────────────────┘
                       │
        ┌──────────────┴──────────────────┐
        │                                  │
        ↓ SubjectStatements exist        ↓ SubjectStatements empty
        │                                  │
   CONTINUE              E = "Phantom Entity"
   (Active Declaration)   (No 0x10 ID yet)
        │
        ↓
        ┌──────────────────────────────────┐
        │ Order by sequencing source       │
        │ (registry ordering / anchors)    │
        └──────────────┬───────────────────┘
                       │
                       ↓
        ┌──────────────────────────────────┐
        │ If tie: lexical sort by          │
        │ Statement fingerprint            │
        └──────────────┬───────────────────┘
                       │
                       ↓
        ┌──────────────────────────────────┐
        │ Return Genesis Statement ID      │
        │ (0x00...)                        │
        └──────────────────────────────────┘

Result: Genesis Statement ID (`0x00...`) or NULL
        (Identical across all indexers using the same sequencing source)
        (Subject requirement enforced)
```

## Multi-Source Arrival: Convergence Requires Sequencing (UPDATED)

**Scenario:** The same new entity may be introduced via Subject-statements that appear in multiple attestations and/or multiple registries, arriving in different orders to different indexers.

```
Attestation A (from Alice's node):
  - Statement S1: alice → rdf:type → Person (fingerprint: abc123...) [Subject]

Attestation B (from Bob's node):
  - Statement S2: alice → schema:name → "Alice" (fingerprint: def456...) [Subject]
  - Statement S3: bob → foaf:knows → alice (fingerprint: ghi789...) [Object]
```

**Protocol behavior (UPDATED):**

1. Apply the **Subject-only filter**: only S1/S2 are Genesis candidates; S3 is excluded because Alice is an object.
2. Choose Genesis by the **agreed sequencing source**:
   - registry ordering (canonical Git merge/history ordering), and/or
   - earliest trusted anchor inclusion ordering.
3. If tied (same publication event/window), break ties by lexical sort on the Statement fingerprint.
4. Derive the protocol-native entity ID from the Genesis Statement ID:
   - `person_0x10 = calculateFideId('Person','Statement', genesisStatement_0x00)`

**Key point:** global convergence depends on shared sequencing. Different indexers can ingest in different local orders and still converge *if* they share the same registry ordering policy and/or trust the same anchor witness set.

## Implementation Impact: What Changes in Documentation

### 1. `identifiers.mdx` — Code Examples

**UPDATE: ID_MAP in TypeScript example**
```typescript
// BEFORE:
export const SOURCE_TYPE_MAP = {
  UUID: "0",
  ...TYPE_MAP
} as const;

// AFTER:
export const SOURCE_TYPE_MAP = {
  Statement: "0",
  ...TYPE_MAP
} as const;
```

**UPDATE: Prefix table (Common Prefixes accordion)**
```
| `0x10...` | Person (via Statement) | Person identified by Genesis Statement |
| `0x20...` | Organization (via Statement) | Org identified by Genesis Statement |
| `0xa0...` | Attestation (via Statement) | Batch commitment (Merkle root anchor) |
```

**UPDATE: Part 2 "Identifier Source" section**
Replace the UUID description with Statement-specific explanation:
- Protocol-native identity (not imported from external systems)
- Rooted in Genesis Statement (typed, deterministic)
- Built-in provenance (audit trail queryable)
- No vendor lock-in (independent of any platform)

### 2. `entities.mdx` — Entity Type Pages

**UPDATE: Each entity type page (Person, Organization, Place, etc.)**
- Replace "Universally Unique (UUID)" language
- Add: "Identified by its Genesis Statement in the Fide Context Graph"
- Explain: "The founding statement that introduced this entity to the protocol"
- Example: "Alice's 0x10 ID is the fingerprint of her type declaration"

### 3. `schema.mdx` — Statement Documentation

**UPDATE: Statement entity description**
- Clarify: "A Statement is identified by its content hash (0x60)"
- Add: "Statements are the building blocks for all other entities (0x00-0xa0)"
- Show: Example of Genesis Statement for a Person

### 4. Database Enum Comments

**UPDATE: `fcp_source_identifier_type` enum in SQL**
```sql
CREATE TYPE fcp_source_identifier_type AS ENUM (
    '0',  -- Statement: Protocol-native identity via Genesis Statement (content-addressed)
    '5',  -- Product: External platform identifiers (e.g., Twitter)
    '6',  -- CreativeWork: Concepts and predicates
    ...
);
```

## Handling "Phantom Entities" — Objects Without Subjects

**Definition:** A Phantom Entity is an entity that exists in the protocol only as an Object (or other non-Subject role) in statements made by others. It has no 0x10 Fide ID because there is no Statement where it is the Subject.

**Example:**
```
Statement 1: acme → schema:employee → alice
Statement 2: bob → foaf:knows → alice
Statement 3: alice ← rdf:type ← Person  (WRONG: alice must be Subject, not Object)

Result: Alice is mentioned in statements 1 and 2, but has no 0x10 ID
        Alice is a "Phantom Entity" — present in the graph but not officially born
```

### How Phantom Entities Participate in the Protocol

**Step 1: Reference Without Identity**
When signers need to reference a Phantom Entity, they use **external identifiers**:
- 0x15 (Person via Product) — if you know Alice's Twitter handle
- 0x18 (Person via CryptographicAccount) — if you know Alice's wallet
- 0x55 (Product via Product) — a platform-native ID
- Any other source type (5, 6, 8, a, e) EXCEPT 0 (Statement)

```
// Alice is still a Phantom (no 0x10)
// But we can reference her via external ID:
Statement: acme → schema:employee → 0x15<twitter:alice>
```

**Step 2: Birth Registration**
When Alice (or anyone) creates a Subject-statement about her:
```
Statement: alice → rdf:type → Person
// Alice is now officially born
// She gets a Genesis Statement ID (0x00...) for this Subject-statement
// Then her protocol-native Person ID (0x10...) is derived from that Genesis Statement ID string ("0x00...")
```

**Step 3: Identity Consolidation**
Once Alice has a 0x10 ID, a `sameAs` statement links her old external IDs to her new canonical ID:
```
Statement: 0x15<twitter:alice> → owl:sameAs → 0x10<alice-genesis>
// Now all previous references to alice via Twitter resolve to her canonical 0x10
```

### The Business Logic: "No Declaration, No Passport"

For non-technical stakeholders:

- **Mention ≠ Identity**: Being talked about doesn't make you an official protocol citizen
- **Declaration = Identity**: Only when you (or someone on your behalf) make a statement about yourself do you get an official ID
- **Phantom Entities are real**: They can be referenced and discussed, but they're in a "pending" state
- **Convergence**: When a Phantom Entity gets born (Genesis Statement created), all previous mentions automatically resolve to it via `sameAs`
- **Data Hygiene**: Enforces that every active entity in the protocol has been deliberately introduced, not accidentally discovered

### Impact on Alias Resolution

The alias resolution algorithm must account for Phantom Entities:

```
Query: "Resolve alias x.com/alice to primary ID"

Step 1: Check if alice has a Subject-statement (0x10 ID)
        If YES → resolved_identifier_fingerprint = primary entity fingerprint (0x10...)
        If NO → Continue to Step 2

Step 2: alice is still Phantom
        Return: No 0x10 primary ID yet
        Alternative: Return the 0x15 (Product) ID as a temporary reference
                     with a note that a 0x10 exists at <pointer> or is pending
```

### Implications for Critique 19

This "Subject-Only" requirement changes several aspects:

| Aspect | Impact |
|--------|--------|
| **Genesis Algorithm** | Must filter for Subject-only before selecting by Attestation order/fingerprint |
| **Phantom Handling** | External IDs (0x15, 0x18, etc.) can reference Phantom Entities; 0x10 cannot |
| **Alias Resolution** | May return NULL if entity is Phantom; external ID available as alternative |
| **Data Migration** | Existing Object-only mentions need explicit Subject-statements to become canonical |
| **Developer Pattern** | New pattern: "Declare-then-Reference" instead of "Discover-and-Consolidate" |

## Critical Integration: Genesis Statements and Alias Resolution (UPDATED)

The Statement-Anchored identity model fundamentally changes how **Alias Resolution** works in the FCP protocol.

### The Current Model (Pre-Critique 19)

**Current flow:**
```
User sees alias: "alice" (Twitter handle)
↓
Lookup in alias_resolution table
↓
Find primary UUID: "f1a2b3c4..."
↓
Construct 0x15 (Person identified by Product): 0x15f1a2b3c4...
↓
Query fcp_statements for all statements about this 0x15 ID
```

**Problem:** The primary UUID is arbitrary — it could be any UUID. Different systems might pick different UUIDs for the same person, causing identity fragmentation.

### The New Model (Post-Critique 19)

**New flow:**
```
User sees alias: "alice" (Twitter handle)
↓
Lookup in alias_resolution table
↓
Find primary entity fingerprint for protocol-native Person (0x10...)
↓
Reconstruct 0x10 (Person identified by Statement): 0x10...
↓
Query for all statements about this 0x10 ID
↓
Result: Full audit trail, not just "a list of claims"
```

**Note:** Since `0x10...` is derived by hashing the Genesis Statement ID (`0x00...`) string, you cannot invert `0x10 → 0x00` without additional data. Indexers SHOULD persist a pointer from the primary entity to its Genesis Statement ID (e.g., as a statement/edge or in materialized metadata) so that clients can inspect the exact genesis statement that created the identity anchor.

### What Constitutes a "Specific" (Genesis) Statement?

A Genesis Statement is the **founding statement** that anchors the entity's identity. It must satisfy these criteria:

1. **The entity is the SUBJECT** — Not an Object or other role (required for 0x10)
2. **It has a Statement ID (`0x00...`)** — content-addressed from canonical JSON of its S-P-O representation
3. **It is published/available** — it appears in registry history and/or an anchor log
4. **Among Subject-statements, it's earliest by the sequencing source (tie-break lexically)** — deterministically selected

**What qualifies as a Genesis Statement:**
- ✅ Type declaration: `alice → rdf:type → Person`
- ✅ Name assignment: `alice → schema:name → "Alice"`
- ✅ Self-reference: `alice → foaf:knows → bob` (alice declares a relationship)
- ✅ Any other Subject-statement where alice is the primary focus

**What does NOT qualify:**
- ❌ Employment relation: `acme → schema:employee → alice` (alice is Object)
- ❌ Mentions: `bob → foaf:knows → alice` (alice is Object)
- ❌ References in predicates or objects

The Genesis Statement enforces **"active declaration"**: the entity must be the Subject (primary focus) of the statement. Passive mentions by others don't create identity; explicit declarations do.

### Updating the Alias Resolution Algorithm

**Current behavior (Pre-Critique 19):**
```
alias_resolution table stores:
  alias_type: 1 (Person)
  alias_source_type: 5 (Product, e.g., Twitter)
  alias_fingerprint: hash("x.com/alice")
  resolved_identifier_fingerprint: UUID (arbitrary, e.g., "f1a2b3c4...")
```

**New behavior (Post-Critique 19):**
```
alias_resolution table stores:
  alias_type: 1 (Person)
  alias_source_type: 5 (Product, e.g., Twitter)
  alias_fingerprint: hash("x.com/alice")
  resolved_identifier_fingerprint: primary entity fingerprint (for 0x10..., derived from Genesis Statement ID)
```

**Key difference:**
- OLD: `resolved_identifier_fingerprint` = arbitrary UUID (disconnected from protocol)
- NEW: `resolved_identifier_fingerprint` = primary entity fingerprint for a protocol-native ID derived from a Genesis Statement ID (`0x00...`)

### The Deterministic Genesis Discovery Process (UPDATED)

When an indexer encounters a new alias (e.g., "x.com/alice"):

1. **Collect all statements** mentioning "alice" from all Attestations (any role)
2. **Filter Subject-only** — only statements where alice is Subject are Genesis candidates
3. **Order by sequencing source** — registry ordering and/or earliest trusted anchor inclusion
4. **If tied**: lexical sort by Statement fingerprint (38-char tail of the `0x00...` ID)
5. **Select Genesis Statement ID**: `0x00...`
6. **Compute Primary ID**: `0x10... = calculateFideId('Person','Statement','0x00...')`
7. **Store in alias_resolution**: `resolved_identifier_fingerprint = <0x10 fingerprint>`
8. **Persist pointer**: primary `0x10...` → genesis `0x00...` (so clients can inspect the genesis statement later)

### Impact on Documentation

| Document | Current Concept | Post-Critique 19 Concept |
|-----------|-----------------|-------------------------|
| `query.mdx` (Alias Resolution) | "Maps alias to random UUID primary" | "Maps alias to protocol-native primary (0x10...) derived from Genesis Statement ID (0x00...)" |
| `query.mdx` (Primary Pattern) | "Primary = arbitrary UUID" | "Primary = derived from Genesis Statement selected by sequencing policy" |
| `identifiers.mdx` (Part 2) | "Source 0 = UUID" | "Source 0 = Genesis Statement" |
| `entities.mdx` (Person) | "Person ID = random UUID" | "Person ID = derived from their Genesis Statement ID (0x00...)" |
| `schema.mdx` (Statement) | "Statements are facts" | "Statements are identity anchors (Genesis) or context (others)" |

### The Business Logic: "Genesis Statement" as Primary Anchor

For non-technical stakeholders:

- **The Alias Resolution** is no longer a lookup table for random IDs
- **It becomes a pointer to the entity's "Birth Record"** in the Fide Context Graph
- **Every alias (Twitter, Wallet, etc.) points to the same Genesis Statement**
- **That Genesis Statement is the "Single Source of Truth"** for the entity's identity
- **Different systems all independently discover the same Genesis Statement** (deterministic math)
- **Result**: True distributed identity without coordination

### Example: Alice's Multi-Platform Identity

Alice has three aliases:
- Twitter: `x.com/alice`
- Wallet: `0xAlice123...`
- Email: `https://x.com/alice`

**Current behavior:**
```
alias_resolution:
  x.com/alice → primary_uuid_1
  0xAlice123 → primary_uuid_2 (different!)
  https://x.com/alice → primary_uuid_3 (different!)

Result: Alice has 3 different primary IDs across the system (fragmented identity)
```

**Post-Critique 19 behavior:**
```
alias_resolution:
  x.com/alice → genesis_statement_fingerprint_abc123
  0xAlice123 → genesis_statement_fingerprint_abc123 (same!)
  https://x.com/alice → genesis_statement_fingerprint_abc123 (same!)

Result: All three aliases point to the same Genesis Statement
        (consolidated, verifiable identity)
```

The Genesis Statement is whatever statement first introduced Alice to the protocol (likely a type declaration or self-introduction). All three aliases resolve to it deterministically.

## Implementation Status & Next Steps

### Code Changes Needed

**Phase 1: Type System Updates** (Current status: IN PROGRESS)
- ✅ Updated `lib/fcp/fide-id.ts`: SOURCE_TYPE_MAP
- ✅ Updated `scripts/supabase/manual-migrations/fcp-tables-supabase.sql`: Enum comment
- ✅ Updated `content/docs/fcp/identifiers.mdx`: ID_MAP examples
- ⏳ Fix ~20 TypeScript compilation errors (all `'UUID'` → `'Statement'`)
  - `app/(app)/(marketing)/(fcp)/fcp-playground/components/json-claim-editor.tsx` (11 instances)
  - `lib/fcp/attestation-helpers.ts` (2 instances)
  - `lib/fcp/broadcast/batch-signer.ts` (1 instance)
  - `lib/fcp/indexer/materialize.ts` (1 instance)
  - `scripts/fcp/seed-test-claims.ts` (5 instances)

**Phase 2: Documentation Enhancement** (Planned)
- Update `identifiers.mdx` with Genesis Statement algorithm
- Update entity pages in `entities.mdx`
- Add visual decision tree to schema documentation
- Create "Genesis Statement" callout for developers

**Phase 3: Genesis Statement Algorithm** (Design complete, implementation pending)
- Implement deterministic selection in indexer/materializer
- Add priority function: Declarative Subject > Other Subject > Declarative Object > Other Object
- Add lexical tiebreaker by fingerprint
- Test multi-party, multi-attestation coordination scenarios

**Phase 4: Verification**
- Update seed script to explicitly create Genesis Statements
- Add tests for tie-breaking scenarios
- Validate that different orderings produce identical IDs
- Performance testing: ensure lexical sorting doesn't bottleneck large batches

### Compilation Error Resolution Plan

The TypeScript compiler currently rejects `'UUID'` because `SOURCE_TYPE_MAP` no longer includes it. This is **expected and desired** — it forces us to find and update every reference.

The fix is mechanical: Search & replace all instances of `calculateFideId(..., 'UUID', ...)` with `calculateFideId(..., 'Statement', ...)`.

**Command to identify remaining instances:**
```bash
grep -r "calculateFideId.*'UUID'" --include="*.ts" --include="*.tsx" .
```

## Conclusion: The "Subject-Only" Architectural Stance

Renaming "UUID" to "Statement" combined with enforcing **Subject-Only** Genesis Statements represents a mature architectural decision for distributed identity.

### What This Achieves

1. **Eliminates Ambiguity** — Identity requires explicit declaration, not passive discovery
2. **Semantic Purity** — Part 1 (entity type) is only set when entity is declared as Subject
3. **Data Hygiene** — Enforces "Declare-then-Reference" pattern, preventing identity fragmentation
4. **Deterministic Genesis Selection** — Subject-only + sequencing source + lexical tie-break yields stable Genesis IDs for indexers that share ordering policy
5. **Immutable Identity Anchors** — Once a Genesis Subject-statement is created, the 0x10 ID is permanent and queryable
6. **Built-in Audit Trail** — Indexers can persist and expose a pointer from the primary entity ID to its Genesis Statement ID (`0x00...`) for inspection/auditing
7. **No Vendor Lock-in** — Identity lives in FCP, not external platforms or databases
8. **Phantom Handling** — Entities referenced before birth exist in context but not as canonical identities

### The Model

```
Passive Mention (Object):           Active Declaration (Subject):
  "Acme employs Alice"          →   "Alice is a Person"
  Alice is a Phantom                Alice is born (0x10)
  No 0x10 ID                        Genesis Statement ID (0x00...) → derive 0x10 from it
  Referenced via 0x15/0x18          Canonical identity anchor
```

### Why "Subject-Only" is Defensible

- **Aligns with Fide ID semantics**: "Person identified by Statement" means a statement where Person is Subject
- **Prevents identity chaos**: Without this rule, a random mention by anyone could become the Genesis Statement
- **Enables federation**: Different systems seeing same statements will compute same Genesis Statement (Subject-only guarantees this)
- **Separates concerns**: Relationships (Object) are context; identity (Subject) is foundational
- **Matches real-world patterns**: Birth certificates declare you as Subject; mentions are context

### The Promise

This is the **Structural Math** model at its finest:

**Identity ← Genesis Subject-Statement ← Fide Context Graph ← Immutable, Deterministic Truth**

Every entity becomes a durable protocol reference rooted in an immutable Genesis Statement ID (`0x00...`) where it is the Subject, and a protocol-native entity ID (`0x10...`) derived from that Genesis Statement ID. Indexers converge when they share the same sequencing source (registry ordering and/or trusted anchors); lexical sort provides a deterministic tie-break within a sequencing window.

**"No Declaration, No Passport"** — Entities are only official protocol citizens when someone (including themselves) makes a deliberate Subject-statement about them.
