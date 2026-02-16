import { calculateFideId } from "./calculateFideId.js";

function assertFideId(value: string): `did:fide:0x${string}` {
  if (typeof value !== "string") {
    throw new TypeError(`Invalid Fide ID: expected string, got ${typeof value}`);
  }

  if (/^did:fide:0x[0-9a-f]{40}$/.test(value)) {
    return value as `did:fide:0x${string}`;
  }

  throw new Error(`Invalid Fide ID format: ${value}. Expected full Fide ID (e.g., did:fide:0x...)`);
}

/**
 * Calculate a Fide ID for a Statement from its RDF triple components.
 *
 * Creates a statement Fide ID by hashing a canonical JSON representation of the subject-predicate-object triple.
 * The resulting Fide ID always has type and source both set to Statement (0x00...).
 *
 * @param subjectFideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @param predicateFideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @param objectFideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @paramDefault subjectFideId did:fide:0x152f02f1d1c1e62b2e569e11818420c1968be3d9
 * @paramDefault predicateFideId did:fide:0x6524b049fa7069dd318c44531214a955c3f1fa37
 * @paramDefault objectFideId did:fide:0x66a023246354ad7e064b1e4e009ec8a0699a3043
 * @returns Promise resolving to the calculated statement Fide ID with format `did:fide:0x00{fingerprint}`
 * @throws TypeError if any Fide ID is not a string
 * @throws Error if any Fide ID format is invalid or not in canonical form
 * @remarks
 * This function only validates Fide ID format and canonicalizes triple hashing.
 * It does not enforce statement role policy (for example allowed predicate entity/source combos).
 * Role policy checks are enforced by `createStatement`.
 */
export async function calculateStatementFideId(
  subjectFideId: string,
  predicateFideId: string,
  objectFideId: string
): Promise<`did:fide:0x${string}`> {
  const rawIdentifier = JSON.stringify({
    o: assertFideId(objectFideId),
    p: assertFideId(predicateFideId),
    s: assertFideId(subjectFideId)
  });

  return calculateFideId("Statement", "Statement", rawIdentifier);
}
