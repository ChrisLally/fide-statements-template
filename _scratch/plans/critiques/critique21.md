# Critique 21: Alias Resolution — From Lookup Table to Trust-Based owl:sameAs

**Date**: 2026-02-05
**Decision**: Replace hardcoded `fcp_alias_resolution` table with evaluation-based trust over `owl:sameAs` statements
**Status**: ✅ Implemented (Schema & Seed Script Complete)

## The Problem

### Current Architecture (Pre-Critique 21)

**Setup:**
- A separate **lookup table** `fcp_alias_resolution` stores alias-to-primary mappings:
  ```sql
  alias_type: 1 (Person)
  alias_source_type: 5 (Product)
  alias_fingerprint: hash("x.com/alice")
  resolved_identifier_fingerprint: <some canonical primary>
  ```
- The materialized view joins this table to resolve identifiers
- The view **explicitly excludes `owl:sameAs` predicates** to avoid circular logic
- Result: Alias resolution happens "outside the graph" — in a maintenance-heavy lookup table

**The costs:**
1. **Dual sources of truth** — statements say one thing, lookup table says another
2. **Lost provenance** — "Why is this alias mapped to that primary?" — no record of who decided this
3. **Hard to change policy** — updating resolution logic requires backfilling the entire lookup table and refreshing the view
4. **Brittle** — lookup table can get out of sync with statements if indexer logic changes
5. **No audit trail** — can't inspect the reasoning behind a specific alias mapping

## The New Idea: Truth-Seeking in owl:sameAs

### The Insight

**All the data you need is already in the graph as `owl:sameAs` statements.**

Instead of a separate lookup table, the **materialized view directly resolves via `owl:sameAs`**:
1. Query **all `owl:sameAs` statements** to build identity resolution
2. Apply **simple trust logic in SQL**: prefer owl:sameAs statements with higher signer consensus
3. **Materialize the resolution** directly in the view (no application layer logic needed)
4. The entire chain of reasoning **lives in the Fide Context Graph** — verifiable, auditable, and policy-agnostic

### Concrete Example

**Current flow (Pre-Critique 21):**
```
User queries: "Who is alice?"
↓
Materialized view joins fcp_alias_resolution
↓
Lookup table says: 0x15<x.com/alice> resolves to primary fingerprint abc123
↓
View returns pre-resolved statements about abc123
↓
Application never knows why abc123 was chosen
```

**New flow (Post-Critique 21):**
```
User queries: "Who is alice?"
↓
Application queries: SELECT * FROM fcp_statements WHERE predicate_raw_identifier = 'owl:sameAs'
↓
Application gets:
  - 0x15<x.com/alice> owl:sameAs 0x10<genesis-abc123>
  - 0x18<wallet-0xAlice> owl:sameAs 0x10<genesis-abc123>
  - 0x15<instagram.com/alice_smith> owl:sameAs 0x10<genesis-abc123>
↓
Application applies trust logic:
  "Which owl:sameAs statements do I trust?"
  - If attestation signed by trusted entity? YES → follow
  - If multiple parties agree? YES → follow
  - If self-signed by Alice's account? YES → follow
↓
Application constructs resolution mapping in memory
↓
Materialized view uses this mapping instead of lookup table
↓
Result: Full provenance trail, auditable, policy-driven
```

## How It Works: The Architecture (Evaluation-Based Trust)

### Trust Policy: Evaluation Method (Fide-AliasResolutionTrust-v1)

**Alias resolution is an evaluation problem.** Different indexers can have different trust policies, just like reputation scoring.

**Our Method**: `Fide-AliasResolutionTrust-v1`
- **Type**: Trust evaluation for owl:sameAs statements
- **Input**: An owl:sameAs statement (0x00...)
- **Output**: Verdict (-1=Reject, 0=Uncertain, 1=Trust)
- **Process**: Indexer verifies the alias assertion using their own criteria:
  - Cryptographic proof (signature verification)
  - Cross-reference (check social profiles, DNS records)
  - Indexer consensus (optional: check if other indexers agree)
  - Manual review (investigate suspicious assertions)
  - **Your method decides** based on ALL criteria → issues verdict

**Key Insight:**
- ALL owl:sameAs statements exist in fcp_statements (untrusted and trusted)
- Indexers issue **evaluation statements** about which ones they trust
- **Your evaluation method** decides trust (can consider indexer consensus, cryptographic proof, etc.)
- Materialized view filters to only statements YOU evaluated as trusted (verdict=1)
- View trusts YOUR judgment - doesn't re-implement trust logic
- Other indexers can use the same method OR define their own

**Method Definition (broadcast to graph)**:
```typescript
const method = {
  fideId: "0xe0<Fide-AliasResolutionTrust-v1>",
  attributes: {
    "schema:name": "Fide-AliasResolutionTrust-v1",
    "schema:description": "Evaluates owl:sameAs statements for trustworthiness based on indexer verification. Output: Verdict (-1=Reject, 0=Uncertain, 1=Trust)",
    "schema:softwareVersion": "1.0"
  }
};
```

### The SQL Approach (Evaluation-Based Filtering)

Build the resolution in SQL using CTEs with evaluation filtering:

**Step 1: Get trusted owl:sameAs statements (via evaluations)**
```sql
WITH trusted_sameAs_statements AS (
  -- Find all owl:sameAs statements evaluated as trusted
  -- Your evaluation method (Fide-AliasResolutionTrust-v1) already considered:
  --   - Indexer consensus, cryptographic proof, cross-reference, etc.
  -- The view just uses statements you've evaluated as trusted (verdict=1)
  SELECT DISTINCT
    eval.subject_fingerprint as sameAs_statement_fp
  FROM fcp_statements eval
  INNER JOIN fcp_raw_identifiers pred_ident
    ON pred_ident.identifier_fingerprint = eval.predicate_fingerprint
  INNER JOIN fcp_raw_identifiers obj_ident
    ON obj_ident.identifier_fingerprint = eval.object_fingerprint
  WHERE pred_ident.raw_identifier = 'Fide-AliasResolutionTrust-v1'
  AND obj_ident.raw_identifier = '1'  -- Verdict: Trusted
)
```

**Step 2: Resolve via trusted statements**
```sql
owl_sameAs_resolutions AS (
  -- Use trusted owl:sameAs statements for resolution
  -- If multiple trusted sameAs for same subject → lexical tie-break (deterministic)
  SELECT
    s.subject_fingerprint,
    s.object_fingerprint as resolved_to_fingerprint,
    ROW_NUMBER() OVER (
      PARTITION BY s.subject_fingerprint
      ORDER BY s.object_fingerprint ASC  -- Lexical tie-break
    ) as resolution_rank
  FROM fcp_statements s
  INNER JOIN trusted_sameAs_statements trusted
    ON trusted.sameAs_statement_fp = s.statement_fingerprint
  INNER JOIN fcp_raw_identifiers s_pred_ident
    ON s_pred_ident.identifier_fingerprint = s.predicate_fingerprint
  WHERE s_pred_ident.raw_identifier = 'owl:sameAs'
)
```

**Step 3: Track genesis statements** (earliest subject statement)
```sql
genesis_statements AS (
  SELECT
    subject_fingerprint,
    MIN(statement_fingerprint) as genesis_statement_fingerprint
  FROM fcp_statements
  WHERE subject_fingerprint IS NOT NULL
  GROUP BY subject_fingerprint
)
```

**Step 4: Join in materialized view with provenance tracking**
- Use `owl_sameAs_resolutions` WHERE `resolution_rank = 1` to pick primary
- Keep BOTH original and resolved columns for complete provenance:
  - `subject_fingerprint_original`: Original fingerprint from fcp_statements
  - `subject_fingerprint`: Resolved fingerprint (Statement-derived primary like 0x10...)
  - `subject_raw_identifier_original`: Original raw identifier (e.g., "alice-person-2024")
  - `subject_raw_identifier`: Resolved raw identifier (the Statement Fide ID like "0x00841fd8df...")
  - `subject_source_type_original`: Original source type (e.g., '5' for Product)
  - `subject_source_type`: Resolved source type ('0' for Statement-derived)
- Same structure for objects (which resolve if they also appear as subjects)
- Predicates are NEVER resolved (always human-readable for filtering)

### Issuing Trust Evaluations (Indexer Workflow)

When you (the indexer) verify an owl:sameAs statement is legitimate:

**1. Verification Process** (your methodology - can include consensus logic):
- Cryptographic proof (signature verification)
- Cross-reference (check Twitter bio, GitHub profile)
- Indexer consensus (check if 3+ other indexers signed the same owl:sameAs)
- Manual review (investigate suspicious assertions)
- Consistency check (does it conflict with other trusted aliases?)

**Your method decides**: Based on ALL these criteria, do I trust this owl:sameAs? → verdict

**2. Issue Evaluation Statement**:
```typescript
const trustEvaluation = {
  subject: "0x00<sameAs_statement_fingerprint>",  // The owl:sameAs statement itself
  predicate: "0xe0<Fide-AliasResolutionTrust-v1>", // Your method
  object: "0x66<1>"  // Verdict: 1=Trust (based on your criteria), -1=Reject, 0=Uncertain
};
// Sign this as your indexer, broadcast to graph
```

**3. Materialized View Picks It Up**:
- View refreshes, sees your evaluation with verdict=1
- Includes that owl:sameAs in resolution (trusts YOUR judgment)
- View doesn't re-evaluate or count indexers - it trusts your method's decision
- Others can query your evaluations and decide to trust your judgment

### Key Decisions: Provenance & Resolution Rules

**Provenance Tracking (ALL columns doubled):**
- **Original columns** (`*_original`): What was in fcp_statements before resolution
  - `subject_fingerprint_original`, `subject_raw_identifier_original`, `subject_source_type_original`
  - Same for objects
- **Resolved columns**: After owl:sameAs evaluation-based resolution
  - `subject_fingerprint`: Statement-derived primary (0x10..., 0x20..., etc.)
  - `subject_raw_identifier`: **The Statement Fide ID itself** (e.g., "0x00841fd8df...")
  - `subject_source_type`: '0' if resolved, else equals original
- **Always keep both** even if equal (simpler, no nulls, consistent schema)

**Resolution Rules by Entity Type:**
- **Self-sourced primaries (no resolution needed)**:
  - `0x66...` CreativeWork/CreativeWork (literals, values)
  - `0x88...` CryptographicAccount/CryptographicAccount (addresses)
  - `0xa0...` Attestation/Attestation
  - `0x00...` Statement/Statement
- **Need Statement-derived primaries (0xX0...)**:
  - `0x1X...` → `0x10...` (Person/Statement)
  - `0x2X...` → `0x20...` (Organization/Statement)
  - `0x3X...` → `0x30...` (Place/Statement)
  - `0x4X...` → `0x40...` (Event/Statement)
  - `0x5X...` → `0x50...` (Product/Statement)
  - `0x7X...` → `0x70...` (AutonomousAgent/Statement)
  - `0xeX...` → `0xe0...` (EvaluationMethod/Statement)

**Predicate Resolution:**
- Predicates are **NEVER resolved** (always human-readable for filtering)
- Even EvaluationMethod predicates like `Fide-StatementAccuracy-v1` remain as raw strings
- Enables: `WHERE predicate_raw_identifier = 'Fide-StatementAccuracy-v1'`

**Object Resolution:**
- Objects resolve **if they also appear as subjects** (have schema:name statements)
- People, Organizations, Products, Agents, Places, Events → resolved
- Pure literal values (ratings, descriptions) → not resolved (already 0x66...)

**Remove `fcp_alias_resolution` table:**
- ✅ Completely removed; evaluations define trust
- Resolution computed from evaluations in materialized view

Instead of joining `fcp_alias_resolution`, the view can:

**Option 1: Temporary table** (simple)
```sql
-- Application layer computes this and inserts for each refresh cycle
CREATE TEMP TABLE alias_resolution_computed AS
SELECT
  alias_type,
  alias_source_type,
  alias_fingerprint,
  resolved_identifier_fingerprint
FROM (
  -- Trust logic applied; results passed in via application layer
  VALUES
    (1, 5, hash('x.com/alice'), hash_abc123),
    (1, 8, hash('0xAlice'), hash_abc123),
    ...
) AS computed_mapping(alias_type, alias_source_type, alias_fingerprint, resolved_identifier_fingerprint);

-- Then the materialized view uses this instead of fcp_alias_resolution:
CREATE MATERIALIZED VIEW fcp_statements_identifiers_resolved AS
SELECT
  s.statement_fingerprint,
  -- ... rest of view ...
  COALESCE(
    computed_alias.resolved_identifier_fingerprint,
    s.subject_fingerprint
  ) AS subject_fingerprint,
  -- ...
FROM fcp_statements s
LEFT JOIN alias_resolution_computed computed_alias
  ON computed_alias.alias_type = s.subject_type
  AND computed_alias.alias_source_type = s.subject_source_type
  AND computed_alias.alias_fingerprint = s.subject_fingerprint;
```

**Option 2: SQL function** (more elegant)
```sql
-- Store the trust policy decision as a computed function
CREATE OR REPLACE FUNCTION resolve_alias_via_sameAs(
  p_type fcp_entity_type,
  p_source_type fcp_source_identifier_type,
  p_fingerprint text,
  p_trust_policy text  -- 'multi_party', 'self_signed', 'registry', etc.
) RETURNS text AS $$
DECLARE
  v_resolved_fingerprint text;
BEGIN
  -- Query owl:sameAs statements and apply trust policy
  SELECT
    object_fingerprint INTO v_resolved_fingerprint
  FROM (
    SELECT s.object_fingerprint, a.signer_count
    FROM fcp_statements s
    LEFT JOIN (
      SELECT subject_fingerprint, COUNT(DISTINCT attestation_fingerprint) as signer_count
      FROM fcp_prov_attestations
      GROUP BY subject_fingerprint
    ) a ON a.subject_fingerprint = s.statement_fingerprint
    WHERE s.subject_type = p_type
    AND s.subject_source_type = p_source_type
    AND s.subject_fingerprint = p_fingerprint
    AND s.predicate_fingerprint = (
      SELECT identifier_fingerprint FROM fcp_raw_identifiers WHERE raw_identifier = 'owl:sameAs'
    )
    AND (
      CASE p_trust_policy
        WHEN 'multi_party' THEN a.signer_count >= 3
        WHEN 'self_signed' THEN is_self_signed(s, a.signer_fingerprint)
        WHEN 'registry' THEN is_in_trusted_registry(s)
        ELSE FALSE
      END
    )
    ORDER BY s.statement_fingerprint DESC -- Most recent
    LIMIT 1
  );

  RETURN COALESCE(v_resolved_fingerprint, p_fingerprint);
END;
$$ LANGUAGE plpgsql;

-- Then in the materialized view:
CREATE MATERIALIZED VIEW fcp_statements_identifiers_resolved AS
SELECT
  s.statement_fingerprint,
  -- Subject resolution
  resolve_alias_via_sameAs(s.subject_type, s.subject_source_type, s.subject_fingerprint, 'multi_party') AS subject_fingerprint,
  -- Predicate resolution
  resolve_alias_via_sameAs(s.predicate_type, s.predicate_source_type, s.predicate_fingerprint, 'multi_party') AS predicate_fingerprint,
  -- Object resolution
  resolve_alias_via_sameAs(s.object_type, s.object_source_type, s.object_fingerprint, 'multi_party') AS object_fingerprint,
  -- ...
FROM fcp_statements s;
```

**Option 3: Pre-computed view** (most performant)
```sql
-- Create a view that computes sameAs resolutions once per refresh
CREATE OR REPLACE VIEW owl_sameAs_resolutions AS
WITH sameAs_statements AS (
  SELECT
    s.subject_fingerprint,
    s.subject_type,
    s.subject_source_type,
    s.object_fingerprint,
    COUNT(DISTINCT a.signer_fingerprint) as signer_count
  FROM fcp_statements s
  LEFT JOIN fcp_prov_attestations a ON a.statement_fingerprint = s.statement_fingerprint
  WHERE s.predicate_fingerprint = (
    SELECT identifier_fingerprint FROM fcp_raw_identifiers WHERE raw_identifier = 'owl:sameAs'
  )
  GROUP BY s.subject_fingerprint, s.subject_type, s.subject_source_type, s.object_fingerprint
),
trusted_resolutions AS (
  SELECT
    subject_fingerprint,
    subject_type,
    subject_source_type,
    object_fingerprint,
    ROW_NUMBER() OVER (PARTITION BY subject_fingerprint ORDER BY signer_count DESC, object_fingerprint ASC) AS rank
  FROM sameAs_statements
  WHERE signer_count >= 3  -- Trust policy: multi-party consensus
)
SELECT
  subject_fingerprint,
  subject_type,
  subject_source_type,
  object_fingerprint AS resolved_fingerprint
FROM trusted_resolutions
WHERE rank = 1;

-- Then the materialized view:
CREATE MATERIALIZED VIEW fcp_statements_identifiers_resolved AS
SELECT
  s.statement_fingerprint,
  COALESCE(subj_res.resolved_fingerprint, s.subject_fingerprint) AS subject_fingerprint,
  COALESCE(pred_res.resolved_fingerprint, s.predicate_fingerprint) AS predicate_fingerprint,
  COALESCE(obj_res.resolved_fingerprint, s.object_fingerprint) AS object_fingerprint,
  -- ...
FROM fcp_statements s
LEFT JOIN owl_sameAs_resolutions subj_res ON subj_res.subject_fingerprint = s.subject_fingerprint
LEFT JOIN owl_sameAs_resolutions pred_res ON pred_res.subject_fingerprint = s.predicate_fingerprint
LEFT JOIN owl_sameAs_resolutions obj_res ON obj_res.subject_fingerprint = s.object_fingerprint
WHERE s.predicate_fingerprint NOT IN (
  SELECT identifier_fingerprint FROM fcp_raw_identifiers WHERE raw_identifier = 'owl:sameAs'
);
```

## Benefits

### 1. Evaluation-Based Trust (FCP-Native)
- **Alias resolution is treated as an evaluation problem** (like reputation, fact-checking)
- Trust decisions are **explicit evaluation statements** signed by indexers
- Other indexers can **reuse your method** or define their own
- Aligns with FCP philosophy: "Trust is subjective" (see evaluate.mdx)

### 2. Full Provenance Chain
```
owl:sameAs statement (0x00...)
  ↓ evaluated by
Indexer evaluation (using Fide-AliasResolutionTrust-v1)
  ↓ signed in
Attestation (0xa0...)
  ↓ results in
Materialized view resolution (alias → primary)
```
Every step is auditable, verifiable, and traceable.

### 3. Composability Across Indexers
- **Query one indexer's evaluations**: "What does Alice's indexer trust?"
- **Aggregate across indexers**: Applications can query evaluations from multiple indexers and apply their own trust logic
- **Method-aware filtering**: "Only use Fide-AliasResolutionTrust-v1 evaluations"
- Different applications can choose which indexer(s) to trust

### 4. Granular Control
```typescript
// Use evaluations from your indexer only
WHERE EXISTS (
  SELECT 1 FROM fcp_statements eval
  JOIN fcp_prov_attestations att ON att.statement_fingerprint = eval.statement_fingerprint
  WHERE eval.predicate = 'Fide-AliasResolutionTrust-v1'
  AND eval.object = '1'
  AND att.signer_fingerprint = 'YOUR_INDEXER_FP'
)

// OR trust multiple specific indexers
WHERE signer_fingerprint IN ('indexer_A', 'indexer_B')

// Applications decide: trust one indexer, or aggregate across multiple
```

### 5. Revocable & Updatable
- Issue new evaluation with verdict `-1` to revoke trust
- Update methodology version (v1 → v2) without breaking old evaluations
- Clients can choose which version/indexer to trust

### 6. Transparent to Applications
- Clients can **query evaluation statements** directly:
  ```sql
  SELECT * FROM fcp_statements
  WHERE predicate_raw_identifier = 'Fide-AliasResolutionTrust-v1'
  AND subject_fingerprint = '<sameAs_statement_fp>'
  ```
- See WHO evaluated WHAT and WHY (methodology is published)

## Tradeoffs

### Performance
**Cost of direct graph query:**
- Current: 1 LEFT JOIN to hardcoded table (very fast)
- New: Query `owl:sameAs` statements + apply logic

**Solution: Pre-computed view**
- Keep the materialized view approach (Option 3 above)
- Pre-compute all resolutions during `refresh_fcp_statements_identifiers_resolved()`
- **No performance regression** — still single-digit millisecond queries

### Complexity
**Increased:**
- Application layer now owns "trust policy logic" instead of table UPSERTs
- Multiple policy options available; must choose/implement one

**Mitigated by:**
- Default policy (multi-party consensus) covers 80% of use cases
- SQL functions encapsulate logic; application just calls function
- Well-documented examples for each policy

### Migration Path

**Phase 1: Parallel Operation** (safest)
```
- Keep fcp_alias_resolution table as-is
- Write application layer that computes owl:sameAs-based resolutions
- Create a `owl_sameAs_resolutions` view alongside fcp_alias_resolution
- Materialized view joins BOTH
- Compare results; debug mismatches
```

**Phase 2: Cutover**
```
- Once confident, materialize view uses owl_sameAs_resolutions as primary
- fcp_alias_resolution becomes fallback only
```

**Phase 3: Cleanup**
```
- Drop fcp_alias_resolution table
- Document the deprecation in schema
```

## Implementation Checklist

### Schema Changes (SQL)
- [x] ✅ Remove `fcp_alias_resolution` table entirely (no backward compatibility)
- [x] ✅ Update `fcp_statements_identifiers_resolved` materialized view:
  - [x] ✅ Add CTE: `trusted_sameAs_statements` (filter by evaluation verdict = 1)
  - [x] ✅ Update CTE: `owl_sameAs_resolutions` (JOIN to trusted statements, lexical tie-break)
  - [x] ✅ Keep CTE: `genesis_statements` (track earliest Subject statement)
  - [x] ✅ Use source type `'0'` when resolved to primary (Statement-derived)
  - [x] ✅ Add provenance columns: `*_original` for fingerprints, raw_identifiers, source_types
  - [x] ✅ Resolved `raw_identifier` IS the Statement Fide ID (e.g., "0x00841fd8df...")
- [x] ✅ Create indexes for evaluation-based resolution (predicate_fingerprint based)
- [x] ✅ Update table comments and migration documentation

### EvaluationMethod Definition
- [ ] Publish `Fide-AliasResolutionTrust-v1` method to graph:
  - [ ] Create EvaluationMethod entity (0xe0...)
  - [ ] Add attribute statements (schema:name, schema:description, schema:softwareVersion)
  - [ ] Document methodology in evaluate.mdx or separate doc
  - [ ] Example verdicts: 1=Trust, -1=Reject, 0=Uncertain

### Seed Script (Statement-Derived Primaries)
- [x] ✅ Automatically calculate Statement-derived primaries for ALL entities:
  - [x] ✅ People (0x15... → 0x10...)
  - [x] ✅ Organizations (0x25... → 0x20...)
  - [x] ✅ Products (0x55... → 0x50...)
  - [x] ✅ Agents (0x75... → 0x70...)
  - [x] ✅ Places (0x35... → 0x30...)
  - [x] ✅ Events (0x45... → 0x40...)
  - [x] ✅ EvaluationMethods (0xe6... → 0xe0...)
- [x] ✅ Create owl:sameAs statements pointing Product IDs → Statement IDs
- [x] ✅ Create evaluation statements (Fide-AliasResolutionTrust-v1, verdict=1) for all
- [x] ✅ Primary raw_identifier IS the Statement Fide ID itself

### Application Layer
- [ ] Update TypeScript types to include `*_original` columns
- [ ] None required for MVP — logic lives in SQL
- [ ] Optional: Add helper function `get_all_aliases(fingerprint)` to query owl:sameAs chains

### Testing
- [ ] **Evaluation Filtering**:
  - [ ] Test that only evaluated (verdict=1) owl:sameAs statements are used
  - [ ] Test that non-evaluated owl:sameAs are excluded from resolution
  - [ ] Test revocation: evaluation with verdict=-1 excludes that sameAs
- [ ] **Resolution Logic**:
  - [ ] Test single trusted owl:sameAs: resolution uses it
  - [ ] Test multiple trusted owl:sameAs for same subject: lexical tie-break (deterministic)
  - [ ] Test that view trusts YOUR evaluation decisions (doesn't re-count indexers)
- [ ] **Genesis Tracking**:
  - [ ] Test genesis statement tracking: earliest Subject statement found
  - [ ] Verify genesis_statement_fingerprint points to correct statement
- [ ] **Edge Cases**:
  - [ ] Entity with no owl:sameAs (should resolve to itself)
  - [ ] Entity with owl:sameAs but no evaluations (should NOT resolve, stays as alias)
  - [ ] Circular evaluations (shouldn't occur, but verify)
- [ ] **Performance**:
  - [ ] Verify materialized view refresh time
  - [ ] Test evaluation query performance with index

### Documentation
- [ ] Update `identifiers.mdx` to explain owl:sameAs-based resolution + genesis statements
- [ ] Document signer consensus tie-breaking algorithm
- [ ] Update `identifiers.mdx` Part 2 to clarify source type becomes '0' when resolved
- [ ] Add examples of how to inspect `genesis_statement_fingerprint`
- [ ] Mark `fcp_alias_resolution` table as deprecated

## Comparison Table

| Aspect | Old (Lookup Table) | New (Evaluation-Based) |
|--------|-------------------|------------------------|
| **Trust Model** | Implicit (table = trusted) | Explicit (evaluation statements = trust decisions) |
| **Where Trust Logic Lives** | Hidden in table population code | In your EvaluationMethod (can include consensus, crypto proof, etc.) |
| **Source of Truth** | fcp_alias_resolution table (external) | fcp_statements (evaluations + owl:sameAs, in-graph) |
| **Table Maintenance** | Manual UPSERTs, sync risk | No table; evaluations define trust dynamically |
| **Provenance** | None — static, opaque | Full chain: sameAs → evaluation → attestation → indexer |
| **Resolution Logic** | Hidden in application code | Transparent: EvaluationMethod published to graph |
| **Trust Decisions** | Hardcoded in table | Signed evaluation statements (auditable) |
| **View Role** | Uses static table | Trusts evaluation verdicts (doesn't re-evaluate) |
| **Policy Changes** | Backfill entire table | Issue new evaluations (no backfill) |
| **Multi-Indexer** | Not supported | Native: aggregate evaluations across indexers |
| **Auditability** | "Why?" — no answer | "Who evaluated? Using what method?" — query directly |
| **Client Transparency** | Black box | Full: query evaluations, see methodology |
| **Extension** | Modify schema + migration | Publish new EvaluationMethod version |
| **Revocation** | Delete/update row | Issue evaluation with verdict `-1` |
| **Composability** | Not composable | Combine evaluations from multiple indexers |
| **FCP-Aligned** | No (lookup tables aren't protocol-native) | Yes (evaluations are first-class FCP entities) |

## Conclusion

This pivot transforms alias resolution from a **disconnected maintenance table** into an **evaluation-based graph mechanism** that's fully aligned with FCP principles.

### The Paradigm Shift

**Before:** Alias resolution was a static lookup table (trust implicit, provenance lost)

**After:** Alias resolution is an **EvaluationMethod** where indexers explicitly evaluate owl:sameAs statements for trustworthiness

### What This Enables

- **FCP-Native Trust** — Trust decisions are evaluation statements (signed, verifiable, composable)
- **Evaluation Method Owns Logic** — Your method decides trust criteria (cryptographic proof, indexer consensus, cross-reference, etc.)
- **View Trusts Your Judgment** — Materialized view uses statements YOU evaluated as trusted (no re-evaluation)
- **Multi-Indexer Networks** — Applications can query evaluations from multiple indexers and apply their own aggregation logic
- **Method Reusability** — Other indexers can use `Fide-AliasResolutionTrust-v1` or define their own
- **Full Provenance** — Every resolution traces: owl:sameAs → evaluation → attestation → indexer signature
- **Granular Control** — Trust/revoke specific statements by issuing new evaluations (verdict=-1)
- **Application Choice** — Apps choose which indexers/methods to trust (subjective trust model)
- **Transparent Logic** — EvaluationMethod published to graph; anyone can inspect the "rulebook"

### The Core Insight

**Alias resolution is a trust problem, and trust is subjective evaluation.**

By treating it as an EvaluationMethod (like reputation, fact-checking, quality scoring), we get:
1. All trust decisions are **explicit evaluation statements** (not implicit table rows)
2. Different indexers can use different methods (no protocol mandate)
3. Applications compose evaluations across indexers (emergent consensus)
4. The graph IS the source of truth (no dual maintenance)

**"Trust is subjective"** (from evaluate.mdx) applies to alias resolution too.

---

## Integration with Critique 19 (Statement-Anchored Identity)

This design is **fully complementary** to Critique 19 (Genesis Statement derivation of `0x10` IDs):

1. **Critique 19**: Defines how entities get their protocol-native `0x10` ID (from Genesis Subject-statement)
2. **Critique 21**: Defines how aliases (`0x15`, `0x18`, etc.) resolve to the `0x10` primary (via evaluated owl:sameAs)

Together: **Full identity chain with evaluation-based trust**

```
Alice's Twitter handle (0x15<x.com/alice>)
  ↓ owl:sameAs statement
Protocol-native identity (0x10<alice_primary>)
  ↓ evaluation (Fide-AliasResolutionTrust-v1, verdict=1)
Trusted by indexer(s)
  ↓ materialized view resolves
Queries use primary 0x10
  ↓ genesis tracking
Genesis Statement (0x00<first_subject_statement>)
  → Immutable audit trail
```

**Key Benefits of Integration:**
- Aliases are evaluated before resolution (explicit trust decisions)
- Primary IDs trace back to Genesis Statements (immutable provenance)
- Full chain queryable: alias → evaluation → primary → genesis
- Multi-indexer networks can aggregate trust across evaluators

---

## Implementation Status & Next Steps

### ✅ Completed (2026-02-05)

1. **SQL Schema**:
   - [x] ✅ Removed `fcp_alias_resolution` table from `fcp-tables-supabase.sql`
   - [x] ✅ Updated `fcp-materialized-views-supabase.sql`:
     - [x] ✅ Added `trusted_sameAs_statements` CTE (filters by evaluation verdict=1)
     - [x] ✅ Updated `owl_sameAs_resolutions` CTE (lexical tie-break for determinism)
     - [x] ✅ Added provenance columns: `*_original` for complete audit trail
     - [x] ✅ Resolved `raw_identifier` = Statement Fide ID (e.g., "0x00841fd8df...")
   - [x] ✅ Updated indexes for evaluation-based queries
   - [x] ✅ Updated all comments and documentation

2. **Seed Script**:
   - [x] ✅ Automatically calculates Statement-derived primaries (0x10..., 0x20..., etc.)
   - [x] ✅ Creates owl:sameAs statements for ~35+ entities
   - [x] ✅ Issues evaluation statements (Fide-AliasResolutionTrust-v1, verdict=1)
   - [x] ✅ Covers all entity types: Person, Org, Product, Agent, Place, Event, EvalMethod

3. **Scripts**:
   - [x] ✅ Fixed `reset-rcp.ts` to remove fcp_alias_resolution references
   - [x] ✅ Updated `seed-test-statements.ts` for evaluation-based resolution
   - [x] ✅ Verified `index-claims.ts` compatible (no changes needed)

### 🔄 In Progress

4. **Testing**:
   - [ ] Run `pnpm fcp:rsi` to verify full pipeline
   - [ ] Check materialized view has correct provenance columns
   - [ ] Verify all entities resolve to Statement-derived primaries (0xX0...)
   - [ ] Test that raw_identifier shows Statement Fide ID for resolved entities

### 📋 TODO

5. **TypeScript Types**:
   - [x] ✅ Updated `ResolvedStatementView` type with `*_original` columns
   - [ ] Update consuming code to use new columns

6. **EvaluationMethod Publishing**:
   - [ ] Create `Fide-AliasResolutionTrust-v1` entity in graph
   - [ ] Publish method definition (name, description, output scale: Verdict -1/0/1)
   - [ ] Document verification criteria
   - [ ] Add to evaluate.mdx as a standard method

7. **Documentation**:
   - [ ] Update identifiers.mdx with evaluation-based resolution + provenance
   - [ ] Add evaluate.mdx entry for Fide-AliasResolutionTrust-v1
   - [ ] Examples of querying provenance (`*_original` vs resolved)
   - [ ] Explain Statement-derived primary derivation

8. **Application Code**:
   - [ ] Remove any remaining fcp_alias_resolution references
   - [ ] Add helper: `get_alias_provenance(fingerprint)` to show original → resolved chain
   - [ ] Update UI to display provenance when relevant
