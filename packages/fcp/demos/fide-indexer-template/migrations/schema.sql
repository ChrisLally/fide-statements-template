-- ============================================================================
-- FCP Indexer Schema (clean restart)
-- Tables: fcp_raw_identifiers, fcp_statements
-- Materialized view: fcp_statements_identifiers_resolved
-- Each run: DROP + CREATE for tables and view. All data is cleared.
--
-- Design: No genesis-statement-derived entities (0xX0) in fcp_statements.
-- Only 0x00 (Statement) and 0xaa (Attestation) allowed with Statement source.
-- Entities identified by concrete source: Person+Product (twitter), Org+Org (domain), etc.
-- Materialized view handles merging/canonicalization and trust-based resolution.
--
-- Note: If attestations were created via the SDK (buildStatementBatch, createAttestation),
-- many of these constraints are redundant—the SDK already enforces them. They remain
-- as defense-in-depth for untrusted or multi-source ingestion.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fcp_entity_type') THEN
    CREATE TYPE fcp_entity_type AS ENUM (
      '0', '1', '2', '3', '4', '5', '6', '7', '8', 'e', 'a'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fcp_statement_predicate_type') THEN
    CREATE TYPE fcp_statement_predicate_type AS ENUM ('6', 'e');
  END IF;
END $$;

-- ============================================================================
-- TABLES (DROP + CREATE = clean restart)
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS fcp_statements_identifiers_resolved CASCADE;
DROP TABLE IF EXISTS fcp_statements CASCADE;
DROP TABLE IF EXISTS fcp_raw_identifiers CASCADE;

CREATE TABLE fcp_raw_identifiers (
  identifier_fingerprint CHAR(38) PRIMARY KEY,
  raw_identifier TEXT NOT NULL
);

CREATE TABLE fcp_statements (
  statement_fingerprint CHAR(38) PRIMARY KEY,
  subject_type fcp_entity_type NOT NULL,
  subject_source_type fcp_entity_type NOT NULL,
  subject_fingerprint CHAR(38) NOT NULL,
  predicate_fingerprint CHAR(38) NOT NULL,
  predicate_type fcp_statement_predicate_type NOT NULL,
  predicate_source_type fcp_entity_type NOT NULL,
  object_type fcp_entity_type NOT NULL,
  object_source_type fcp_entity_type NOT NULL,
  object_fingerprint CHAR(38) NOT NULL,
  -- Predicates: only 0x65 (CreativeWork+Product) or 0xe5 (EvaluationMethod+Product)
  CONSTRAINT chk_predicate_source_type CHECK (
    (predicate_type = '6' AND predicate_source_type = '5') OR
    (predicate_type = 'e' AND predicate_source_type = '5')
  ),
  -- No 0xX0 except 0x00: forbid identifying non-Statement entities by Statement (no Person+Statement, etc.)
  CONSTRAINT chk_subject_no_statement_derived CHECK (
    (subject_type = '0' AND subject_source_type = '0') OR
    (subject_type = 'a' AND subject_source_type = 'a') OR
    (subject_type NOT IN ('0', 'a') AND subject_source_type != '0')
  ),
  CONSTRAINT chk_object_no_statement_derived CHECK (
    (object_type = '0' AND object_source_type = '0') OR
    (object_type = 'a' AND object_source_type = 'a') OR
    (object_type NOT IN ('0', 'a') AND object_source_type != '0')
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_raw_identifiers_raw ON fcp_raw_identifiers(raw_identifier);
CREATE INDEX IF NOT EXISTS idx_statements_subject ON fcp_statements(subject_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_predicate ON fcp_statements(predicate_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_object ON fcp_statements(object_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_spo ON fcp_statements(subject_fingerprint, predicate_fingerprint, object_fingerprint);
CREATE INDEX IF NOT EXISTS idx_statements_evaluations_by_subject
  ON fcp_statements(subject_fingerprint, predicate_type)
  WHERE predicate_type = 'e';

-- ============================================================================
-- FINGERPRINT HELPER
-- ============================================================================
CREATE OR REPLACE FUNCTION fcp_calculate_fingerprint(raw_identifier text)
RETURNS text AS $$
BEGIN
  -- Supabase: pgcrypto lives in extensions schema. Matches SDK: SHA-256 last 38 hex chars (UTF-8).
  -- For standard Postgres: enable pgcrypto, then use digest(convert_to(raw_identifier, 'UTF8'), 'sha256') instead.
  RETURN right(encode(extensions.digest(convert_to(raw_identifier, 'UTF8'), 'sha256'), 'hex'), 38);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- MATERIALIZED VIEW
-- ============================================================================
CREATE MATERIALIZED VIEW fcp_statements_identifiers_resolved AS
WITH RECURSIVE
-- Entity-type-specific owl:sameAs evaluation methods
sameas_evaluation_methods AS (
  SELECT ri.identifier_fingerprint
  FROM fcp_raw_identifiers ri
  WHERE ri.raw_identifier IN (
    '{{FIDE_OWL_SAMEAS_PERSON_V1}}',
    '{{FIDE_OWL_SAMEAS_ORGANIZATION_V1}}'
  )
),
sameAs_evaluation_votes AS (
  SELECT
    eval.subject_fingerprint AS sameAs_statement_fp,
    COUNT(*) FILTER (WHERE obj_ident.raw_identifier = '1') AS trust_votes,
    COUNT(*) FILTER (WHERE obj_ident.raw_identifier = '-1') AS reject_votes
  FROM fcp_statements eval
  INNER JOIN sameas_evaluation_methods method ON method.identifier_fingerprint = eval.predicate_fingerprint
  INNER JOIN fcp_raw_identifiers obj_ident ON obj_ident.identifier_fingerprint = eval.object_fingerprint
  WHERE eval.predicate_type = 'e'
  GROUP BY eval.subject_fingerprint
),
trusted_sameAs_statements AS (
  SELECT sameAs_statement_fp, trust_votes, reject_votes, (trust_votes - reject_votes) AS net_trust_score
  FROM sameAs_evaluation_votes
  WHERE trust_votes > 0 AND trust_votes > reject_votes
),
sameAs_edges AS (
  SELECT s.subject_fingerprint AS node_a, s.object_fingerprint AS node_b
  FROM fcp_statements s
  INNER JOIN trusted_sameAs_statements trusted ON trusted.sameAs_statement_fp = s.statement_fingerprint
  INNER JOIN fcp_raw_identifiers pred ON pred.identifier_fingerprint = s.predicate_fingerprint
  WHERE pred.raw_identifier = 'https://www.w3.org/2002/07/owl#sameAs'
  UNION -- Symmetric expansion (A sameAs B implies B sameAs A)
  SELECT s.object_fingerprint AS node_a, s.subject_fingerprint AS node_b
  FROM fcp_statements s
  INNER JOIN trusted_sameAs_statements trusted ON trusted.sameAs_statement_fp = s.statement_fingerprint
  INNER JOIN fcp_raw_identifiers pred ON pred.identifier_fingerprint = s.predicate_fingerprint
  WHERE pred.raw_identifier = 'https://www.w3.org/2002/07/owl#sameAs'
),
flood_fill AS (
  SELECT node_a AS origin, node_b AS member FROM sameAs_edges
  UNION
  SELECT f.origin, e.node_b AS member
  FROM flood_fill f
  INNER JOIN sameAs_edges e ON e.node_a = f.member
),
entity_metadata AS (
  -- Helper to get original type/source for the primary election
  SELECT subject_fingerprint AS entity_fp, subject_type AS entity_type, subject_source_type AS entity_source_type
  FROM fcp_statements
  GROUP BY 1, 2, 3
  UNION
  SELECT object_fingerprint AS entity_fp, object_type AS entity_type, object_source_type AS entity_source_type
  FROM fcp_statements
  GROUP BY 1, 2, 3
),
cluster_primary AS (
  SELECT DISTINCT ON (all_nodes.entity_fp)
    all_nodes.entity_fp,
    all_nodes.member AS primary_fingerprint,
    m.entity_type AS primary_type,
    m.entity_source_type AS primary_source_type
  FROM (
    -- Every reachable node + the node itself
    SELECT origin AS entity_fp, member FROM flood_fill
    UNION
    SELECT entity_fp, entity_fp FROM entity_metadata
  ) all_nodes
  INNER JOIN entity_metadata m ON m.entity_fp = all_nodes.member
  ORDER BY 
    all_nodes.entity_fp, 
    all_nodes.member ASC  -- Primary selection: MIN(fingerprint) from cluster
),
resolved_subjects AS (
  SELECT 
    cp.entity_fp AS subject_fingerprint,
    cp.primary_fingerprint AS resolved_fingerprint,
    cp.primary_type AS resolved_type,
    cp.primary_source_type AS resolved_source_type
  FROM cluster_primary cp
),
resolved_objects AS (
  SELECT 
    cp.entity_fp AS object_fingerprint,
    cp.primary_fingerprint AS resolved_fingerprint,
    cp.primary_type AS resolved_type,
    cp.primary_source_type AS resolved_source_type
  FROM cluster_primary cp
)
SELECT
  s.statement_fingerprint,
  s.subject_type AS subject_type_original,
  rs.resolved_type AS subject_type,
  s.subject_source_type AS subject_source_type_original,
  rs.resolved_source_type AS subject_source_type,
  s.subject_fingerprint AS subject_fingerprint_original,
  rs.resolved_fingerprint AS subject_fingerprint,
  subj_ident_orig.raw_identifier AS subject_raw_identifier_original,
  subj_ident_resolved.raw_identifier AS subject_raw_identifier,
  s.predicate_type,
  s.predicate_source_type,
  s.predicate_fingerprint,
  pred_ident.raw_identifier AS predicate_raw_identifier,
  s.object_type AS object_type_original,
  ro.resolved_type AS object_type,
  s.object_source_type AS object_source_type_original,
  ro.resolved_source_type AS object_source_type,
  s.object_fingerprint AS object_fingerprint_original,
  ro.resolved_fingerprint AS object_fingerprint,
  obj_ident_orig.raw_identifier AS object_raw_identifier_original,
  obj_ident_resolved.raw_identifier AS object_raw_identifier
FROM fcp_statements s
LEFT JOIN resolved_subjects rs ON rs.subject_fingerprint = s.subject_fingerprint
INNER JOIN fcp_raw_identifiers subj_ident_orig ON subj_ident_orig.identifier_fingerprint = s.subject_fingerprint
INNER JOIN fcp_raw_identifiers subj_ident_resolved ON subj_ident_resolved.identifier_fingerprint = rs.resolved_fingerprint
INNER JOIN fcp_raw_identifiers pred_ident ON pred_ident.identifier_fingerprint = s.predicate_fingerprint
LEFT JOIN resolved_objects ro ON ro.object_fingerprint = s.object_fingerprint
INNER JOIN fcp_raw_identifiers obj_ident_orig ON obj_ident_orig.identifier_fingerprint = s.object_fingerprint
INNER JOIN fcp_raw_identifiers obj_ident_resolved ON obj_ident_resolved.identifier_fingerprint = ro.resolved_fingerprint
WHERE s.predicate_fingerprint <> (SELECT fcp_calculate_fingerprint('https://www.w3.org/2002/07/owl#sameAs'));

-- Unique index for CONCURRENT refresh
CREATE UNIQUE INDEX idx_statements_resolved_stmt_fp ON fcp_statements_identifiers_resolved(statement_fingerprint);
CREATE INDEX idx_statements_resolved_subject ON fcp_statements_identifiers_resolved(subject_fingerprint);
CREATE INDEX idx_statements_resolved_object ON fcp_statements_identifiers_resolved(object_fingerprint);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_fcp_statements_identifiers_resolved()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY fcp_statements_identifiers_resolved;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW fcp_statements_identifiers_resolved;
END;
$$;

-- Initial refresh (idempotent)
DO $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY fcp_statements_identifiers_resolved;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW fcp_statements_identifiers_resolved;
END $$;
