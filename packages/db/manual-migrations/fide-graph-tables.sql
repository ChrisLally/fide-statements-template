-- ============================================================================
-- FIDE GRAPH - DATABASE SCHEMA
-- Version: Pure Triple Model (No EvaluationMethod/Attestation Entity Types)
-- Updated: 2026-02-16
-- ============================================================================
-- This schema implements the core Fide graph storage model:
--
-- 1. raw_identifiers: Lookup table mapping fingerprints ↔ rawIdentifiers
-- 2. statements: Core statements table (Subject-Predicate-Object as fingerprints)
--    - Includes content and relationship statements
--    - Includes owl:sameAs statements (alias → primary relationships)
--
-- Identity Resolution:
--   - No alias_resolution table
--   - Resolution policy is handled in service logic and computed output tables.
--
-- Start with base tables and indexes only.
-- Add views/materialized views later only if query patterns require them.

-- ============================================================================
-- CLEANUP
-- ============================================================================
DROP TABLE IF EXISTS attestation_statements CASCADE;
DROP TABLE IF EXISTS statement_batch_items CASCADE;
DROP TABLE IF EXISTS statement_batches CASCADE;
DROP TABLE IF EXISTS statements CASCADE;
DROP TABLE IF EXISTS identity_resolutions CASCADE;
DROP TABLE IF EXISTS alias_resolution CASCADE;  -- Deprecated (Critique 21): Use owl:sameAs resolution instead
DROP TABLE IF EXISTS raw_identifiers CASCADE;
-- Legacy (old names)
DROP TABLE IF EXISTS identifier_resolution CASCADE;
DROP TABLE IF EXISTS identifiers CASCADE;
DROP TABLE IF EXISTS urn_registry CASCADE;
-- Legacy
DROP TABLE IF EXISTS edges CASCADE;

-- Drop old enums
DROP TYPE IF EXISTS entity_type CASCADE;
DROP TYPE IF EXISTS source_identifier_type CASCADE;

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Entity Type: First hex digit of Fide ID
-- Encodes the semantic category of an entity
CREATE TYPE entity_type AS ENUM (
    '0',  -- Statement (protocol entity)
    '1',  -- Person (W3C PROV-O foaf:Person)
    '2',  -- Organization (Schema.org Organization)
    '3',  -- Place (Schema.org Place)
    '4',  -- Event (Schema.org Event)
    '5',  -- Product (Schema.org Product)
    '6',  -- CreativeWork (literals, predicates, identifiers, statements)
    '7'   -- AutonomousAgent (FIDE extension, AI/bot)
);

-- Source Identifier Type:
-- The second hex digit of a Fide ID is the "source type". We keep this DRY:
-- source types reuse the same enum as entity types, since any entity type may be used as a source.

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
-- Every fingerprint must have a rawIdentifier (`raw_identifier`) (no nulls).
CREATE TABLE raw_identifiers (
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
-- Statement fingerprints are derived (S+P+O hash) and never stored in raw_identifiers.
-- Subject/predicate/object fingerprints may reference entities, predicates, or other statements.
--
-- SCHEMA INTEGRITY (ALL COLUMNS NOT NULL):
-- - Every statement MUST have subject, predicate, and object (all required, no nulls)
-- - All type and source_type fields are NOT NULL (enables zero-lookup queries)
-- - All fingerprints are NOT NULL (38-char content hashes)
-- - No defensive null checks needed in service layer (strict schema enforcement)
CREATE TABLE statements (
    statement_fingerprint CHAR(38) PRIMARY KEY,
    first_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subject_type entity_type NOT NULL,
    subject_source_type entity_type NOT NULL,
    subject_fingerprint CHAR(38) NOT NULL,
    predicate_fingerprint CHAR(38) NOT NULL,
    object_type entity_type NOT NULL,
    object_source_type entity_type NOT NULL,
    object_fingerprint CHAR(38) NOT NULL,

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
CREATE TABLE statement_batches (
    root CHAR(64) PRIMARY KEY,
    repo_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    github_run TEXT NOT NULL,
    url TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE statement_batch_items (
    batch_root CHAR(64) NOT NULL REFERENCES statement_batches(root) ON DELETE CASCADE,
    statement_fingerprint CHAR(38) NOT NULL REFERENCES statements(statement_fingerprint) ON DELETE CASCADE,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_statement_batch_items PRIMARY KEY (batch_root, statement_fingerprint)
);

-- ============================================================================
-- 4. IDENTITY RESOLUTIONS (Resolved-only outputs)
-- ============================================================================
-- Resolved-only table produced by identity resolution jobs.
-- Each subject resolves to a canonical statement fingerprint anchor.
CREATE TABLE identity_resolutions (
    subject_type entity_type NOT NULL,
    subject_source_type entity_type NOT NULL,
    subject_fingerprint CHAR(38) NOT NULL,
    resolved_fingerprint CHAR(38) NOT NULL,
    resolved_first_created_at TIMESTAMPTZ NOT NULL,
    method_version TEXT NOT NULL,
    run_id TEXT NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_identity_resolutions PRIMARY KEY (
        subject_type,
        subject_source_type,
        subject_fingerprint
    )
);

-- ============================================================================
-- NO alias_resolution TABLE
-- ============================================================================
-- Resolution policy is derived from statements and service logic.
-- No separate alias table is required in this schema.

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================
COMMENT ON TABLE raw_identifiers IS 'Fingerprint → rawIdentifier lookup. Maps 38-char fingerprints to human-readable identifiers.';
COMMENT ON TABLE statements IS 'Core triple store. All statements as Subject-Predicate-Object tuples with fingerprint references. Includes content statements and relationship statements (for example schema:name, schema:citation, owl:sameAs).';
COMMENT ON TABLE identity_resolutions IS 'Resolved-only identity outputs. Canonical resolution is anchored by resolved_fingerprint (statement fingerprint). method_version is the identity-resolution method version applied to this row in the context of its subject_type.';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_statements_subject ON statements(subject_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_predicate ON statements(predicate_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_object ON statements(object_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_spo ON statements(subject_fingerprint, predicate_fingerprint, object_fingerprint);

CREATE INDEX IF NOT EXISTS idx_statement_batches_first_seen
ON statement_batches(first_seen_at);

CREATE INDEX IF NOT EXISTS idx_identity_resolutions_subject
ON identity_resolutions(subject_type, subject_source_type, subject_fingerprint);

CREATE INDEX IF NOT EXISTS idx_identity_resolutions_resolved
ON identity_resolutions(subject_type, resolved_fingerprint);

CREATE INDEX IF NOT EXISTS idx_identity_resolutions_resolved_first_created_at
ON identity_resolutions(resolved_first_created_at);

-- ============================================================================
-- RESOLUTION QUERY SUPPORT
-- ============================================================================
-- Note: statements only contains fingerprints, not rawIdentifiers.
-- Resolution queries JOIN raw_identifiers when filtering by predicate rawIdentifier.
-- Existing predicate_fingerprint indexes are sufficient for now.

-- ============================================================================
-- SCHEMA INTEGRITY ENFORCEMENT
-- ============================================================================
-- Predicate metadata is represented by predicate_fingerprint + raw_identifiers.

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
-- Identity resolution logic is expected to live in service jobs and computed output tables.
