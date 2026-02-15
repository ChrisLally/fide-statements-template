# Critique 25: Cluster-Wide Identity Resolution — Beyond One-Hop Substitution

**Date**: 2026-02-11
**Decision**: Replace per-entity one-hop resolution with cluster-wide canonical primary selection using recursive connected components.
**Status**: ✅ Implemented (Materialized recursive CTE clustering)

## The Problem: The "One-Hop" Fragility

In [Critique 21](./critique21.md), we implemented alias resolution via trusted `owl:sameAs` statements. However, the implementation was **one-hop and direction-sensitive**:
1. It only followed `subject owl:sameAs object`.
2. It stopped at one hop.
3. The choice of "primary" was just the object of that one statement.

### Why This Fails
In a network of identities, `owl:sameAs` is naturally symmetric and transitive. If we have:
- `x.com/alice` sameAs `github.com/alice`
- `github.com/alice` sameAs `linkedin.com/alice`
- `linkedin.com/alice` sameAs `x.com/alice`

The current view produces a **cycle**:
- `x.com/alice` resolves to `github.com/alice`
- `github.com/alice` resolves to `linkedin.com/alice`
- `linkedin.com/alice` resolves to `x.com/alice`

There is no "global primary" for the cluster. The identity you see depends entirely on which profile you started your query from.

## The Solution: Undirected Identity Clusters

Identity resolution should be **cluster-wide**. All entities that are connected via trusted `owl:sameAs` links should resolve to the **same canonical primary fingerprint**, regardless of the direction of the statements or the path taken.

### 1. Treat owl:sameAs as Undirected Edges
We no longer care if A sameAs B or B sameAs A. Both statements signify membership in the same identity cluster.

### 2. Recursive Flood-Fill (Full Connected Components)
Using a recursive CTE with `UNION` (deduplicating), we find all reachable members for every identity. PostgreSQL's recursion handles termination automatically by tracking seen pairs, so no arbitrary "hop limit" is required.

### 3. Selection Rule: MIN(Fingerprint) — Deterministic Primary
Within each cluster, we must pick one representative as the "Primary." 
- We use the simplest possible rule: **MIN(fingerprint)** from all cluster members.
- The entity with the lexicographically smallest fingerprint becomes the canonical primary for the whole cluster.
- This is deterministic, stable, and requires no additional metadata or timestamps.

### 4. Refinement: Entity-Specific Evaluation Trust
Trusting identity claims is not a "one size fits all" process. Evaluating whether two Person identifiers are the same requires different criteria than evaluating two Organizations. 

- **Granular Methods**: We replaced the generic `alias-resolution-trust/v1` with entity-specific methods (e.g., `Fide-OwlSameAs-Person-v1`, `Fide-OwlSameAs-Organization-v1`).
- **SDK Centralization**: All evaluation method URLs are defined in the SDK (`FIDE_EVALUATION_METHODS`).
- **SQL Templating**: The indexer schema uses placeholders (e.g., `{{FIDE_OWL_SAMEAS_PERSON_V1}}`) which are injected from the SDK at migration time, ensuring a single source of truth across the protocol.

## The SQL Blueprint

### Phase 1: Symmetric Edge Collection
Collect all trusted `owl:sameAs` relations and treat them as bidirectional. Trust is determined by entity-specific evaluation methods.
```sql
-- 1. Identify the evaluation methods (Injected from SDK)
sameas_evaluation_methods AS (
  SELECT ri.identifier_fingerprint
  FROM fcp_raw_identifiers ri
  WHERE ri.raw_identifier IN (
    '{{FIDE_OWL_SAMEAS_PERSON_V1}}',
    '{{FIDE_OWL_SAMEAS_ORGANIZATION_V1}}'
  )
),

-- 2. Trust votes for owl:sameAs relations
sameAs_evaluation_votes AS (
  SELECT
    eval.subject_fingerprint AS sameAs_statement_fp,
    COUNT(*) FILTER (WHERE obj_ident.raw_identifier = '1') AS trust_votes,
    COUNT(*) FILTER (WHERE obj_ident.raw_identifier = '-1') AS reject_votes
  FROM fcp_statements eval
  INNER JOIN sameas_evaluation_methods method ON method.identifier_fingerprint = eval.predicate_fingerprint
  WHERE eval.predicate_type = 'e'
  GROUP BY eval.subject_fingerprint
),

-- 3. Symmetry: A sameAs B implies B sameAs A
sameAs_edges AS (
  SELECT s.subject_fingerprint AS node_a, s.object_fingerprint AS node_b
  FROM fcp_statements s
  INNER JOIN trusted_sameAs_statements trusted ON trusted.sameAs_statement_fp = s.statement_fingerprint
  WHERE s.predicate_raw_identifier = 'owl:sameAs'
  UNION -- Symmetric completion
  SELECT s.object_fingerprint, s.subject_fingerprint
  FROM fcp_statements s
  INNER JOIN trusted_sameAs_statements trusted ON trusted.sameAs_statement_fp = s.statement_fingerprint
  WHERE s.predicate_raw_identifier = 'owl:sameAs'
)
```

### Phase 2: Recursive Clustering
Expand the edges into full connected components.
```sql
flood_fill AS (
  SELECT node_a AS origin, node_b AS member FROM sameAs_edges
  UNION
  SELECT f.origin, e.node_b AS member
  FROM flood_fill f
  INNER JOIN sameAs_edges e ON e.node_a = f.member
)
```

### Phase 3: Primary Election
Pick the entity with the smallest fingerprint in each cluster.
```sql
cluster_primary AS (
  SELECT DISTINCT ON (all_nodes.entity_fp)
    all_nodes.entity_fp,
    all_nodes.member AS primary_fp
  FROM (
    SELECT origin AS entity_fp, member FROM flood_fill
    UNION
    SELECT entity_fp, entity_fp FROM entity_metadata
  ) all_nodes
  ORDER BY 
    all_nodes.entity_fp, 
    all_nodes.member ASC  -- MIN(fingerprint) wins
)
```

## Benefits of the Cluster Approach

| Feature | Current (Critique 21) | New (Critique 25) |
|---------|-----------------------|-------------------|
| **Primary Selection** | Object of best sameAs | MIN(fingerprint) from cluster |
| **Transitivity** | No (One-hop only) | Yes (Recursive closure) |
| **Symmetry** | No (Subject → Object) | Yes (Undirected edges) |
| **Cycles** | Break into per-node hops | Merge into single component |
| **Deterministic** | Fragile (direction-specific) | Stable (MIN fingerprint) |
| **Provenance** | Maintained (`*_original`) | Maintained (`*_original`) |

## Implementation Plan

1. **Update `schema.sql`**:
   - Replace the `owl_sameAs_resolutions` CTE with the recursive clustering logic.
   - Refactor `resolved_subjects` and `resolved_objects` to use the `cluster_primary` mapping.
2. **Performance Check**: 
   - Verify materialized view refresh time on seeded data. Identity clusters are typically small (2-10 nodes), so recursive expansion is extremely fast.
3. **Seed Script Verification**:
   - Ensure `seed.ts` results in stable primary resolution even if `owl:sameAs` directions are flipped.

## Conclusion

By moving from substitution to clustering, we align identity resolution with the reality of decentralised graphs. Identity isn't a single edge; it's a connected component. Using MIN(fingerprint) as the primary election mechanism gives us a simple, deterministic identity that resists fragmentation, while entity-specific evaluation methods ensure that trust is applied with appropriate semantic rigor. Centralizing these definitions in the SDK ensures that the entire FCP ecosystem remains synchronized.
