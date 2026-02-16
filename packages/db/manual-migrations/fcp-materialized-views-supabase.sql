-- ============================================================================
-- FCP MATERIALIZED VIEWS - PostgreSQL/Supabase
-- Version: Identifier Resolution Pre-Computation (No EvaluationMethod Dependency)
-- Updated: 2026-02-16
-- ============================================================================
-- Current model:
-- - Materialized view provides a resolved statement projection.
-- - Predicate rows remain human-readable via raw identifier lookup.
-- - owl:sameAs rows are excluded from the projection (meta-resolution statements).
-- - Resolved fields currently mirror original fields (no consensus trust layer here).

-- ============================================================================
-- CLEANUP
-- ============================================================================
DROP FUNCTION IF EXISTS refresh_fcp_statements_identifiers_resolved() CASCADE;
DROP FUNCTION IF EXISTS fcp_calculate_fingerprint(text) CASCADE;
DROP MATERIALIZED VIEW IF EXISTS fcp_statements_identifiers_resolved CASCADE;

-- ============================================================================
-- MATERIALIZED VIEW: fcp_statements_identifiers_resolved
-- ============================================================================
CREATE MATERIALIZED VIEW fcp_statements_identifiers_resolved AS
SELECT
  -- Statement reference
  s.statement_fingerprint,

  -- Subject: original + resolved (currently identical)
  s.subject_type,
  s.subject_source_type AS subject_source_type_original,
  s.subject_source_type AS subject_source_type,
  s.subject_fingerprint AS subject_fingerprint_original,
  s.subject_fingerprint AS subject_fingerprint,
  subj_ident.raw_identifier AS subject_raw_identifier_original,
  subj_ident.raw_identifier AS subject_raw_identifier,

  -- Predicate: never resolved
  s.predicate_type,
  s.predicate_source_type,
  s.predicate_fingerprint,
  pred_ident.raw_identifier AS predicate_raw_identifier,

  -- Object: original + resolved (currently identical)
  s.object_type,
  s.object_source_type AS object_source_type_original,
  s.object_source_type AS object_source_type,
  s.object_fingerprint AS object_fingerprint_original,
  s.object_fingerprint AS object_fingerprint,
  obj_ident.raw_identifier AS object_raw_identifier_original,
  obj_ident.raw_identifier AS object_raw_identifier
FROM fcp_statements s
INNER JOIN fcp_raw_identifiers subj_ident
  ON subj_ident.identifier_fingerprint = s.subject_fingerprint
INNER JOIN fcp_raw_identifiers pred_ident
  ON pred_ident.identifier_fingerprint = s.predicate_fingerprint
INNER JOIN fcp_raw_identifiers obj_ident
  ON obj_ident.identifier_fingerprint = s.object_fingerprint
WHERE pred_ident.raw_identifier <> 'owl:sameAs';

-- ============================================================================
-- INDEXES FOR MATERIALIZED VIEW
-- ============================================================================
-- Unique index enables CONCURRENT refresh (zero-downtime)
CREATE UNIQUE INDEX idx_statements_resolved_stmt_fp
  ON fcp_statements_identifiers_resolved(statement_fingerprint);

-- Entity-centric queries
CREATE INDEX idx_statements_resolved_subject
  ON fcp_statements_identifiers_resolved(subject_fingerprint);

CREATE INDEX idx_statements_resolved_object
  ON fcp_statements_identifiers_resolved(object_fingerprint);

-- Predicate filtering
CREATE INDEX idx_statements_resolved_predicate_urn
  ON fcp_statements_identifiers_resolved(predicate_raw_identifier);

-- Combined entity + predicate filtering
CREATE INDEX idx_statements_resolved_subj_pred
  ON fcp_statements_identifiers_resolved(
    subject_fingerprint,
    predicate_raw_identifier
  );

-- Object type filtering
CREATE INDEX idx_statements_resolved_object_type
  ON fcp_statements_identifiers_resolved(object_type);

-- ============================================================================
-- MATERIALIZED VIEW COMMENTS
-- ============================================================================
COMMENT ON MATERIALIZED VIEW fcp_statements_identifiers_resolved IS
'Pre-resolved statements projection. Predicates remain human-readable. owl:sameAs rows are excluded from this view. Resolved fields currently mirror original fields.';

COMMENT ON COLUMN fcp_statements_identifiers_resolved.statement_fingerprint IS '38-char reference to fcp_statements';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_type IS '1-char entity type';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_source_type_original IS 'Original source type from fcp_statements';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_source_type IS 'Resolved source type (currently same as original)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_fingerprint_original IS 'Original subject fingerprint from fcp_statements';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_fingerprint IS 'Resolved subject fingerprint (currently same as original)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_raw_identifier_original IS 'Original subject raw identifier';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_raw_identifier IS 'Resolved subject raw identifier (currently same as original)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.predicate_type IS 'Predicate semantic category (currently "6")';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.predicate_source_type IS 'Predicate source type (currently "5")';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.predicate_fingerprint IS 'Predicate fingerprint';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.predicate_raw_identifier IS 'Predicate raw identifier (for example https://schema.org/name)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_type IS '1-char entity type';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_source_type_original IS 'Original object source type from fcp_statements';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_source_type IS 'Resolved object source type (currently same as original)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_fingerprint_original IS 'Original object fingerprint from fcp_statements';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_fingerprint IS 'Resolved object fingerprint (currently same as original)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_raw_identifier_original IS 'Original object raw identifier';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_raw_identifier IS 'Resolved object raw identifier (currently same as original)';

-- ============================================================================
-- REFRESH FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_fcp_statements_identifiers_resolved()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY fcp_statements_identifiers_resolved;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'CONCURRENT refresh failed, falling back to standard refresh: %', SQLERRM;
    REFRESH MATERIALIZED VIEW fcp_statements_identifiers_resolved;
END;
$$;

COMMENT ON FUNCTION refresh_fcp_statements_identifiers_resolved() IS
'Refreshes fcp_statements_identifiers_resolved materialized view with concurrent fallback.';

-- ============================================================================
-- POST-MIGRATION REFRESH
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Refreshing fcp_statements_identifiers_resolved materialized view...';
  REFRESH MATERIALIZED VIEW CONCURRENTLY fcp_statements_identifiers_resolved;
  RAISE NOTICE 'Materialized view refresh complete.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Materialized view refresh skipped (view may not exist yet or concurrent refresh unavailable): %', SQLERRM;
END $$;
