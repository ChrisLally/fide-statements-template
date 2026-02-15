# Critique 24: Predicate Canonicalization and Ontology Equivalence (v1)

**Date**: 2026-02-10
**Decision**: Predicates use `0x66` (Concept) at creation time; equivalence is evaluation-driven, not protocol-locked; no SDK-level IRI normalization for v1
**Status**: Draft

## Context

With ID derivation and signature methods established, this critique addresses the semantic layer: **how predicates are identified, and how cross-ontology equivalence is resolved** without fragmenting the graph.

The core tension: if User A uses `schema:name` and User B uses `https://schema.org/name` as their predicate rawIdentifier, they generate different Fide IDs (`0x66...`). At scale, this fragments the graph into incompatible vocabularies unless there is a canonicalization or resolution strategy.

## Final Position

### 1. Predicates Use `0x66` (Concept) at Statement Creation Time

When a user creates a statement, the predicate is a **CreativeWork Concept** — a string hashed via `calculateFideId('CreativeWork', 'CreativeWork', rawIdentifier)`.

This means:
- The predicate is a "claimed intent," not a protocol-enforced global constant
- Different strings produce different Fide IDs — this is correct and expected
- The rawIdentifier is whatever the user provides (no SDK-level transformation)

### 2. Require Full IRIs as Predicate rawIdentifiers for v1

To minimize fragmentation without building prefix-expansion infrastructure:
- **Require full IRIs** as the canonical rawIdentifier for predicates (e.g., `https://schema.org/worksFor`, not `schema:worksFor`)
- Protocol-internal predicates that are already short-form conventions (`owl:equivalentProperty`, `sec:controller`, `prov:wasGeneratedBy`) keep their compact form — these are protocol-defined constants, not user input
- SDK helpers and `vocab.ts` constants define the canonical strings for protocol predicates

Why:
- Eliminates prefix ambiguity at the input level (no `schema:` vs `s:` vs full URL problem)
- No SDK normalization layer needed for v1
- Full IRIs are unambiguous and self-documenting

### 3. Genesis Pattern (`0x60`) Available for Protocol-Anchored Terms

The protocol can issue **Genesis Statements** for canonical terms. A Genesis Statement for a predicate produces a `0x60` Primary Fide ID that serves as a canonical "agreement anchor."

| ID Type | Role | Example |
|---------|------|---------|
| **`0x66` (Concept)** | User-provided predicate string | `calculateFideId('CreativeWork', 'CreativeWork', 'https://schema.org/worksFor')` |
| **`0x60` (Genesis)** | Protocol-anchored canonical term | Derived from Genesis Statement defining the term |

Key properties:
- `0x66` aliases can map to a `0x60` primary via `owl:equivalentProperty` resolution
- Multiple external strings (different ontologies, different spellings) can resolve to the same `0x60` anchor
- The protocol **may** issue Genesis Statements for common predicates, but this is not required for v1

### 4. Equivalence Is Evaluation-Driven, Not Protocol-Locked

This is the critical architectural decision: **predicate equivalence is determined by evaluation methods, not hardcoded into the protocol.**

#### Evaluation Method Naming Convention

Evaluation methods follow the pattern: **`Fide-{ClaimPredicate}-{SubjectDomain}-v{version}`**

The method name encodes exactly what it evaluates: the predicate used in the claim, and the domain of subjects being linked.

#### Dedicated Method: `Fide-OwlEquivalentProperty-StatementPredicate-v1`

Predicate equivalence is a **different judgment** than identity equivalence. A person is either Alice or they aren't. But two predicates (`https://schema.org/worksFor` vs `https://dbpedia.org/ontology/employer`) might overlap 90% of the time and diverge in edge cases.

**`Fide-OwlEquivalentProperty-StatementPredicate-v1`**
- **Evaluates**: `owl:equivalentProperty` statements where both subject and object are predicate IDs (`0x66` CreativeWork Concepts used as statement predicates)
- **Output**: Verdict (`-1` Not equivalent, `0` Uncertain, `1` Semantically equivalent)
- **Judgment Criteria**: Are these two predicates interchangeable in **all** contexts where one is used?
- **URL**: `https://github.com/fide-work/evaluation-methods/owl-equivalent-property-statement-predicate/v1`

**Semantic Web Foundation**: Following OWL semantics, we use `owl:equivalentProperty` (not `owl:sameAs`) to link predicates. `owl:sameAs` is reserved for linking individuals/entities; `owl:equivalentProperty` states that two properties have the same extension and are logically interchangeable.

#### Applying the Naming Convention to Entity Resolution

The same naming pattern applies to entity identity methods. The current `Fide-AliasResolutionTrust-v1` should be split into domain-specific methods:

| Method | Claim Predicate | Subject Domain | Question |
|--------|----------------|----------------|----------|
| `Fide-OwlSameAs-Person-v1` | `owl:sameAs` | Person | Is this the same person? |
| `Fide-OwlSameAs-Organization-v1` | `owl:sameAs` | Organization | Is this the same org? |
| `Fide-OwlEquivalentProperty-StatementPredicate-v1` | `owl:equivalentProperty` | Statement Predicate | Are these predicates interchangeable? |
| `Fide-OwlInverseOf-StatementPredicate-v1` | `owl:inverseOf` | Statement Predicate | Are these predicates inverses (subject/object swapped)? |

**Equivalence vs Inverse**:
- `owl:equivalentProperty`: Subject (alias) can be replaced with Object (primary/genesis)
- `owl:inverseOf`: Subject (inverse) must swap subject/object to align with Object (primary/genesis)

**Directionality Rule**: The Object is always the canonical anchor (typically `0x60` Genesis). The Subject is the term requiring transformation.

This allows different trust criteria per claim type and subject domain without protocol changes.

#### Resolution Flow

1. Someone issues an `owl:equivalentProperty` statement linking two predicate IDs (e.g., `0x66` for `https://schema.org/worksFor` equivalentProperty `0x66` for `https://dbpedia.org/ontology/employer`)
2. Evaluators vote on that claim using **`Fide-OwlEquivalentProperty-StatementPredicate-v1`** (verdict: -1/0/1)
3. The materialized view resolver only accepts `owl:equivalentProperty` links with positive consensus (trust_votes > reject_votes)
4. Resolved aliases collapse into the primary in `fcp_statements_identifiers_resolved`

This means:
- The protocol does not define which predicates are "the same" — the evaluation graph does
- Different indexers can adopt different resolution policies (strict, consensus-based, experimental)
- New predicate equivalences can emerge over time without protocol changes
- Predicate equivalence evaluations are auditable — you can inspect *why* two predicates were considered equivalent and *who* evaluated that claim

### 5. Materialized View: Resolver Has Agency

Each indexer's materialized view is a **subjective interpretation** of the objective statement graph.

| Resolver Strategy | Behavior | Result |
|-------------------|----------|--------|
| **Strict** | Only resolves `owl:equivalentProperty` with verifiable evaluation consensus | High trust, sparse graph |
| **Consensus-Based** | Resolves using protocol-default evaluation methods | High utility, community-standard behavior |
| **Experimental** | Maps `0x66` terms to new ontologies for testing | Graph evolves without changing raw data |

**Resolution Logic**:
- **Equivalence** (`owl:equivalentProperty`): Subject predicate ID replaced with Object predicate ID
- **Inverse** (`owl:inverseOf`): Subject predicate triggers subject/object swap to align with Object predicate direction

### 6. Emergent Ontology Support

New predicates start as `0x66` concepts. The lifecycle:
1. A user introduces a new predicate string (e.g., `https://example.com/agentReasoning`) — hashed as `0x66`
2. Community adoption grows
3. Someone issues a Genesis Statement formally defining the term — creating a `0x60` anchor
4. Indexers begin resolving the `0x66` alias to the `0x60` primary via `owl:equivalentProperty` + evaluation trust
5. The raw data never changes — only the resolution logic evolves

## What We Will Update Now

### A. Documentation

- Update predicate examples across protocol docs to use full IRIs where they represent user input (e.g., `https://schema.org/worksFor` instead of `schema:worksFor` for rawIdentifiers in user-facing examples)
- Keep compact forms (`schema:name`, `owl:sameAs`, `sec:controller`, `prov:wasGeneratedBy`) in protocol-internal contexts where these are defined constants
- Add section to `identifiers.mdx` or `schema/index.mdx` explaining:
  - Why predicates use `0x66` at creation time
  - The relationship between `0x66` aliases and `0x60` primaries
  - How evaluation-driven resolution works for predicate equivalence
- Document the Genesis Statement pattern for predicates (how to issue one, what it means)
- Clarify in `indexing.mdx` that predicate equivalence is resolved via evaluation methods, not a hardcoded table

### B. SDK (`vocab.ts` / Constants)

- Ensure `vocab.ts` defines canonical full-IRI constants for all standard predicates
- Protocol-internal constants (used in provenance/attestation statements) remain as compact forms
- No prefix-expansion or IRI normalization logic needed in v1 SDK

## What We Will Not Change in This Critique

- We are not building a prefix-expansion / IRI normalization layer in the SDK for v1
- We are not locking predicate equivalences into the protocol — these remain evaluation-driven
- We are not changing the materialized view SQL to resolve predicates (predicates stay human-readable)
- We are not defining a fixed set of Genesis Statements for predicates — this can happen organically
- We are not changing the seed script or test data in this critique

## Architecture Rule

**Predicate identity and predicate equivalence are decoupled:**
- `calculateFideId` hashes whatever rawIdentifier string is provided — no normalization
- Equivalence between different predicate strings is an evaluation-layer concern
- The materialized view resolver applies trust-weighted `owl:equivalentProperty` resolution

This mirrors the Critique 23 rule (identity math and signing math are decoupled) at the semantic layer.

## Implementation Checklist

### Must Do (Pre-release)
- [ ] Define `Fide-OwlEquivalentProperty-StatementPredicate-v1` evaluation method (GitHub repo, Genesis Statement, `0xe0` primary ID)
- [ ] Define `Fide-OwlInverseOf-StatementPredicate-v1` evaluation method (GitHub repo, Genesis Statement, `0xe0` primary ID)
- [ ] Add `METHOD_OWL_EQUIVALENT_PROPERTY_STATEMENT_PREDICATE` and `METHOD_OWL_INVERSE_OF_STATEMENT_PREDICATE` to `vocab.ts`
- [ ] Add to `generate-evaluation-method-ids.ts` to compute `0xe0` primary IDs for both methods
- [ ] Define `Fide-OwlSameAs-Person-v1` and `Fide-OwlSameAs-Organization-v1` evaluation methods (replacing generic `Fide-AliasResolutionTrust-v1`)
- [ ] Update materialized view SQL to resolve predicates: **ID-replacement** for `owl:equivalentProperty`, **column-swapping** for `owl:inverseOf`
- [ ] Document the new method in `evaluating.mdx` reference methods section
- [ ] Audit predicate rawIdentifier strings in docs: user-facing examples should use full IRIs
- [ ] Audit `vocab.ts`: ensure canonical full-IRI constants exist for standard predicates (export helper objects like `SCHEMA_PREDICATES.name` → full IRI)
- [ ] Add documentation section explaining predicate `0x66` vs `0x60` pattern and evaluation-driven equivalence

### Defer
- [ ] SDK-level prefix normalization / IRI expansion (only if user feedback demands it)
- [ ] Protocol-issued Genesis Statements for common predicates (can emerge organically)
- [ ] SKOS relationship support for fuzzy predicate hierarchies (`skos:broader`, `skos:related`)

## Bottom Line

For v1, predicates are **user-provided concept strings** (`0x66`) hashed as-is. Equivalence across ontologies is resolved by **evaluation methods and the materialized view**, not by protocol diktat. This keeps the protocol lightweight and the resolution layer subjective — exactly where trust decisions belong.
