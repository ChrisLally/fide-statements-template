import type { ComponentContext, ComponentMetricDraft } from "../shared.js";
import { collectUniqueStatementIds } from "../shared.js";

const PERSON_AFFILIATION_PREDICATES = new Set([
  "https://schema.org/worksFor",
  "https://schema.org/memberOf",
  "https://schema.org/affiliation",
]);

export function metricAffiliationOverlap(ctx: ComponentContext): ComponentMetricDraft {
  const relA = ctx.statements.filter(
    (s) =>
      s.subjectFideId === ctx.target.subjectFideId &&
      PERSON_AFFILIATION_PREDICATES.has(s.predicateRawIdentifier)
  );
  const relB = ctx.statements.filter(
    (s) =>
      s.subjectFideId === ctx.target.objectFideId &&
      PERSON_AFFILIATION_PREDICATES.has(s.predicateRawIdentifier)
  );

  const setA = new Set(relA.map((s) => s.objectFideId));
  const setB = new Set(relB.map((s) => s.objectFideId));
  const overlap = [...setA].filter((value) => setB.has(value));
  const evidence = collectUniqueStatementIds([
    ...relA.map((s) => s.statementFideId),
    ...relB.map((s) => s.statementFideId),
  ]);

  if (setA.size === 0 && setB.size === 0) {
    return {
      key: "affiliation_overlap",
      label: "Affiliation Overlap",
      score: 0,
      evidenceStatementFideIds: evidence,
      reason: "No affiliation predicates found for either side.",
    };
  }

  if (overlap.length > 0) {
    return {
      key: "affiliation_overlap",
      label: "Affiliation Overlap",
      score: 0.8,
      evidenceStatementFideIds: evidence,
      reason: "Shared affiliation target found between both sides.",
    };
  }

  if (setA.size > 0 && setB.size > 0) {
    return {
      key: "affiliation_overlap",
      label: "Affiliation Overlap",
      score: -0.6,
      evidenceStatementFideIds: evidence,
      reason: "Affiliation evidence exists on both sides with no overlap.",
    };
  }

  return {
    key: "affiliation_overlap",
    label: "Affiliation Overlap",
    score: -0.1,
    evidenceStatementFideIds: evidence,
    reason: "Affiliation evidence exists only on one side.",
  };
}
