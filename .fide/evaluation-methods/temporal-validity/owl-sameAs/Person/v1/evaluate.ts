import { buildStatementRawIdentifier } from "@chris-test/fcp";
import type {
  FideIdStatement,
  IdentityDecision,
  EvaluationSubMetric,
  EvaluateSameAsInput,
  EvaluateSameAsResult,
} from "./types.js";
import { SUB_METHOD_WEIGHTS } from "./policy.js";
import type { ComponentMetricDraft } from "./shared.js";
import { metricCitationChain } from "./objective/citation-chain.js";
import { metricContradiction } from "./objective/explicit-contradiction.js";
import { metricNameAlignment } from "./heuristic/name-alignment.js";
import { metricAffiliationOverlap } from "./heuristic/affiliation-overlap.js";

const PREDICATE_OWL_SAME_AS = "https://www.w3.org/2002/07/owl#sameAs";
const PREDICATE_SCHEMA_VALID_FROM = "https://schema.org/validFrom";
const PREDICATE_SCHEMA_VALID_THROUGH = "https://schema.org/validThrough";
const PREDICATE_PROV_HAD_PRIMARY_SOURCE = "https://www.w3.org/ns/prov#hadPrimarySource";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function defaultResult(targetSameAsStatementFideId: string): EvaluateSameAsResult {
  return {
    targetSameAsStatementFideId,
    sameAsStatement: null,
    validFromStatements: [],
    validThroughStatements: [],
    citationStatementsByValidFrom: {},
    citationStatementsByValidThrough: {},
    hasValidFromEvidence: false,
    hasValidThroughEvidence: false,
    hasCitationForEveryValidFrom: false,
    hasCitationForEveryValidThrough: false,
    validityIntervals: [],
    hasAnyValidInterval: false,
    decision: "uncertain",
    score: 0.5,
    confidence: 0,
    reviewRequired: true,
    subMetrics: [],
    evidenceStatementFideIds: [],
    positiveEvidenceCount: 0,
    negativeEvidenceCount: 0,
  };
}

function statementRawIdentifierFromStatement(statement: FideIdStatement): string {
  return buildStatementRawIdentifier(statement.subjectFideId, statement.predicateFideId, statement.objectFideId);
}

export function evaluateSameAsPersonV1(input: EvaluateSameAsInput): EvaluateSameAsResult {
  const byId = new Map<string, FideIdStatement>(input.statements.map((statement) => [statement.statementFideId, statement]));
  const target = byId.get(input.targetSameAsStatementFideId) ?? null;

  if (!target || target.predicateRawIdentifier !== PREDICATE_OWL_SAME_AS) {
    return defaultResult(input.targetSameAsStatementFideId);
  }
  const targetRawIdentifier = statementRawIdentifierFromStatement(target);

  const validFromStatements = input.statements.filter(
    (statement) =>
      (
        statement.subjectFideId === target.statementFideId ||
        statement.subjectRawIdentifier === target.statementFideId ||
        statement.subjectRawIdentifier === targetRawIdentifier
      ) &&
      statement.predicateRawIdentifier === PREDICATE_SCHEMA_VALID_FROM
  );
  const validThroughStatements = input.statements.filter(
    (statement) =>
      (
        statement.subjectFideId === target.statementFideId ||
        statement.subjectRawIdentifier === target.statementFideId ||
        statement.subjectRawIdentifier === targetRawIdentifier
      ) &&
      statement.predicateRawIdentifier === PREDICATE_SCHEMA_VALID_THROUGH
  );

  const citationStatementsByValidFrom: Record<string, FideIdStatement[]> = {};
  const citationStatementsByValidThrough: Record<string, FideIdStatement[]> = {};
  for (const validFromStatement of validFromStatements) {
    const validFromRawIdentifier = statementRawIdentifierFromStatement(validFromStatement);
    const targetRefs = new Set<string>([
      target.statementFideId,
      targetRawIdentifier,
    ]);
    const citations = input.statements.filter(
      (statement) =>
        (
          statement.subjectFideId === validFromStatement.statementFideId ||
          statement.subjectRawIdentifier === validFromStatement.statementFideId ||
          statement.subjectRawIdentifier === validFromRawIdentifier ||
          targetRefs.has(statement.subjectFideId) ||
          targetRefs.has(statement.subjectRawIdentifier)
        ) &&
        statement.predicateRawIdentifier === PREDICATE_PROV_HAD_PRIMARY_SOURCE
    );
    citationStatementsByValidFrom[validFromStatement.statementFideId] = citations;
  }
  for (const validThroughStatement of validThroughStatements) {
    const validThroughRawIdentifier = statementRawIdentifierFromStatement(validThroughStatement);
    const citations = input.statements.filter(
      (statement) =>
        (
          statement.subjectFideId === validThroughStatement.statementFideId ||
          statement.subjectRawIdentifier === validThroughStatement.statementFideId ||
          statement.subjectRawIdentifier === validThroughRawIdentifier
        ) &&
        statement.predicateRawIdentifier === PREDICATE_PROV_HAD_PRIMARY_SOURCE
    );
    citationStatementsByValidThrough[validThroughStatement.statementFideId] = citations;
  }

  const hasValidFromEvidence = validFromStatements.length > 0;
  const hasValidThroughEvidence = validThroughStatements.length > 0;
  const hasCitationForEveryValidFrom =
    hasValidFromEvidence &&
    validFromStatements.every((statement) => (citationStatementsByValidFrom[statement.statementFideId] ?? []).length > 0);
  const hasCitationForEveryValidThrough =
    hasValidThroughEvidence &&
    validThroughStatements.every((statement) => (citationStatementsByValidThrough[statement.statementFideId] ?? []).length > 0);

  const parseMs = (value: string): number | null => {
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : null;
  };

  const sortedFrom = [...validFromStatements].sort((a, b) => {
    const at = parseMs(a.objectRawIdentifier) ?? Number.MAX_SAFE_INTEGER;
    const bt = parseMs(b.objectRawIdentifier) ?? Number.MAX_SAFE_INTEGER;
    return at - bt || a.statementFideId.localeCompare(b.statementFideId);
  });
  const sortedThrough = [...validThroughStatements].sort((a, b) => {
    const at = parseMs(a.objectRawIdentifier) ?? Number.MAX_SAFE_INTEGER;
    const bt = parseMs(b.objectRawIdentifier) ?? Number.MAX_SAFE_INTEGER;
    return at - bt || a.statementFideId.localeCompare(b.statementFideId);
  });
  const throughUsed = new Set<string>();
  const now = Date.now();
  const validityIntervals: EvaluateSameAsResult["validityIntervals"] = [];

  for (const from of sortedFrom) {
    const fromTs = parseMs(from.objectRawIdentifier);
    const candidateThrough = sortedThrough.find((v) => {
      if (throughUsed.has(v.statementFideId)) return false;
      const throughTs = parseMs(v.objectRawIdentifier);
      if (throughTs === null) return false;
      return fromTs === null || throughTs >= fromTs;
    });

    if (candidateThrough) throughUsed.add(candidateThrough.statementFideId);
    const throughTs = candidateThrough ? parseMs(candidateThrough.objectRawIdentifier) : null;
    const status =
      fromTs !== null && throughTs !== null && throughTs < fromTs
        ? "invalid"
        : fromTs !== null && fromTs > now
          ? "future"
          : throughTs === null
            ? "open_ended"
            : throughTs < now
              ? "expired"
              : "active";

    validityIntervals.push({
      validFromStatementFideId: from.statementFideId,
      validFrom: from.objectRawIdentifier || null,
      validThroughStatementFideId: candidateThrough?.statementFideId ?? null,
      validThrough: candidateThrough?.objectRawIdentifier || null,
      status,
    });
  }

  for (const through of sortedThrough) {
    if (throughUsed.has(through.statementFideId)) continue;
    const throughTs = parseMs(through.objectRawIdentifier);
    const status = throughTs !== null && throughTs < now ? "expired" : "active";
    validityIntervals.push({
      validFromStatementFideId: null,
      validFrom: null,
      validThroughStatementFideId: through.statementFideId,
      validThrough: through.objectRawIdentifier || null,
      status,
    });
  }

  const hasAnyValidInterval = validityIntervals.some((interval) => interval.status !== "invalid");

  const metricContext = {
    target,
    statements: input.statements,
    validFromStatements,
    citationStatementsByValidFrom,
    hasValidFromEvidence,
    hasCitationForEveryValidFrom,
  };
  const draftMetrics: ComponentMetricDraft[] = [
    metricNameAlignment(metricContext),
    metricAffiliationOverlap(metricContext),
    metricCitationChain(metricContext),
    metricContradiction(metricContext),
  ];

  const subMetrics: EvaluationSubMetric[] = draftMetrics.map((metric) => {
    const weight = SUB_METHOD_WEIGHTS[metric.key] ?? 0.1;
    return {
      ...metric,
      weight,
      contribution: metric.score * weight,
    };
  });

  const totalWeight = subMetrics.reduce((sum, metric) => sum + metric.weight, 0) || 1;
  const rawScore = subMetrics.reduce((sum, metric) => sum + metric.contribution, 0) / totalWeight;
  const normalizedScore = clamp((rawScore + 1) / 2, 0, 1);

  const evidenceSet = new Set<string>();
  for (const metric of subMetrics) {
    for (const statementFideId of metric.evidenceStatementFideIds) {
      evidenceSet.add(statementFideId);
    }
  }

  const positiveEvidenceCount = subMetrics.filter((metric) => metric.score > 0.2).length;
  const negativeEvidenceCount = subMetrics.filter((metric) => metric.score < -0.2).length;
  const metricSignalCount = subMetrics.filter((metric) => Math.abs(metric.score) >= 0.5).length;
  const confidence = clamp(
    0.35 +
      (hasValidFromEvidence ? 0.15 : 0) +
      (hasValidThroughEvidence ? 0.05 : 0) +
      (hasCitationForEveryValidFrom ? 0.15 : 0) +
      (hasCitationForEveryValidThrough ? 0.05 : 0) +
      Math.min(0.2, evidenceSet.size * 0.02) +
      Math.min(0.15, metricSignalCount * 0.05),
    0,
    1
  );

  const contradictionMetric = subMetrics.find((metric) => metric.key === "explicit_contradiction");
  const nameMetric = subMetrics.find((metric) => metric.key === "name_alignment");
  const affiliationMetric = subMetrics.find((metric) => metric.key === "affiliation_overlap");
  let decision: IdentityDecision;
  if (contradictionMetric && contradictionMetric.score <= -1) {
    decision = "different";
  } else if (
    hasCitationForEveryValidFrom &&
    (
      (nameMetric?.score ?? 0) >= 1 ||
      (affiliationMetric?.score ?? 0) >= 0.8
    )
  ) {
    decision = "same";
  } else if (rawScore >= 0.55 && confidence >= 0.55) {
    decision = "same";
  } else if (rawScore <= -0.35 && confidence >= 0.55) {
    decision = "different";
  } else {
    decision = "uncertain";
  }

  const reviewRequired = decision !== "same" || confidence < 0.7;

  return {
    targetSameAsStatementFideId: input.targetSameAsStatementFideId,
    sameAsStatement: target,
    validFromStatements,
    validThroughStatements,
    citationStatementsByValidFrom,
    citationStatementsByValidThrough,
    hasValidFromEvidence,
    hasValidThroughEvidence,
    hasCitationForEveryValidFrom,
    hasCitationForEveryValidThrough,
    validityIntervals,
    hasAnyValidInterval,
    decision,
    score: normalizedScore,
    confidence,
    reviewRequired,
    subMetrics,
    evidenceStatementFideIds: Array.from(evidenceSet).sort(),
    positiveEvidenceCount,
    negativeEvidenceCount,
  };
}
