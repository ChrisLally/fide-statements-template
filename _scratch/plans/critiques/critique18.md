# FCP Type System Enums (Critique #18)

**Date**: 2026-02-01
**Status**: ✅ Implemented - Supabase enums + Pure Graph Architecture
**Related Files**:
- `/scripts/supabase/manual-migrations/fcp-tables-supabase.sql` - Supabase enum type definitions
- `/lib/fcp/indexer/materialize.ts` - PROV-O implementation + predicate type logic
- `/scripts/supabase/manual-migrations/fcp-views-supabase.sql` - fcp_attestations view (no fcp_claims)
- `/scripts/supabase/manual-migrations/fcp-materialized-views-supabase.sql` - Resolved statements view
- Critique #13 - PROV-O Triangle and predicate typing

---

## Executive Summary

This critique documents the FCP character-based type encoding system standardized through **Supabase PostgreSQL enum types**, enabling database-level type safety and code generation to TypeScript.

**Three primary Supabase enums** (defined in fcp-tables-supabase.sql):
1. **fcp_entity_type** - First hex digit of Fide ID (entity semantic category: 1-8, e, a)
2. **fcp_source_identifier_type** - Second hex digit of Fide ID (identifier source: 0-8, a)
3. **fcp_statement_predicate_type** - Predicate semantic category (fact '6' vs evaluation 'e')

These enums are generated into TypeScript types via `pnpm supabase gen types typescript`, enabling type-safe queries without manual enum definitions.

---

## 1. Entity Type Encoding (Type Byte)

### Definition

First hex digit of a Fide ID encodes the semantic category of an entity.

```
Fide ID Format: 0x [TYPE] [SOURCE] [FINGERPRINT]
                    ↑
                    Entity Type (1 hex digit)
```

### Type Values

| Hex | Meaning | Schema.org/Spec | FIDE Extension | Example |
|-----|---------|---|---|---------|
| `1` | Person | foaf:Person | — | Alice, Bob |
| `2` | Organization | schema:Organization | — | ACME Corp |
| `3` | Place | schema:Place | — | New York City |
| `4` | Event | schema:Event | — | Conference 2024 |
| `5` | Product | schema:Product | — | Widget Pro |
| `6` | CreativeWork | schema:CreativeWork | — | "schema:name", predicates, statements |
| `7` | AutonomousAgent | — | ✓ | ChatGPT, Validator Bot |
| `8` | CryptographicAccount | — | ✓ | 0xabc123... |
| `e` | EvaluationMethod | — | ✓ | Fide-ClaimAccuracy-v1 |
| `a` | Attestation | — | ✓ | Merkle root batch |

### Examples

```
0x10xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = Person (type 1) identified by UUID (source 0)
0x18xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = Person (type 1) identified by CryptographicAccount (source 8)
0x22xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = Organization (type 2) identified by URL (source 2)
0x32xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = Place (type 3) identified by URL (source 2)
0x43xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = Event (type 4) identified by Handle (source 3)
0x50xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = Product (type 5) identified by UUID (source 0)
0x66xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = CreativeWork (type 6) stored as CreativeWork (source 6)
0xe6xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = EvaluationMethod (type e) stored as CreativeWork (source 6)
0x88xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = CryptographicAccount (type 8) identified by CryptographicAccount (source 8)
0xa0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx = Attestation (type a) identified by UUID (source 0)
```

---

## 2. Source Identifier Type Encoding (Source Byte)

### Definition

Second hex digit of a Fide ID encodes HOW an entity is identified (what type of identifier).

Defined as **Supabase enum type `fcp_source_identifier_type`** in SQL:
```sql
CREATE TYPE fcp_source_identifier_type AS ENUM ('0','1','2','3','4','5','6','7','8','a');
```

```
Fide ID Format: 0x [TYPE] [SOURCE] [FINGERPRINT]
                         ↑
                         Source Identifier Type (1 hex digit)
```

### Source Values

| Hex | Meaning | Format Example | Use Case |
|-----|---------|---|---|
| `0` | UUID | RFC 4122 (550e8400-e29b-41d4-a716-...) | Primary identifier for new entities |
| `1` | Email | RFC 5322 (https://x.com/alice) | Person/Organization contact |
| `2` | URL | RFC 3986 (https://example.com/alice) | Web-based identity |
| `3` | Social Handle | @alice, #tag | Twitter, GitHub, Discord |
| `4` | Phone | E.164 (https://x.com/alice) | Telecom identity |
| `5` | Domain | DNS (example.com) | Organization identifier |
| `6` | CreativeWork | Predicate string (schema:name, fide:controls) | Predicates, statements |
| `7` | EvaluationMethod | Method identifier (Fide-ClaimAccuracy-v1) | Evaluation predicates |
| `8` | CryptographicAccount | Blockchain address (0xabc123...) | Chain-agnostic identity |
| `a` | Attestation | Merkle commitment hash | Batch/Attestation entity |

### Context Dependency

Source type meaning varies by entity type:

**For entities**: Describes the identifier used to identify the entity
```
0x18... = Person identified by their CryptographicAccount (blockchain address)
0x22... = Organization identified by a URL (website)
0x81... = CryptographicAccount identified by an email
```

**For predicates**: Typically uses source 6 (CreativeWork) or 7 (EvaluationMethod)
```
0x66... = Predicate "schema:name" as CreativeWork
0xe7... = Predicate "Fide-ClaimAccuracy-v1" as EvaluationMethod
```

**For attestations**: Uses source 0 (UUID)
```
0xa0... = Attestation identified by merkleRoot UUID
```

---

## 3. Statement Predicate Type Encoding

### Definition

**Single-character predicate semantic classification** stored in `fcp_statements.predicate_type`.

Defined as **Supabase enum type `fcp_statement_predicate_type`** in SQL:
```sql
CREATE TYPE fcp_statement_predicate_type AS ENUM ('6', 'e');
```

Enables **zero-lookup reputation queries**: instantly filter all evaluations without scanning relationship rows.

### Type Values

| Hex | Meaning | Examples | Use Case |
|-----|---------|----------|----------|
| `6` | Fact/Relationship | schema:name, fide:controls, owl:sameAs, prov:wasGeneratedBy | Objective statements |
| `e` | Evaluation/Opinion | Fide-ClaimAccuracy-v1, Fide-FactCheck-v1, schema:rating | Subjective judgments |

### Zero-Lookup Query Pattern

```sql
-- Get all reputation scores for Alice (no table scan needed)
SELECT * FROM fcp_statements
WHERE subject_fingerprint = 'alice_fp'
  AND predicate_type = 'e'  -- Indexed, instant filter
ORDER BY created_at DESC
```

### Predicate-Type Mapping

**Built-in mappings** (in `PREDICATE_TYPE_MAP`):

```typescript
// Facts/Relationships (type '6')
'schema:name' → '6'
'fide:controls' → '6'
'owl:sameAs' → '6'
'prov:wasGeneratedBy' → '6'
'prov:wasAssociatedWith' → '6'
'did:controller' → '6'

// Evaluations/Opinions (type 'e')
'Fide-StatementAccuracy-v1' → 'e'
'Fide-FactCheck-v1' → 'e'
'Fide-ClaimAccuracy-v1' → 'e'
```

### Fallback Rules

For unknown predicates, `getPredicateType()` applies:

1. **Check predicate map** (constant-time O(1))
2. **Prefix match**: If starts with `Fide-` → evaluation (`e`)
3. **Default**: Assume fact (`6`)

---

## 4. Predicate Source Type Relationship

**Source type depends on predicate type**:

| Predicate Type | Source Type | Enum | Meaning |
|---|---|---|---|
| `6` (Fact) | `6` | `CREATIVE_WORK` | Predicate is a CreativeWork predicate identifier |
| `e` (Evaluation) | `7` | `EVALUATION_METHOD` | Predicate is an EvaluationMethod |

### Helper Function

```typescript
// Simple function (no enums needed - just string literals)
function getPredicateSourceType(predicateType: '6' | 'e'): '6' | '7' {
  if (predicateType === 'e') {  // Evaluation
    return '7';  // EvaluationMethod source
  }
  return '6';  // CreativeWork source
}
```

---

## 5. Implementation: Supabase Enums + Generated Types

### Schema Definition (fcp-tables-supabase.sql)

```sql
CREATE TYPE fcp_entity_type AS ENUM ('1', '2', '3', '4', '5', '6', '7', '8', 'e', 'a');
CREATE TYPE fcp_source_identifier_type AS ENUM ('0', '1', '2', '3', '4', '5', '6', '7', '8', 'a');
CREATE TYPE fcp_statement_predicate_type AS ENUM ('6', 'e');

CREATE TABLE fcp_statements (
  -- ...
  predicate_type fcp_statement_predicate_type,        -- '6' or 'e'
  predicate_source_type fcp_source_identifier_type,   -- '6' or '7'
  -- ...
);
```

### Generated TypeScript Types

```bash
pnpm supabase gen types typescript --project-id <PROJECT_ID>
```

Result: `types/supabase.ts` automatically includes:
```typescript
export type Database = {
  public: {
    Enums: {
      fcp_entity_type: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | 'e' | 'a';
      fcp_source_identifier_type: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | 'a';
      fcp_statement_predicate_type: '6' | 'e';
    };
  };
};
```

### Implementation in materialize.ts

```typescript
// Helper functions (no external imports needed)
function getPredicateType(predicateIdentifier: string): '6' | 'e' {
  if (predicateIdentifier.startsWith('Fide-')) {
    return 'e';
  }
  return '6';
}

// Direct string literals (type-safe via database constraints)
statementsToInsert.push({
  statement_fingerprint: statementFingerprint,
  predicate_type: getPredicateType(predicateRawIdentifier),  // '6' | 'e'
  predicate_source_type: sourceType,                         // '6' | '7'
  // ... other fields
});
```

### Benefits

1. **Database-Level Type Safety**: PostgreSQL enforces valid enum values
2. **Code Generation**: TypeScript types auto-generated from database schema
3. **No Manual Sync**: Type definitions always match database enums
4. **Type Checking**: TypeScript compiler validates query parameters
5. **IDE Support**: Auto-complete from generated types
6. **Single Source of Truth**: Enums defined once in SQL, used everywhere

---

## 6. Database Schema Integration

### Column Definitions

```sql
-- fcp_statements table (created with enum types)
CREATE TABLE fcp_statements (
    statement_fingerprint CHAR(38) PRIMARY KEY,
    subject_type fcp_entity_type NOT NULL,
    subject_source_type fcp_source_identifier_type NOT NULL,
    subject_fingerprint CHAR(38) NOT NULL,
    predicate_fingerprint CHAR(38) NOT NULL,
    predicate_type fcp_statement_predicate_type,           -- '6' for facts, 'e' for evaluations
    predicate_source_type fcp_source_identifier_type,      -- '6' for CreativeWork, '7' for EvaluationMethod
    object_type fcp_entity_type NOT NULL,
    object_source_type fcp_source_identifier_type NOT NULL,
    object_fingerprint CHAR(38) NOT NULL
);
```

### Indexes for Zero-Lookup Queries

```sql
-- Get all evaluations for an entity
CREATE INDEX idx_statements_evaluations_by_subject
ON fcp_statements(subject_fingerprint, predicate_type)
WHERE predicate_type = 'e';

-- Discover all PROV-O relationships
CREATE INDEX idx_statements_prov_generated_by
ON fcp_statements(predicate_fingerprint)
WHERE predicate_type = '6' AND predicate_source_type = '6';
```

### Query Patterns

```sql
-- Pattern 1: Get all reputation scores for Alice (zero-lookup)
SELECT * FROM fcp_statements
WHERE subject_fingerprint = 'alice_fp'
  AND predicate_type = 'e'
ORDER BY created_at DESC;

-- Pattern 2: Get all facts about Alice
SELECT * FROM fcp_statements
WHERE subject_fingerprint = 'alice_fp'
  AND predicate_type = '6';

-- Pattern 3: Discover who controls Alice's account (did:controller)
SELECT object_fingerprint FROM fcp_statements
WHERE subject_fingerprint = 'account_fp'
  AND predicate_raw_identifier = 'did:controller';
```

---

## 7. Type Safety Roadmap

### Phase 1: Enums (Current)
✅ Create enum definitions
✅ Document type system
✅ Add predicate mapping table

### Phase 2: Implementation
☐ Update `materialize.ts` to use enums
☐ Update `verify.ts` to use enums
☐ Update `batch-signer.ts` to use enums
☐ Generate database types with enums

### Phase 3: Validation
☐ Add type guards for Fide ID parsing
☐ Add validation constraints in services
☐ Add CLI tools for type introspection

### Phase 4: Documentation
☐ Update API documentation
☐ Add type reference guide
☐ Add migration guide for existing code

---

## 8. Working with Generated Types

### Type Generation

After creating SQL enums, generate TypeScript types:

```bash
pnpm supabase gen types typescript --project-id <PROJECT_ID>
```

This creates `types/supabase.ts` with:

```typescript
export type Database = {
  public: {
    Enums: {
      fcp_entity_type: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | 'e' | 'a';
      fcp_source_identifier_type: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | 'a';
      fcp_statement_predicate_type: '6' | 'e';
    };
    Tables: {
      fcp_statements: {
        Row: {
          predicate_type: Database['public']['Enums']['fcp_statement_predicate_type'] | null;
          predicate_source_type: Database['public']['Enums']['fcp_source_identifier_type'] | null;
          // ... other fields
        };
      };
    };
  };
};
```

### Type-Safe Operations

```typescript
import type { Database } from '@/types/supabase';

// Type-safe: TypeScript ensures valid enum values
const statementType: Database['public']['Enums']['fcp_entity_type'] = '1'; // ✅ Valid
const invalidType: Database['public']['Enums']['fcp_entity_type'] = 'x'; // ❌ Compile error

// In queries/inserts, values are automatically validated by TypeScript
const { data, error } = await supabase
  .from('fcp_statements')
  .insert({
    predicate_type: '6', // ✅ TypeScript knows '6' | 'e' are valid
    subject_type: '1',   // ✅ TypeScript validates against all entity types
  });
```

---

## 9. Summary Table

| Aspect | Type | Values | Location | Purpose |
|--------|------|--------|----------|---------|
| **Entity Type** | First hex digit | 1,2,3,4,5,6,7,8,e,a | Fide ID format | Semantic category (Person, Org, Place, Event, Product, CreativeWork, Agent, Account, EvaluationMethod, Attestation) |
| **Source Type** | Second hex digit | 0-8,a | Fide ID format | Identifier source (UUID, Email, URL, Handle, Phone, Domain, CreativeWork, EvaluationMethod, CryptographicAccount, Attestation) |
| **Predicate Type** | Single char | 6,e | fcp_statements column | Fact vs Evaluation (enables zero-lookup reputation queries) |

---

## 10. Related Files

- **Definition**: `/lib/fcp/types/fcp-enums.ts`
- **Implementation**: `/lib/fcp/indexer/materialize.ts` (in progress)
- **Database**: `/scripts/supabase/manual-migrations/add_predicate_type_to_fcp_statements.sql`
- **Schema**: Critique #13 (PROV-O Triangle and predicate typing)
- **Broadcast**: `/lib/fcp/broadcast/batch-signer.ts`
- **Verification**: `/lib/fcp/indexer/verify.ts`

---

## 10.5. The fcp_attestations View: Developer Ergonomics

**Decision**: Keep `fcp_attestations` view for developer ergonomics, but rewrite to use PROV-O chain.

**What it provides**:
- Parses JSON attestation pre-image (`{"m":"eip712","u":"eip155:1:0x...","r":"0x...","s":"0x..."}`)
- Splits CAIP-10 into readable columns: `chain_namespace`, `chain_reference`, `signer_address`
- Bridges "Crypto World" (JSON) to "Graph World" (fingerprints via signer join)

**Old Implementation** (used fcp_claims table):
```sql
SELECT c.attestation_fingerprint, c.signer_address_fingerprint, ...
FROM fcp_claims c
JOIN fcp_raw_identifiers i ON ...
```

**New Implementation** (uses PROV-O chain):
```sql
SELECT i_attestation.identifier_fingerprint, s_signer.object_fingerprint, ...
FROM fcp_raw_identifiers i_attestation
JOIN fcp_statements s_signer  -- Attestation → wasAssociatedWith → Signer
  ON s_signer.subject_fingerprint = i_attestation.identifier_fingerprint
  AND s_signer.predicate_type = '6'
WHERE i_attestation.raw_identifier LIKE '{"m":%'
```

**Why Keep It?**
- Writing `split_part(...::jsonb ->> 'u', ':', 1)` in every query is tedious
- View standardizes the pattern (chain extraction, crypto parsing)
- Single `SELECT * FROM fcp_attestations` beats a 20-line query
- Verdict: **Keep for developer ergonomics** ✅

---

## 11. The fcp_claims Table Removal Decision

**Decision**: Remove `fcp_claims` table entirely.

**Reasoning**: In the Unified Statement Model, the attestation→statement link IS itself a statement:
- **Subject**: Statement fingerprint (the fact)
- **Predicate**: `prov:wasGeneratedBy` (type '6')
- **Object**: Attestation fingerprint (the batch)

This `wasGeneratedBy` statement replaces the `fcp_claims` table row completely.

**Benefits**:
1. **Pure Graph Architecture**: Only 3 tables (identifiers, statements, aliases)
2. **No Denormalization**: No need for `signer_address_fingerprint` or subject denormalization
3. **Standard PROV-O**: Graph-native representation of provenance
4. **Simpler Queries**: Traverse the graph directly instead of multiple table joins

**Query Pattern** (replaces fcp_claims):
```sql
-- Find all statements about Alice (traverses PROV-O chain)
SELECT s.* FROM fcp_statements s
JOIN fcp_statements link ON link.subject_fingerprint = s.statement_fingerprint
WHERE link.predicate_fingerprint = 'prov:wasGeneratedBy'
  AND s.subject_fingerprint = 'alice_fingerprint'
```

---

## 12. Implementation Completion Checklist

✅ **Phase 1: Type System Enums**
1. ✅ Supabase enum types created in fcp-tables-supabase.sql
2. ✅ All 10 entity types (1-8, e, a) included
3. ✅ All 10 source types (0-8, a) included
4. ✅ Predicate types (6, e) defined
5. ✅ Indexes added for zero-lookup queries

✅ **Phase 2: Pure Graph Architecture**
1. ✅ fcp_claims table removed completely
2. ✅ PROV-O Triangle statements implemented:
   - Statement → `prov:wasGeneratedBy` → Attestation (per content statement)
   - Attestation → `prov:wasAssociatedWith` → Signer (once per batch)
3. ✅ DID:controller statements implemented (W3C DID Core standard)
4. ✅ predicate_type and predicate_source_type columns added to fcp_statements
5. ✅ fcp_attestations view rewritten (uses PROV-O chain instead of fcp_claims)
6. ✅ Materialized view updated with new columns
7. ✅ Schema comments updated to reflect pure graph model

⏳ **Phase 3: Code Generation & Testing**
1. **Generate Supabase types**: `pnpm supabase gen types typescript`
   - Pick up new enum types
   - Update fcp_statements table type
   - Remove fcp_claims references

2. **Update service layer** (fcp-statements-service.ts, etc.):
   - Query evaluations via PROV-O chain if needed
   - Use new predicate_type indexes for performance
   - Generate proper types from generated enums

3. **Update reset script** (reset-rcp.ts):
   - Remove fcp_claims table clearing
   - Verify only 3 tables remain

4. **Run full test cycle**: `pnpm fcp:rsi`
   - Validate all statements materialize correctly
   - Check PROV-O chain integrity
   - Verify enum values accepted by database

---

**Status**: ✅ Schema & Architecture Complete | ⏳ Code Generation & Testing Remaining

---

## 13. Materialized View Deduplication Strategy

**Decision**: Do NOT deduplicate in the materialized view. Handle deduplication at query time in the service layer.

### Why Not Deduplicate in the View?

1. **Broken Pointer Problem**: Statements are often subjects of other statements (Attestations, Disputes, Verifications). If we deduplicate and remove original `statement_fingerprint` values, these references break.

2. **Performance**: Deduplication requires `DISTINCT ON` or `GROUP BY`, which forces sorting the entire table on every refresh. With millions of rows, this degrades refresh performance from O(N) to O(N log N).

3. **Provenance Preservation**: The materialized view's purpose is to pre-resolve identifiers, not compress state. We need to preserve the "Physical Graph" (what actually exists) so Attestations don't break.

### Query-Time Deduplication

**Implementation**: Deduplicate in `getStatementsForEntity()` service function when querying the materialized view.

**Approach**:
- Use a Map keyed by resolved `subject_fingerprint + predicate_fingerprint + object_fingerprint`
- Keep the first occurrence (preserves original `statement_fingerprint` for provenance)
- This handles cases where the same semantic statement was created with different subject aliases that resolve to the same primary

**Example**:
```typescript
// Deduplicate by resolved S-P-O fingerprints
const dedupeMap = new Map<string, Statement>();
for (const stmt of data) {
  const canonicalKey = `${stmt.subject_fingerprint}:${stmt.predicate_fingerprint}:${stmt.object_fingerprint || ''}`;
  if (!dedupeMap.has(canonicalKey)) {
    dedupeMap.set(canonicalKey, stmt);
  }
}
const deduplicatedData = Array.from(dedupeMap.values());
```

**Benefits**:
- Preserves all original statement fingerprints for provenance queries
- Fast query-time deduplication (O(N) with Map lookup)
- No impact on materialized view refresh performance
- Handles semantic duplicates (same attribute/relationship created with different aliases)

**When to Deduplicate**:
- Entity profile pages (show unique attributes/relationships)
- Aggregation queries (count unique statements)
- Display queries (avoid showing duplicate attributes)

**When NOT to Deduplicate**:
- Provenance queries (need all original statement fingerprints)
- Attestation queries (need to link to specific statement IDs)
- Audit trails (need complete history)
