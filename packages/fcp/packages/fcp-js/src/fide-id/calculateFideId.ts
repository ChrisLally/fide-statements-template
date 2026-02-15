import { FIDE_ENTITY_TYPE_MAP } from "./constants.js";
import type { FideEntityType, FideId } from "./types.js";

// Re-export for backward compatibility
export { FIDE_ENTITY_TYPE_MAP };
export type { FideEntityType };

type DigestOnlyCrypto = {
  digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer>;
};

async function getSubtleCrypto(): Promise<DigestOnlyCrypto> {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  const { webcrypto } = await import("node:crypto");
  return webcrypto.subtle;
}

/**
 * Calculate a Fide ID for an entity from its type, source type, and raw identifier.
 *
 * Generates a unique identifier by creating a SHA-256 hash of the raw identifier,
 * then constructing a Fide ID with type and source characters followed by the last 38 hex characters.
 *
 * @param entityType The entity type.
 * @param sourceEntityType The source entity type.
 * @param rawIdentifier The raw identifier string to hash.
 * @paramDefault entityType Person
 * @paramDefault sourceEntityType Product
 * @paramDefault rawIdentifier https://x.com/alice
 * @returns Promise resolving to the calculated Fide ID with format `did:fide:0x{typeChar}{sourceChar}{fingerprint}`
 * @throws TypeError if rawIdentifier is not a string
 * @throws Error if entityType or sourceEntityType are invalid, or if protocol constraints are violated
 */
export async function calculateFideId(
  entityType: FideEntityType,
  sourceEntityType: FideEntityType,
  rawIdentifier: string
): Promise<`did:fide:0x${string}`> {
  if (typeof rawIdentifier !== "string") {
    throw new TypeError(`Invalid rawIdentifier: expected string, got ${typeof rawIdentifier}`);
  }

  if (
    (entityType === "Statement" && sourceEntityType !== "Statement") ||
    (entityType === "Attestation" && sourceEntityType !== "Attestation")
  ) {
    throw new Error(
      `Protocol entity ${entityType} must be self-sourced. Expected source type: ${entityType}, got: ${sourceEntityType}`
    );
  }

  if (sourceEntityType === "Statement" && entityType !== "Statement" && entityType !== "Attestation") {
    throw new Error(
      `Invalid Statement source for ${entityType}: protocol disallows 0xX0 (Statement-derived) IDs for non-Statement/non-Attestation entities. Use a concrete source (e.g. Product, Organization) instead.`
    );
  }

  const entityTypeCode = FIDE_ENTITY_TYPE_MAP[entityType];
  if (!entityTypeCode) {
    throw new Error(`Invalid entityType: ${String(entityType)}`);
  }

  const sourceEntityTypeCode = FIDE_ENTITY_TYPE_MAP[sourceEntityType];
  if (!sourceEntityTypeCode) {
    throw new Error(`Invalid sourceEntityType: ${String(sourceEntityType)}`);
  }

  const subtle = await getSubtleCrypto();
  const bytes = new TextEncoder().encode(rawIdentifier);
  const digest = await subtle.digest("SHA-256", bytes);
  const hashHex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const fingerprint = hashHex.slice(-38);

  return `did:fide:0x${entityTypeCode}${sourceEntityTypeCode}${fingerprint}` as `did:fide:0x${string}`;
}
