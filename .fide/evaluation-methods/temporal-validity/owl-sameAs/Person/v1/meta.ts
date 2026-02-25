import type { EvaluationMethodRegistryEntry } from "../../../../../types.js";

const METHOD_ID = "temporal-validity/owl-sameAs/Person";
const METHOD_VERSION = "v1";
const METHOD_KEY = `${METHOD_ID}@${METHOD_VERSION}`;
const METHOD_IDENTIFIER = `https://fide.work/methods/${METHOD_ID}`;
const METHOD_RELEASE_IDENTIFIER = `${METHOD_IDENTIFIER}/releases/${METHOD_VERSION}`;
const EVALUATION_BASE_IDENTIFIER = `https://fide.work/evaluations/${METHOD_ID}`;

export const META: EvaluationMethodRegistryEntry = {
  key: METHOD_KEY,
  methodId: METHOD_ID,
  methodIdentifier: METHOD_IDENTIFIER,
  methodName: "temporal-validity owl:sameAs Person",
  methodDescription:
    "Evaluates accuracy of schema:validFrom statements about Person owl:sameAs statements using timing, contradiction, and primary-source evidence.",
  methodVersion: METHOD_VERSION,
  methodReleaseIdentifier: METHOD_RELEASE_IDENTIFIER,
  methodReleaseDescription: `Release ${METHOD_VERSION} of temporal-validity owl:sameAs Person evaluation method.`,
  evaluationBaseIdentifier: EVALUATION_BASE_IDENTIFIER,
  domain: "identity",
  subjectTypes: ["Person"],
  assumptions: [
    "schema:validFrom is interpreted as real-world validity start time for the owl:sameAs statement",
    "Provenance/observation time is separate from schema:validFrom",
    "Evaluates validFrom accuracy for owl:sameAs statements (identity truth and timing correctness)",
    "Requires schema:validFrom and optionally schema:validThrough on owl:sameAs statements",
    "Requires prov:hadPrimarySource support for validFrom statements",
  ],
  inputsRequired: [
    "https://www.w3.org/2002/07/owl#sameAs",
    "https://schema.org/validFrom",
    "https://schema.org/validThrough",
    "https://www.w3.org/ns/prov#hadPrimarySource",
  ],
  stability: "experimental",
};
