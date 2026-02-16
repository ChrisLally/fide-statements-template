-- ============================================================================
-- FCP MATERIALIZED VIEWS - PostgreSQL/Supabase
-- Version: Identifier Resolution Pre-Computation
-- Updated: 2026-02-07
-- ============================================================================
-- Pre-resolves identifier aliases to their primary identifiers (indexer-defined).
-- Eliminates the current 2-phase resolution pattern (fetch fingerprints → resolve)
-- used across 13+ service functions, reducing query complexity from 4-5 database
-- calls down to 1-2 calls.
--
-- Materialized View Architecture:
--   fcp_statements_identifiers_resolved
--   ├─ All resolved subject/predicate/object identifiers + URNs
--   ├─ Excludes meta-predicates (owl:sameAs) to preserve resolution semantics
--   └─ Single source of truth for identifier resolution (no client-side work)
--
-- Regular Views (in fcp-views-supabase.sql):
--   - (attestation view removed; parsed in services)
-- ============================================================================

-- ============================================================================
-- CLEANUP
-- ============================================================================
-- Drop materialized views/functions first so table/enum migrations can run cleanly.
DROP FUNCTION IF EXISTS refresh_fcp_statements_identifiers_resolved() CASCADE;
DROP FUNCTION IF EXISTS fcp_calculate_fingerprint(text) CASCADE;
DROP MATERIALIZED VIEW IF EXISTS fcp_statements_identifiers_resolved CASCADE;

-- ============================================================================
-- FINGERPRINT HELPER
-- ============================================================================
-- Replicates FCP fingerprint logic for SQL contexts:
--   SHA-256(raw_identifier) -> lowercase hex -> last 38 chars (19 bytes)
-- Keeps SQL filtering aligned with SDK/runtime identifier derivation.
CREATE OR REPLACE FUNCTION fcp_calculate_fingerprint(raw_identifier text)
RETURNS text AS $$
BEGIN
  RETURN right(encode(extensions.digest(convert_to(raw_identifier, 'UTF8'), 'sha256'), 'hex'), 38);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- MATERIALIZED VIEW: fcp_statements_identifiers_resolved
-- ============================================================================
-- Pre-resolves all identifiers for rapid entity-centric queries using owl:sameAs consensus.
--
-- Architecture (Critique 21 - Evaluation-Based Trust):
--   1. Trust via evaluations: Only owl:sameAs statements with positive consensus are used
--   2. EvaluationMethod: https://github.com/fide-work/evaluation-methods/alias-resolution-trust (verdict: -1/0/1)
--   3. Evaluator consensus: trust_votes must exceed reject_votes
--   4. Candidate ranking: net trust score first, then trust vote count
--   5. Lexical tie-break: Deterministic selection within same consensus score
--   6. No fcp_alias_resolution table: Trust defined by evaluation statements
--
-- Key Features:
--   1. Trust via evaluations: Only owl:sameAs with trust_votes > reject_votes are used
--   2. Evaluator consensus: Prefer resolutions with higher net trust score
--   3. Subjects/Objects resolved (source_type becomes '0' when resolved to primary)
--   4. Predicates NEVER resolved (always human-readable, required for logic)
--   5. Excludes owl:sameAs statements to prevent circular logic
--   6. This view serves as lookup table for primary entity IDs
--   7. EvaluationMethod: https://github.com/fide-work/evaluation-methods/alias-resolution-trust (published to graph)
--
-- Column Structure (ALL COLUMNS NOT NULL):
--   statement_fingerprint: 38-char reference back to fcp_statements
--
--   Subject (original):
--     subject_source_type_original: Original source type from fcp_statements (before resolution)
--     subject_fingerprint_original: Original fingerprint from fcp_statements (before resolution)
--     subject_raw_identifier_original: Original human-readable identifier (before resolution)
--
--   Subject (resolved):
--     subject_source_type: Resolved source type ('0' if resolved via owl:sameAs, else equals original)
--     subject_fingerprint: Resolved fingerprint (after owl:sameAs resolution, equals original if not resolved)
--     subject_raw_identifier: Resolved human-readable identifier (equals original if not resolved)
--
--   Predicate (never resolved):
--     predicate_type: '6' for attributes/relationships, 'e' for evaluations
--     predicate_source_type: Source type for predicate (typically '6' for string identifiers)
--     predicate_fingerprint: 38-char fingerprint
--     predicate_raw_identifier: Human-readable predicate (e.g., 'schema:name', 'Fide-ClaimAccuracy-v1')
--
--   Object (original):
--     object_source_type_original: Original source type from fcp_statements (before resolution)
--     object_fingerprint_original: Original fingerprint from fcp_statements (before resolution)
--     object_raw_identifier_original: Original human-readable identifier (before resolution)
--
--   Object (resolved):
--     object_source_type: Resolved source type ('0' if resolved via owl:sameAs, else equals original)
--     object_fingerprint: Resolved fingerprint (after owl:sameAs resolution, equals original if not resolved)
--     object_raw_identifier: Resolved human-readable identifier (equals original if not resolved)
--
--   All columns enforced NOT NULL: statements always have complete S-P-O triples
--   rawIdentifiers are human-readable or Primary Fide IDs (e.g., Statement IDs for primaries)
CREATE MATERIALIZED VIEW fcp_statements_identifiers_resolved AS
WITH alias_method_ids AS (
  -- Build alias + primary EvaluationMethod IDs for alias-resolution-trust.
  -- Alias form:   0xe5<fingerprint(url)>
  -- Primary form: 0xe0<fingerprint(0x00<genesis_statement_fingerprint>)>
  SELECT
    fcp_calculate_fingerprint('https://github.com/fide-work/evaluation-methods/alias-resolution-trust/v1') AS alias_fp,
    fcp_calculate_fingerprint('0x00' || name_stmt.statement_fingerprint) AS primary_fp,
    '0x00' || name_stmt.statement_fingerprint AS genesis_stmt_id
  FROM fcp_statements name_stmt
  INNER JOIN fcp_raw_identifiers subj_ident
    ON subj_ident.identifier_fingerprint = name_stmt.subject_fingerprint
  INNER JOIN fcp_raw_identifiers pred_ident
    ON pred_ident.identifier_fingerprint = name_stmt.predicate_fingerprint
  INNER JOIN fcp_raw_identifiers obj_ident
    ON obj_ident.identifier_fingerprint = name_stmt.object_fingerprint
  WHERE subj_ident.raw_identifier = 'https://github.com/fide-work/evaluation-methods/alias-resolution-trust/v1'
    AND pred_ident.raw_identifier = 'schema:name'
    AND obj_ident.raw_identifier = 'Fide-AliasResolutionTrust-v1'
  LIMIT 1
),
alias_resolution_method_predicates AS (
  -- Accept all common rawIdentifier spellings for the method predicate:
  -- - URL forms (with /v1 suffix matching vocab.ts METHOD_ALIAS_RESOLUTION_TRUST)
  -- - 0xe5 alias forms (Product-sourced EvaluationMethod)
  -- - 0xe0 primary forms (Statement-derived EvaluationMethod)
  -- - 0x00 genesis forms (Statement ID, used as predicate in evaluations)
  SELECT ri.identifier_fingerprint
  FROM fcp_raw_identifiers ri
  CROSS JOIN alias_method_ids m
  WHERE ri.raw_identifier IN (
    'https://github.com/fide-work/evaluation-methods/alias-resolution-trust/v1',
    'did:fide:0xe5' || m.alias_fp,
    '0xe5' || m.alias_fp,
    'did:fide:0xe0' || m.primary_fp,
    '0xe0' || m.primary_fp,
    'did:fide:' || m.genesis_stmt_id,
    m.genesis_stmt_id
  )
),
sameAs_evaluation_votes AS (
  -- Aggregate trust/reject votes for each owl:sameAs Statement ID.
  -- Evaluation statement format:
  --   subject:   owl:sameAs Statement ID being evaluated
  --   predicate: alias-resolution-trust EvaluationMethod
  --   object:    verdict literal ("1" = trust, "-1" = reject, "0" = uncertain)
  SELECT
    eval.subject_fingerprint AS sameAs_statement_fp,
    COUNT(*) FILTER (WHERE obj_ident.raw_identifier = '1') AS trust_votes,
    COUNT(*) FILTER (WHERE obj_ident.raw_identifier = '-1') AS reject_votes
  FROM fcp_statements eval
  INNER JOIN alias_resolution_method_predicates method_pred
    ON method_pred.identifier_fingerprint = eval.predicate_fingerprint
  INNER JOIN fcp_raw_identifiers obj_ident
    ON obj_ident.identifier_fingerprint = eval.object_fingerprint
  WHERE eval.predicate_type = 'e'
  GROUP BY eval.subject_fingerprint
),
trusted_sameAs_statements AS (
  -- Positive consensus: trust votes exceed reject votes.
  SELECT
    sameAs_statement_fp,
    trust_votes,
    reject_votes,
    (trust_votes - reject_votes) AS net_trust_score
  FROM sameAs_evaluation_votes
  WHERE trust_votes > 0
    AND trust_votes > reject_votes
),
owl_sameAs_resolutions AS (
  -- Resolve entities via trusted owl:sameAs statements
  -- For each subject, pick one resolved object by consensus score.
  SELECT
    s.subject_fingerprint,
    s.subject_type,
    s.subject_source_type,
    s.object_fingerprint as resolved_to_fingerprint,
    trusted.trust_votes,
    trusted.reject_votes,
    trusted.net_trust_score,
    ROW_NUMBER() OVER (
      PARTITION BY s.subject_fingerprint
      ORDER BY
        trusted.net_trust_score DESC,
        trusted.trust_votes DESC,
        s.object_fingerprint ASC  -- Lexical tie-break (deterministic)
    ) as resolution_rank
  FROM fcp_statements s
  INNER JOIN trusted_sameAs_statements trusted
    ON trusted.sameAs_statement_fp = s.statement_fingerprint
  INNER JOIN fcp_raw_identifiers s_pred_ident
    ON s_pred_ident.identifier_fingerprint = s.predicate_fingerprint
  WHERE s_pred_ident.raw_identifier = 'owl:sameAs'
),
resolved_subjects AS (
  -- Entities resolved via owl:sameAs (best resolution only)
  SELECT
    subject_fingerprint,
    subject_type,
    '0'::fcp_entity_type as resolved_source_type,
    resolved_to_fingerprint as resolved_fingerprint
  FROM owl_sameAs_resolutions
  WHERE resolution_rank = 1

  UNION ALL

  -- Entities with no owl:sameAs resolve to themselves
  SELECT
    s.subject_fingerprint,
    s.subject_type,
    s.subject_source_type,
    s.subject_fingerprint
  FROM fcp_statements s
  WHERE NOT EXISTS (
    SELECT 1 FROM owl_sameAs_resolutions o WHERE o.subject_fingerprint = s.subject_fingerprint
  )
  GROUP BY s.subject_fingerprint, s.subject_type, s.subject_source_type
),
resolved_objects AS (
  -- Objects resolved via owl:sameAs (if object appears as subject in resolutions)
  SELECT DISTINCT
    s.object_fingerprint,
    s.object_type,
    '0'::fcp_entity_type as resolved_source_type,
    res.resolved_to_fingerprint as resolved_fingerprint
  FROM fcp_statements s
  INNER JOIN owl_sameAs_resolutions res
    ON res.subject_fingerprint = s.object_fingerprint
    AND res.resolution_rank = 1
  WHERE s.object_fingerprint IS NOT NULL

  UNION ALL

  -- Objects with no owl:sameAs resolve to themselves
  SELECT DISTINCT
    s.object_fingerprint,
    s.object_type,
    s.object_source_type,
    s.object_fingerprint
  FROM fcp_statements s
  WHERE s.object_fingerprint IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM owl_sameAs_resolutions o WHERE o.subject_fingerprint = s.object_fingerprint
  )
)

SELECT
  -- Statement reference
  s.statement_fingerprint,

  -- Subject: Original + Resolved source type, fingerprints, and rawIdentifiers for provenance tracking
  s.subject_type,
  s.subject_source_type AS subject_source_type_original,
  rs.resolved_source_type AS subject_source_type,
  s.subject_fingerprint AS subject_fingerprint_original,
  rs.resolved_fingerprint AS subject_fingerprint,
  subj_ident_orig.raw_identifier AS subject_raw_identifier_original,
  subj_ident_resolved.raw_identifier AS subject_raw_identifier,

  -- Predicate: Keep rawIdentifier human-readable (don't resolve predicates)
  s.predicate_type,
  s.predicate_source_type AS predicate_source_type,
  s.predicate_fingerprint,
  pred_ident.raw_identifier AS predicate_raw_identifier,

  -- Object: Original + Resolved source type, fingerprints, and rawIdentifiers for provenance tracking
  s.object_type,
  s.object_source_type AS object_source_type_original,
  ro.resolved_source_type AS object_source_type,
  s.object_fingerprint AS object_fingerprint_original,
  ro.resolved_fingerprint AS object_fingerprint,
  obj_ident_orig.raw_identifier AS object_raw_identifier_original,
  obj_ident_resolved.raw_identifier AS object_raw_identifier

FROM fcp_statements s

-- Subject resolution
LEFT JOIN resolved_subjects rs
  ON rs.subject_fingerprint = s.subject_fingerprint
INNER JOIN fcp_raw_identifiers subj_ident_orig
  ON subj_ident_orig.identifier_fingerprint = s.subject_fingerprint
INNER JOIN fcp_raw_identifiers subj_ident_resolved
  ON subj_ident_resolved.identifier_fingerprint = rs.resolved_fingerprint

-- Predicate (never resolved, always human-readable)
INNER JOIN fcp_raw_identifiers pred_ident
  ON pred_ident.identifier_fingerprint = s.predicate_fingerprint

-- Object resolution
LEFT JOIN resolved_objects ro
  ON ro.object_fingerprint = s.object_fingerprint
INNER JOIN fcp_raw_identifiers obj_ident_orig
  ON obj_ident_orig.identifier_fingerprint = s.object_fingerprint
INNER JOIN fcp_raw_identifiers obj_ident_resolved
  ON obj_ident_resolved.identifier_fingerprint = ro.resolved_fingerprint

-- CRITICAL: Exclude owl:sameAs statements from this view
-- These are meta-predicates that define the resolution graph itself
WHERE s.predicate_fingerprint NOT IN (
  fcp_calculate_fingerprint('owl:sameAs')
);

-- ============================================================================
-- COLUMN NULLABILITY (ENFORCED BY QUERY STRUCTURE)
-- ============================================================================
-- FCP PROTOCOL REQUIREMENT: All statements have complete S-P-O triples (no nulls).
--
-- PostgreSQL does not support ALTER COLUMN ... SET NOT NULL on materialized views.
-- Instead, NOT NULL is enforced by the query structure:
--   - All fingerprints come from fcp_statements (schema enforces NOT NULL)
--   - All rawIdentifiers (`raw_identifier`) resolved via INNER JOIN (no nulls possible)
--   - All type/source_type fields from fcp_statements (schema enforces NOT NULL)
--
-- Note: Supabase type generation may still infer `| null` for materialized view columns.
-- This is a PostgreSQL/Supabase limitation. Service layer should treat these as NOT NULL
-- since the query structure guarantees no nulls will be present.

-- ============================================================================
-- INDEXES FOR MATERIALIZED VIEW
-- ============================================================================
-- Unique index enables CONCURRENT refresh (zero-downtime)
CREATE UNIQUE INDEX idx_statements_resolved_stmt_fp
  ON fcp_statements_identifiers_resolved(statement_fingerprint);

-- Entity-centric queries (most common)
CREATE INDEX idx_statements_resolved_subject
  ON fcp_statements_identifiers_resolved(subject_fingerprint);

CREATE INDEX idx_statements_resolved_object
  ON fcp_statements_identifiers_resolved(object_fingerprint);

-- Predicate filtering by rawIdentifier pattern (e.g., 'did:fide:0xe%')
CREATE INDEX idx_statements_resolved_predicate_urn
  ON fcp_statements_identifiers_resolved(predicate_raw_identifier);

-- Combined index for entity + predicate queries
CREATE INDEX idx_statements_resolved_subj_pred
  ON fcp_statements_identifiers_resolved(
    subject_fingerprint,
    predicate_raw_identifier
  );

-- Type filtering (attributes vs relationships)
CREATE INDEX idx_statements_resolved_object_type
  ON fcp_statements_identifiers_resolved(object_type);

-- ============================================================================
-- INDEXES FOR EVALUATION-BASED RESOLUTION (fcp_statements table)
-- ============================================================================
-- These indexes support the evaluation-based resolution CTEs used in the materialized view
-- Created in fcp-tables-supabase.sql but documented here for clarity
--
-- Index: Evaluation method queries (alias-resolution-trust)
-- This index accelerates the trusted_sameAs_statements CTE:
--   JOIN fcp_raw_identifiers pred_ident ON pred_ident.identifier_fingerprint = fcp_statements.predicate_fingerprint
--   WHERE pred_ident.raw_identifier = 'https://github.com/fide-work/evaluation-methods/alias-resolution-trust'
-- Should be created in main tables migration:
--   CREATE INDEX idx_statements_predicate
--     ON fcp_statements(predicate_fingerprint);
--   CREATE INDEX idx_statements_object
--     ON fcp_statements(object_fingerprint);
--
-- Index: owl:sameAs predicate queries
-- This index accelerates the owl_sameAs_resolutions CTE:
--   JOIN fcp_raw_identifiers pred_ident ON pred_ident.identifier_fingerprint = fcp_statements.predicate_fingerprint
--   WHERE pred_ident.raw_identifier = 'owl:sameAs'
-- Should be created in main tables migration:
--   CREATE INDEX idx_statements_predicate
--     ON fcp_statements(predicate_fingerprint);
--
-- Note: No prov_attestations join needed - we count evaluators, not signers

-- ============================================================================
-- MATERIALIZED VIEW COMMENTS
-- ============================================================================
COMMENT ON MATERIALIZED VIEW fcp_statements_identifiers_resolved IS
'Pre-resolved statements with evaluation-based identity resolution (Critique 21).
Trust model: owl:sameAs statements require positive consensus (trust_votes > reject_votes) under https://github.com/fide-work/evaluation-methods/alias-resolution-trust.
Resolution: rank candidates by net trust score, then trust vote count, then lexical tie-break.
No fcp_alias_resolution table: Trust defined by evaluation statements in the graph.
Predicates NEVER resolved (always human-readable). Excludes owl:sameAs (meta-predicates).
ALL COLUMNS NOT NULL: FCP protocol requires complete S-P-O triples (no nulls).
This view serves as the lookup table for primary entity IDs. Applications can query evaluations to understand trust decisions.';

COMMENT ON COLUMN fcp_statements_identifiers_resolved.statement_fingerprint IS '38-char reference to fcp_statements';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_type IS '1-char entity type';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_source_type_original IS '1-char original source type from fcp_statements (before owl:sameAs resolution) - for provenance tracking';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_source_type IS '1-char resolved source type: "0" if resolved to a primary (Statement-derived) identifier, else equals original';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_fingerprint_original IS '38-char original fingerprint from fcp_statements (before owl:sameAs resolution) - for provenance tracking';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_fingerprint IS '38-char resolved fingerprint (after owl:sameAs resolution, equals original if not resolved)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_raw_identifier_original IS 'Human-readable identifier of the original entity (before owl:sameAs resolution) - for provenance tracking';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.subject_raw_identifier IS 'Human-readable identifier of the resolved entity (after owl:sameAs resolution, equals original if not resolved)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.predicate_type IS '"6" for attributes/relationships, "e" for evaluations (enables zero-lookup reputation queries)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.predicate_source_type IS '1-char source type for the predicate rawIdentifier (typically "6" for string identifiers)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.predicate_fingerprint IS '38-char fingerprint (resolved if alias)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.predicate_raw_identifier IS 'Predicate identifier (e.g., "schema:name", "sec:controller", "Fide-ClaimAccuracy-v1")';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_type IS '1-char entity type';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_source_type_original IS '1-char original source type from fcp_statements (before owl:sameAs resolution) - for provenance tracking';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_source_type IS '1-char resolved source type: "0" if resolved to a primary (Statement-derived) identifier, else equals original';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_fingerprint_original IS '38-char original fingerprint from fcp_statements (before owl:sameAs resolution) - for provenance tracking';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_fingerprint IS '38-char resolved fingerprint (after owl:sameAs resolution, equals original if not resolved)';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_raw_identifier_original IS 'Human-readable identifier of the original entity (before owl:sameAs resolution) - for provenance tracking';
COMMENT ON COLUMN fcp_statements_identifiers_resolved.object_raw_identifier IS 'Human-readable identifier of the resolved entity (after owl:sameAs resolution, equals original if not resolved)';

-- ============================================================================
-- REFRESH FUNCTION
-- ============================================================================
-- Refreshes the materialized view with zero-downtime using CONCURRENT mode.
-- Requires the UNIQUE index on statement_fingerprint.
CREATE OR REPLACE FUNCTION refresh_fcp_statements_identifiers_resolved()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use CONCURRENT refresh for zero-downtime (requires UNIQUE index)
  REFRESH MATERIALIZED VIEW CONCURRENTLY fcp_statements_identifiers_resolved;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to non-concurrent refresh if concurrent fails
    RAISE NOTICE 'CONCURRENT refresh failed, falling back to standard refresh: %', SQLERRM;
    REFRESH MATERIALIZED VIEW fcp_statements_identifiers_resolved;
END;
$$;

COMMENT ON FUNCTION refresh_fcp_statements_identifiers_resolved() IS
'Refreshes fcp_statements_identifiers_resolved materialized view.
Uses CONCURRENT refresh to avoid blocking queries.
Call after indexing new statements or updating identifier resolutions.
Example: SELECT refresh_fcp_statements_identifiers_resolved();';

-- ============================================================================
-- INITIAL REFRESH
-- ============================================================================
-- Uncomment this line to populate the view after creation
-- SELECT refresh_fcp_statements_identifiers_resolved();

-- ============================================================================
-- POST-MIGRATION REFRESH
-- ============================================================================
-- After schema integrity enforcement (backfill of predicate_type/predicate_source_type),
-- refresh the materialized view to ensure all resolved statements have the updated values.
-- This is safe to run even if no backfill occurred (idempotent).
DO $$
BEGIN
  RAISE NOTICE 'Refreshing fcp_statements_identifiers_resolved materialized view...';
  REFRESH MATERIALIZED VIEW CONCURRENTLY fcp_statements_identifiers_resolved;
  RAISE NOTICE 'Materialized view refresh complete.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Materialized view refresh skipped (view may not exist yet or concurrent refresh unavailable): %', SQLERRM;
END $$;
