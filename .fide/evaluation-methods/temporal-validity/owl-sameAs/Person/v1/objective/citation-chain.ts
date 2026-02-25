import type { ComponentContext, ComponentMetricDraft } from "../shared.js";
import { collectUniqueStatementIds } from "../shared.js";

export function metricCitationChain(ctx: ComponentContext): ComponentMetricDraft {
  const evidence = collectUniqueStatementIds([
    ...ctx.validFromStatements.map((s) => s.statementFideId),
    ...Object.values(ctx.citationStatementsByValidFrom)
      .flat()
      .map((s) => s.statementFideId),
  ]);

  if (ctx.hasCitationForEveryValidFrom) {
    return {
      key: "citation_chain",
      label: "Citation Chain Completeness",
      score: 1,
      evidenceStatementFideIds: evidence,
      reason: "Every validFrom statement has at least one citation.",
    };
  }

  if (ctx.hasValidFromEvidence) {
    return {
      key: "citation_chain",
      label: "Citation Chain Completeness",
      score: -0.5,
      evidenceStatementFideIds: evidence,
      reason: "Some validFrom statements are missing citation support.",
    };
  }

  return {
    key: "citation_chain",
    label: "Citation Chain Completeness",
    score: -0.2,
    evidenceStatementFideIds: evidence,
    reason: "No validFrom/citation chain found for this statement.",
  };
}
