-- ============================================================================
-- FIDE CONTEXT PROTOCOL (FCP) - DATABASE SCHEMA
-- Version: Pure Triple Model with Evaluation-Based Identity Resolution (Critique 21)
-- Updated: 2026-02-07
-- ============================================================================
-- This schema implements the standardized FCP architecture:
--
-- 1. fcp_raw_identifiers: Lookup table mapping fingerprints ↔ rawIdentifiers
-- 2. fcp_statements: Core statements table (Subject-Predicate-Object as fingerprints)
--    - Includes owl:sameAs statements (alias → primary relationships)
--    - Includes evaluation statements (trust decisions about owl:sameAs)
--
-- Identity Resolution (Critique 21 - Evaluation-Based Trust):
--   - No fcp_alias_resolution table (removed)
--   - Trust via evaluations: EvaluationMethod https://github.com/fide-work/evaluation-methods/alias-resolution-trust
--   - Evaluation statements carry verdict literals (-1/0/1) about owl:sameAs statements
--   - Materialized view keeps owl:sameAs candidates where trust_votes > reject_votes
--   - Evaluator consensus (net trust score) + lexical tie-break determines primary
--   - Single source of truth: evaluation statements in the graph
--
-- All views (attestations, claims, etc.) are derived from statements.
-- See fcp-views-supabase.sql for regular views.
-- See fcp-materialized-views-supabase.sql for materialized views.

-- ============================================================================
-- CLEANUP
-- ============================================================================
DROP TABLE IF EXISTS fcp_attestation_statements CASCADE;
DROP TABLE IF EXISTS fcp_statements CASCADE;
DROP TABLE IF EXISTS fcp_alias_resolution CASCADE;  -- Deprecated (Critique 21): Use owl:sameAs resolution instead
DROP TABLE IF EXISTS fcp_raw_identifiers CASCADE;
-- Legacy (old names)
DROP TABLE IF EXISTS fcp_identifier_resolution CASCADE;
DROP TABLE IF EXISTS fcp_identifiers CASCADE;
DROP TABLE IF EXISTS fcp_urn_registry CASCADE;
-- Legacy
DROP TABLE IF EXISTS fcp_edges CASCADE;

-- Drop old enums
DROP TYPE IF EXISTS fcp_entity_type CASCADE;
DROP TYPE IF EXISTS fcp_source_identifier_type CASCADE;
DROP TYPE IF EXISTS fcp_statement_predicate_type CASCADE;

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Entity Type: First hex digit of Fide ID
-- Encodes the semantic category of an entity
CREATE TYPE fcp_entity_type AS ENUM (
    '0',  -- Statement (FCP protocol entity)
    '1',  -- Person (W3C PROV-O foaf:Person)
    '2',  -- Organization (Schema.org Organization)
    '3',  -- Place (Schema.org Place)
    '4',  -- Event (Schema.org Event)
    '5',  -- Product (Schema.org Product)
    '6',  -- CreativeWork (literals, predicates, identifiers, statements)
    '7',  -- AutonomousAgent (FIDE extension, AI/bot)
    '8',  -- CryptographicAccount (FIDE extension, blockchain address)
    'e',  -- EvaluationMethod (FIDE extension, evaluation predicates)
    'a'   -- Attestation (FIDE extension, batch signing container)
);

-- Source Identifier Type:
-- The second hex digit of a Fide ID is the "source type". In FCP we keep this DRY:
-- source types reuse the same enum as entity types, since any entity type may be used as a source.

-- Statement Predicate Type: Semantic category of predicate
-- Enables zero-lookup reputation queries without string parsing
CREATE TYPE fcp_statement_predicate_type AS ENUM (
    '6',  -- Attribute/Relationship: Attributes and relationships (schema:name, sec:controller, prov:wasGeneratedBy)
    'e'   -- Evaluation: Subjective judgments and opinions (Fide-*, schema:rating)
);

-- ============================================================================
-- 1. RAW IDENTIFIERS (Fingerprint → rawIdentifier Lookup)
-- ============================================================================
-- Maps Fide ID fingerprints back to their rawIdentifiers (human-readable form).
-- Essential for resolving content-addressed hashes back to human-readable form.
--
-- Schema (ALL COLUMNS NOT NULL):
--   identifier_fingerprint: 38-char fingerprint (content hash) - PRIMARY KEY
--   raw_identifier: The source string (e.g., "x.com/alice", "schema:worksFor", "@alice") - NOT NULL
--
-- NOTE: Same rawIdentifier (`raw_identifier`) can have different fingerprints (different contexts).
-- The uniqueness is on identifier_fingerprint (PK), not rawIdentifier (`raw_identifier`).
-- FCP PROTOCOL REQUIREMENT: Every fingerprint MUST have a rawIdentifier (`raw_identifier`) (no nulls).
CREATE TABLE fcp_raw_identifiers (
    identifier_fingerprint CHAR(38) PRIMARY KEY,
    raw_identifier TEXT NOT NULL
);

-- ============================================================================
-- 2. STATEMENTS (Core Statements Table)
-- ============================================================================
-- Core triple store: all statements as Subject-Predicate-Object tuples.
-- Each statement is content-addressed (same triple → same fingerprint).
-- Enables deduplication and agreement queries across multiple signers.
--
-- NOTE: Fingerprints are content-addressed hashes, not foreign keys.
-- Statement fingerprints are derived (S+P+O hash) and never stored in fcp_raw_identifiers.
-- Subject/predicate/object fingerprints may reference entities, predicates, or other statements.
--
-- SCHEMA INTEGRITY (ALL COLUMNS NOT NULL):
-- - Every statement MUST have subject, predicate, and object (all required, no nulls)
-- - All type and source_type fields are NOT NULL (enables zero-lookup queries)
-- - All fingerprints are NOT NULL (38-char content hashes)
-- - No defensive null checks needed in service layer (strict schema enforcement)
CREATE TABLE fcp_statements (
    statement_fingerprint CHAR(38) PRIMARY KEY,
    subject_type fcp_entity_type NOT NULL,
    subject_source_type fcp_entity_type NOT NULL,
    subject_fingerprint CHAR(38) NOT NULL,
    predicate_fingerprint CHAR(38) NOT NULL,
    predicate_type fcp_statement_predicate_type NOT NULL,           -- Enables zero-lookup reputation queries
    predicate_source_type fcp_entity_type NOT NULL,                 -- Usually '6' (CreativeWork) for string-identified predicates
    object_type fcp_entity_type NOT NULL,
    object_source_type fcp_entity_type NOT NULL,
    object_fingerprint CHAR(38) NOT NULL,

    -- Predicate source type constraint: Ensures predicates have correct source types
    -- EvaluationMethods (type 'e') MUST use Statement-derived primaries (source '0')
    -- CreativeWork predicates (type '6') MUST use CreativeWork source ('6')
    CONSTRAINT chk_predicate_source_type CHECK (
        (predicate_type = 'e' AND predicate_source_type = '0') OR
        (predicate_type = '6' AND predicate_source_type = '6')
    ),

    -- Protocol entity self-sourcing constraint: Protocol entities must be self-sourced
    -- Statements (type '0') MUST have Statement source ('0') = 0x00
    -- Attestations (type 'a') MUST have Attestation source ('a') = 0xaa
    CONSTRAINT chk_subject_protocol_self_sourced CHECK (
        (subject_type = '0' AND subject_source_type = '0') OR
        (subject_type = 'a' AND subject_source_type = 'a') OR
        (subject_type NOT IN ('0', 'a'))
    ),
    CONSTRAINT chk_object_protocol_self_sourced CHECK (
        (object_type = '0' AND object_source_type = '0') OR
        (object_type = 'a' AND object_source_type = 'a') OR
        (object_type NOT IN ('0', 'a'))
    )
);

-- ============================================================================
-- NO fcp_alias_resolution TABLE (Critique 21 - Evaluation-Based Trust)
-- ============================================================================
-- Resolution now happens entirely in the materialized view via evaluation statements.
-- There is no separate lookup table - trust decisions are evaluation statements in the graph.
--
-- Architecture (Evaluation-Based):
--   - owl:sameAs statements in fcp_statements define alias → primary relationships
--   - Indexers issue evaluation statements (https://github.com/fide-work/evaluation-methods/alias-resolution-trust) about which ones they trust
--   - fcp_statements_identifiers_resolved keeps candidates where trust_votes > reject_votes
--   - Evaluator consensus ranks candidates by net trust score, then trust vote count
--   - Lexical fingerprint tie-break ensures deterministic results
--
-- EvaluationMethod: https://github.com/fide-work/evaluation-methods/alias-resolution-trust
--   - Subject: owl:sameAs Statement ID (did:fide:0x00...)
--   - Predicate: EvaluationMethod Primary Fide ID (did:fide:0xe0...) for https://github.com/fide-work/evaluation-methods/alias-resolution-trust
--   - Object: Verdict (1=Trust, -1=Reject, 0=Uncertain)
--
-- Benefits:
--   - Trust is explicit: evaluation statements (signed, verifiable, auditable)
--   - FCP-native: evaluations are first-class protocol entities
--   - Composable: aggregate evaluations across multiple indexers
--   - Revocable: issue new evaluation with verdict=-1 to revoke trust
--   - Method reusable: other indexers can use same method or define their own
--
-- Querying trust decisions:
--   -- What are trust/reject vote totals for this owl:sameAs statement?
--   SELECT
--     COUNT(*) FILTER (WHERE obj_ident.raw_identifier = '1') AS trust_votes,
--     COUNT(*) FILTER (WHERE obj_ident.raw_identifier = '-1') AS reject_votes
--   FROM fcp_statements eval
--   JOIN fcp_raw_identifiers pred_ident ON pred_ident.identifier_fingerprint = eval.predicate_fingerprint
--   JOIN fcp_raw_identifiers obj_ident ON obj_ident.identifier_fingerprint = eval.object_fingerprint
--   WHERE pred_ident.raw_identifier = 'https://github.com/fide-work/evaluation-methods/alias-resolution-trust'
--   AND eval.subject_fingerprint = <sameAs_statement_fp>;
--
-- Querying aliases of an entity:
--   SELECT s.*
--   FROM fcp_statements s
--   JOIN fcp_raw_identifiers pred_ident ON pred_ident.identifier_fingerprint = s.predicate_fingerprint
--   WHERE pred_ident.raw_identifier = 'owl:sameAs'
--   AND s.object_fingerprint = <primary_fingerprint>;

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================
COMMENT ON TABLE fcp_raw_identifiers IS 'Fingerprint → rawIdentifier lookup. Maps 38-char fingerprints to human-readable identifiers.';
COMMENT ON TABLE fcp_statements IS 'Core triple store. All FCP statements as Subject-Predicate-Object tuples with fingerprint references. Includes: content statements, PROV-O links (wasGeneratedBy, wasAssociatedWith), controller relationships (sec:controller), owl:sameAs statements (alias → primary relationships), and evaluation statements (trust decisions using EvaluationMethods like Fide-AliasResolutionTrust-v1). Resolution computed in fcp_statements_identifiers_resolved materialized view.';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_statements_subject ON fcp_statements(subject_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_predicate ON fcp_statements(predicate_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_object ON fcp_statements(object_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_spo ON fcp_statements(subject_fingerprint, predicate_fingerprint, object_fingerprint);

-- Zero-lookup reputation query index: Get all evaluations for an entity instantly
-- WHERE subject_fingerprint = 'entity_fp' AND predicate_type = 'e'
CREATE INDEX IF NOT EXISTS idx_statements_evaluations_by_subject
ON fcp_statements(subject_fingerprint, predicate_type)
WHERE predicate_type = 'e';

-- PROV-O Triangle discovery indexes
CREATE INDEX IF NOT EXISTS idx_statements_prov_generated_by
ON fcp_statements(predicate_fingerprint)
WHERE predicate_type = '6' AND predicate_source_type = '6';

CREATE INDEX IF NOT EXISTS idx_statements_prov_associated_with
ON fcp_statements(predicate_fingerprint, object_fingerprint)
WHERE predicate_type = '6' AND predicate_source_type = '6';

-- sec:controller discovery index
CREATE INDEX IF NOT EXISTS idx_statements_did_controller
ON fcp_statements(subject_fingerprint, predicate_fingerprint)
WHERE predicate_type = '6' AND predicate_source_type = '6';

-- Predicate lookup with type filtering
CREATE INDEX IF NOT EXISTS idx_statements_predicate_with_type
ON fcp_statements(predicate_fingerprint, predicate_type);

-- ============================================================================
-- INDEXES FOR EVALUATION-BASED RESOLUTION (Critique 21)
-- ============================================================================
-- These indexes support the evaluation-based resolution logic in fcp_statements_identifiers_resolved
--
-- Note: fcp_statements only contains fingerprints, not rawIdentifiers.
-- Resolution queries must JOIN to fcp_raw_identifiers to filter by rawIdentifier (`raw_identifier`).
-- Indexes on predicate_fingerprint will be used for these queries.
--
-- The existing predicate_fingerprint indexes (created above) support:
--   - Evaluation method queries (filter by predicate_fingerprint for alias-resolution-trust)
--   - owl:sameAs queries (filter by predicate_fingerprint for owl:sameAs)
--
-- Additional specialized indexes can be added later if needed based on query patterns.

-- ============================================================================
-- SCHEMA INTEGRITY ENFORCEMENT
-- ============================================================================
-- FCP PROTOCOL REQUIREMENT: All statements must have complete predicate metadata.
--
-- Predicate Type (predicate_type):
--   - '6' = Attribute/Relationship (CreativeWork predicates: schema:name, sec:controller, owl:sameAs)
--   - 'e' = Evaluation (subjective judgments: https://github.com/fide-work/evaluation-methods/*, https://github.com/fide-work/evaluation-methods/statement-accuracy)
--
-- Predicate Source Type (predicate_source_type):
--   - Usually '6' = CreativeWork (string-identified predicates)
--   - Could be other types for special predicates
--
-- The schema enforces NOT NULL constraints on both columns.
-- Inserts without these fields will fail at the database level.
-- No backfilling needed - all data must be complete at insert time.

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
-- Note: Identity resolution logic is implemented in the materialized view
-- (fcp_statements_identifiers_resolved) using evaluation-based trust (Critique 21).
-- Evaluation issuance handled in service layer for better testability and type safety.
-- No additional database functions needed for resolution.
