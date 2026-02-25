import type { ComponentContext, ComponentMetricDraft } from "../shared.js";
import { collectUniqueStatementIds } from "../shared.js";

const PREDICATE_OWL_DIFFERENT_FROM = "https://www.w3.org/2002/07/owl#differentFrom";

export function metricContradiction(ctx: ComponentContext): ComponentMetricDraft {
  const contradictions = ctx.statements.filter(
    (s) =>
      s.predicateRawIdentifier === PREDICATE_OWL_DIFFERENT_FROM &&
      ((s.subjectFideId === ctx.target.subjectFideId &&
        s.objectFideId === ctx.target.objectFideId) ||
        (s.subjectFideId === ctx.target.objectFideId &&
          s.objectFideId === ctx.target.subjectFideId))
  );

  if (contradictions.length > 0) {
    return {
      key: "explicit_contradiction",
      label: "Explicit Contradiction",
      score: -1,
      evidenceStatementFideIds: collectUniqueStatementIds(
        contradictions.map((s) => s.statementFideId)
      ),
      reason: "Found explicit owl:differentFrom contradiction for the same pair.",
    };
  }

  return {
    key: "explicit_contradiction",
    label: "Explicit Contradiction",
    score: 0,
    evidenceStatementFideIds: [],
    reason: "No explicit contradiction found.",
  };
}
