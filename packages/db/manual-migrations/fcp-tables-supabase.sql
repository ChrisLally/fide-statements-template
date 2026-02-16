-- ============================================================================
-- FIDE CONTEXT PROTOCOL (FCP) - DATABASE SCHEMA
-- Version: Pure Triple Model (No EvaluationMethod/Attestation Entity Types)
-- Updated: 2026-02-16
-- ============================================================================
-- This schema implements the standardized FCP architecture:
--
-- 1. fcp_raw_identifiers: Lookup table mapping fingerprints ↔ rawIdentifiers
-- 2. fcp_statements: Core statements table (Subject-Predicate-Object as fingerprints)
--    - Includes content and relationship statements
--    - Includes owl:sameAs statements (alias → primary relationships)
--
-- Identity Resolution:
--   - No fcp_alias_resolution table
--   - Resolution policy is handled in materialized view/service logic.
--
-- All views are derived from statements.
-- See fcp-views-supabase.sql for regular views.
-- See fcp-materialized-views-supabase.sql for materialized views.

-- ============================================================================
-- CLEANUP
-- ============================================================================
DROP TABLE IF EXISTS fcp_attestation_statements CASCADE;
DROP TABLE IF EXISTS fcp_statement_batch_items CASCADE;
DROP TABLE IF EXISTS fcp_statement_batches CASCADE;
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
    '7'   -- AutonomousAgent (FIDE extension, AI/bot)
);

-- Source Identifier Type:
-- The second hex digit of a Fide ID is the "source type". In FCP we keep this DRY:
-- source types reuse the same enum as entity types, since any entity type may be used as a source.

-- Statement Predicate Type: Semantic category of predicate
-- Enables zero-lookup reputation queries without string parsing
CREATE TYPE fcp_statement_predicate_type AS ENUM (
    '6'   -- Attribute/Relationship: canonical CreativeWork predicate identifiers
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
    first_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subject_type fcp_entity_type NOT NULL,
    subject_source_type fcp_entity_type NOT NULL,
    subject_fingerprint CHAR(38) NOT NULL,
    predicate_fingerprint CHAR(38) NOT NULL,
    predicate_type fcp_statement_predicate_type NOT NULL,           -- Enables zero-lookup reputation queries
    predicate_source_type fcp_entity_type NOT NULL,                 -- '5' (Product) for canonical URL predicates in current SDK
    object_type fcp_entity_type NOT NULL,
    object_source_type fcp_entity_type NOT NULL,
    object_fingerprint CHAR(38) NOT NULL,

    -- Predicate source type constraint:
    -- CreativeWork predicates (type '6') MUST use Product source ('5')
    -- to match current SDK policy.
    CONSTRAINT chk_predicate_source_type CHECK (
        (predicate_type = '6' AND predicate_source_type = '5')
    ),

    -- Protocol entity self-sourcing constraint: Protocol entities must be self-sourced
    -- Statements (type '0') MUST have Statement source ('0') = 0x00
    CONSTRAINT chk_subject_protocol_self_sourced CHECK (
        (subject_type = '0' AND subject_source_type = '0') OR
        (subject_type <> '0')
    ),
    CONSTRAINT chk_object_protocol_self_sourced CHECK (
        (object_type = '0' AND object_source_type = '0') OR
        (object_type <> '0')
    )
);

-- ============================================================================
-- 3. STATEMENT BATCHES (Root-level ingest tracking)
-- ============================================================================
-- Tracks first-seen statement batch roots and links batch roots to statement fingerprints.
CREATE TABLE fcp_statement_batches (
    root CHAR(64) PRIMARY KEY,
    repo_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    github_run TEXT NOT NULL,
    url TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fcp_statement_batch_items (
    batch_root CHAR(64) NOT NULL REFERENCES fcp_statement_batches(root) ON DELETE CASCADE,
    statement_fingerprint CHAR(38) NOT NULL REFERENCES fcp_statements(statement_fingerprint) ON DELETE CASCADE,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fcp_statement_batch_items UNIQUE (batch_root, statement_fingerprint)
);

-- ============================================================================
-- NO fcp_alias_resolution TABLE
-- ============================================================================
-- Resolution policy is derived from statements and materialized-view/service logic.
-- No separate alias table is required in this schema.

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================
COMMENT ON TABLE fcp_raw_identifiers IS 'Fingerprint → rawIdentifier lookup. Maps 38-char fingerprints to human-readable identifiers.';
COMMENT ON TABLE fcp_statements IS 'Core triple store. All FCP statements as Subject-Predicate-Object tuples with fingerprint references. Includes content statements and relationship statements (for example schema:name, schema:citation, owl:sameAs). Resolution computed in fcp_statements_identifiers_resolved materialized view.';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_statements_subject ON fcp_statements(subject_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_predicate ON fcp_statements(predicate_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_object ON fcp_statements(object_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_spo ON fcp_statements(subject_fingerprint, predicate_fingerprint, object_fingerprint);

-- PROV-O Triangle discovery indexes
CREATE INDEX IF NOT EXISTS idx_statements_prov_generated_by
ON fcp_statements(predicate_fingerprint)
WHERE predicate_type = '6' AND predicate_source_type = '5';

CREATE INDEX IF NOT EXISTS idx_statements_prov_associated_with
ON fcp_statements(predicate_fingerprint, object_fingerprint)
WHERE predicate_type = '6' AND predicate_source_type = '5';

-- sec:controller discovery index
CREATE INDEX IF NOT EXISTS idx_statements_did_controller
ON fcp_statements(subject_fingerprint, predicate_fingerprint)
WHERE predicate_type = '6' AND predicate_source_type = '5';

-- Predicate lookup with type filtering
CREATE INDEX IF NOT EXISTS idx_statements_predicate_with_type
ON fcp_statements(predicate_fingerprint, predicate_type);

CREATE INDEX IF NOT EXISTS idx_statement_batches_first_seen
ON fcp_statement_batches(first_seen_at);

-- ============================================================================
-- RESOLUTION QUERY SUPPORT
-- ============================================================================
-- Note: fcp_statements only contains fingerprints, not rawIdentifiers.
-- Resolution queries JOIN fcp_raw_identifiers when filtering by predicate rawIdentifier.
-- Existing predicate_fingerprint indexes are sufficient for now.

-- ============================================================================
-- SCHEMA INTEGRITY ENFORCEMENT
-- ============================================================================
-- FCP PROTOCOL REQUIREMENT: All statements must have complete predicate metadata.
--
-- Predicate Type (predicate_type):
--   - '6' = Attribute/Relationship (CreativeWork predicates: schema:name, schema:citation, owl:sameAs)
--
-- Predicate Source Type (predicate_source_type):
--   - '5' = Product (canonical string URL predicates in current SDK)
--
-- The schema enforces NOT NULL constraints on both columns.
-- Inserts without these fields will fail at the database level.
-- No backfilling needed - all data must be complete at insert time.

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
-- Note: Identity resolution logic is implemented in the materialized view
-- (fcp_statements_identifiers_resolved).
