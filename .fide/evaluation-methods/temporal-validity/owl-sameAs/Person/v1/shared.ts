import type { FideIdStatement, EvaluationSubMetric } from "./types.js";

export type ComponentContext = {
  target: FideIdStatement;
  statements: FideIdStatement[];
  validFromStatements: FideIdStatement[];
  citationStatementsByValidFrom: Record<string, FideIdStatement[]>;
  hasValidFromEvidence: boolean;
  hasCitationForEveryValidFrom: boolean;
};

export type ComponentMetricDraft = Omit<EvaluationSubMetric, "weight" | "contribution">;

export { collectUniqueStatementIds, normalizeText } from "../../../utils.js";
