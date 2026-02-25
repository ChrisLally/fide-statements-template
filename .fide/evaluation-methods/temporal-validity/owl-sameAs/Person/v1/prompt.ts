import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseFideId } from "@chris-test/fcp";
import type { FideIdStatement } from "../../../../../types.js";
import type { EvaluateSameAsInput, EvaluateSameAsResult } from "./types.js";
import {
  injectPromptSections,
  renderGroupedCitationsMd,
  renderStatementListMd,
} from "../../../shared/prompt/v1/index.js";

const OWL_DIFFERENT_FROM = "https://www.w3.org/2002/07/owl#differentFrom";
const SCHEMA_NAME = "https://schema.org/name";
const AFFILIATION_PREDICATES = new Set([
  "https://schema.org/worksFor",
  "https://schema.org/memberOf",
  "https://schema.org/affiliation",
]);

const PERSON_V1_PROMPT_TEMPLATE_URL = new URL("./prompt-template.md", import.meta.url);

function toFideParts(value: string): {
  entityTypeCode: string;
  sourceTypeCode: string;
  entityType: string;
  sourceType: string;
  fingerprint: string;
} {
  try {
    const parsed = parseFideId(value as `did:fide:0x${string}`);
    return {
      entityTypeCode: parsed.typeChar,
      sourceTypeCode: parsed.sourceChar,
      entityType: parsed.entityType,
      sourceType: parsed.sourceType,
      fingerprint: parsed.fingerprint,
    };
  } catch {
    return {
      entityTypeCode: "unknown",
      sourceTypeCode: "unknown",
      entityType: "unknown",
      sourceType: "unknown",
      fingerprint: "unknown",
    };
  }
}

function getTarget(input: EvaluateSameAsInput, result: EvaluateSameAsResult): FideIdStatement | null {
  if (result.sameAsStatement) return result.sameAsStatement;
  return input.statements.find((s) => s.statementFideId === input.targetSameAsStatementFideId) ?? null;
}

function contradictionEvidence(statements: FideIdStatement[], target: FideIdStatement): FideIdStatement[] {
  return statements.filter(
    (s) =>
      s.predicateRawIdentifier === OWL_DIFFERENT_FROM &&
      (
        (s.subjectFideId === target.subjectFideId && s.objectFideId === target.objectFideId) ||
        (s.subjectFideId === target.objectFideId && s.objectFideId === target.subjectFideId)
      ),
  );
}

function nameEvidence(statements: FideIdStatement[], target: FideIdStatement): FideIdStatement[] {
  return statements.filter(
    (s) =>
      s.predicateRawIdentifier === SCHEMA_NAME &&
      (s.subjectFideId === target.subjectFideId || s.subjectFideId === target.objectFideId),
  );
}

function affiliationEvidence(statements: FideIdStatement[], target: FideIdStatement): FideIdStatement[] {
  return statements.filter(
    (s) =>
      AFFILIATION_PREDICATES.has(s.predicateRawIdentifier) &&
      (s.subjectFideId === target.subjectFideId || s.subjectFideId === target.objectFideId),
  );
}

export function buildPersonV1EvalPrompt(template: string, input: EvaluateSameAsInput, result: EvaluateSameAsResult): string {
  const target = getTarget(input, result);
  if (!target) {
    return injectPromptSections(template, {
      target: {
        statementFideId: input.targetSameAsStatementFideId,
        subjectFideId: "unknown",
        subjectEntityTypeCode: "unknown",
        subjectSourceTypeCode: "unknown",
        subjectEntityType: "unknown",
        subjectSourceType: "unknown",
        subjectFingerprint: "unknown",
        subjectRawIdentifier: "unknown",
        objectFideId: "unknown",
        objectEntityTypeCode: "unknown",
        objectSourceTypeCode: "unknown",
        objectEntityType: "unknown",
        objectSourceType: "unknown",
        objectFingerprint: "unknown",
        objectRawIdentifier: "unknown",
      },
      sections: {
        objectiveValidFromSectionMd: "No target owl:sameAs statement found in input.",
        objectiveValidThroughSectionMd: "No target owl:sameAs statement found in input.",
        objectiveCitationsByValidFromSectionMd: "No target owl:sameAs statement found in input.",
        objectiveExplicitContradictionsSectionMd: "No target owl:sameAs statement found in input.",
        heuristicNamesSectionMd: "No target owl:sameAs statement found in input.",
        heuristicAffiliationsSectionMd: "No target owl:sameAs statement found in input.",
      },
    });
  }

  const contradictions = contradictionEvidence(input.statements, target);
  const names = nameEvidence(input.statements, target);
  const affiliations = affiliationEvidence(input.statements, target);
  const subjectParts = toFideParts(target.subjectFideId);
  const objectParts = toFideParts(target.objectFideId);

  return injectPromptSections(template, {
    target: {
      statementFideId: target.statementFideId,
      subjectFideId: target.subjectFideId,
      subjectEntityTypeCode: subjectParts.entityTypeCode,
      subjectSourceTypeCode: subjectParts.sourceTypeCode,
      subjectEntityType: subjectParts.entityType,
      subjectSourceType: subjectParts.sourceType,
      subjectFingerprint: subjectParts.fingerprint,
      subjectRawIdentifier: target.subjectRawIdentifier,
      objectFideId: target.objectFideId,
      objectEntityTypeCode: objectParts.entityTypeCode,
      objectSourceTypeCode: objectParts.sourceTypeCode,
      objectEntityType: objectParts.entityType,
      objectSourceType: objectParts.sourceType,
      objectFingerprint: objectParts.fingerprint,
      objectRawIdentifier: target.objectRawIdentifier,
    },
    sections: {
      objectiveValidFromSectionMd: renderStatementListMd(
        result.validFromStatements,
        "No validFrom statements found for this owl:sameAs statement.",
      ),
      objectiveValidThroughSectionMd: renderStatementListMd(
        result.validThroughStatements,
        "No validThrough statements found for this owl:sameAs statement.",
      ),
      objectiveCitationsByValidFromSectionMd: renderGroupedCitationsMd(
        result.citationStatementsByValidFrom,
        "No citation mappings found for validFrom statements.",
      ),
      objectiveExplicitContradictionsSectionMd: renderStatementListMd(
        contradictions,
        "No explicit owl:differentFrom contradictions found for this pair.",
      ),
      heuristicNamesSectionMd: renderStatementListMd(
        names,
        "No schema:name evidence found for either side of the pair.",
      ),
      heuristicAffiliationsSectionMd: renderStatementListMd(
        affiliations,
        "No affiliation evidence found for either side of the pair.",
      ),
    },
  });
}

export function personV1PromptTemplatePath(): string {
  return fileURLToPath(PERSON_V1_PROMPT_TEMPLATE_URL);
}

export async function loadPersonV1PromptTemplate(): Promise<string> {
  return readFile(PERSON_V1_PROMPT_TEMPLATE_URL, "utf8");
}
