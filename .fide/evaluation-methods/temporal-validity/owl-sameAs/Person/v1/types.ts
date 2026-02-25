import type { FideIdStatement } from "../../../../../types.js";
export type { FideIdStatement } from "../../../../../types.js";

export type IdentityDecision = "same" | "uncertain" | "different";

export type EvaluationSubMetric = {
  key: string;
  label: string;
  score: number;
  weight: number;
  contribution: number;
  evidenceStatementFideIds: string[];
  reason: string;
};

export type EvaluateSameAsInput = {
  targetSameAsStatementFideId: string;
  statements: FideIdStatement[];
};

export type EvaluateSameAsResult = {
  targetSameAsStatementFideId: string;
  sameAsStatement: FideIdStatement | null;
  validFromStatements: FideIdStatement[];
  validThroughStatements: FideIdStatement[];
  citationStatementsByValidFrom: Record<string, FideIdStatement[]>;
  citationStatementsByValidThrough: Record<string, FideIdStatement[]>;
  hasValidFromEvidence: boolean;
  hasValidThroughEvidence: boolean;
  hasCitationForEveryValidFrom: boolean;
  hasCitationForEveryValidThrough: boolean;
  validityIntervals: Array<{
    validFromStatementFideId: string | null;
    validFrom: string | null;
    validThroughStatementFideId: string | null;
    validThrough: string | null;
    status: "active" | "expired" | "future" | "open_ended" | "invalid";
  }>;
  hasAnyValidInterval: boolean;
  decision: IdentityDecision;
  score: number;
  confidence: number;
  reviewRequired: boolean;
  subMetrics: EvaluationSubMetric[];
  evidenceStatementFideIds: string[];
  positiveEvidenceCount: number;
  negativeEvidenceCount: number;
};
