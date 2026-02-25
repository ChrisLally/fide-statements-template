import type { ComponentContext, ComponentMetricDraft } from "../shared.js";
import { collectUniqueStatementIds, normalizeText } from "../shared.js";

const PREDICATE_SCHEMA_NAME = "https://schema.org/name";

export function metricNameAlignment(ctx: ComponentContext): ComponentMetricDraft {
  const namesA = ctx.statements.filter(
    (s) =>
      s.subjectFideId === ctx.target.subjectFideId &&
      s.predicateRawIdentifier === PREDICATE_SCHEMA_NAME
  );
  const namesB = ctx.statements.filter(
    (s) =>
      s.subjectFideId === ctx.target.objectFideId &&
      s.predicateRawIdentifier === PREDICATE_SCHEMA_NAME
  );

  const setA = new Set(namesA.map((s) => normalizeText(s.objectRawIdentifier)).filter(Boolean));
  const setB = new Set(namesB.map((s) => normalizeText(s.objectRawIdentifier)).filter(Boolean));
  const overlap = [...setA].filter((name) => setB.has(name));

  const evidence = collectUniqueStatementIds([
    ...namesA.map((s) => s.statementFideId),
    ...namesB.map((s) => s.statementFideId),
  ]);

  if (setA.size === 0 && setB.size === 0) {
    return {
      key: "name_alignment",
      label: "Name Alignment",
      score: 0,
      evidenceStatementFideIds: evidence,
      reason: "No comparable schema:name statements found for either side.",
    };
  }

  if (overlap.length > 0) {
    return {
      key: "name_alignment",
      label: "Name Alignment",
      score: 1,
      evidenceStatementFideIds: evidence,
      reason: `Overlapping schema:name value found (${overlap[0]}).`,
    };
  }

  if (setA.size > 0 && setB.size > 0) {
    return {
      key: "name_alignment",
      label: "Name Alignment",
      score: -1,
      evidenceStatementFideIds: evidence,
      reason: "Both sides have schema:name values but none overlap.",
    };
  }

  return {
    key: "name_alignment",
    label: "Name Alignment",
    score: -0.2,
    evidenceStatementFideIds: evidence,
    reason: "Only one side has schema:name evidence.",
  };
}
