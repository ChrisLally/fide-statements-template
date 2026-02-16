/**
 * FCP SDK Utilities
 * Helper functions for working with Fide IDs
 */

import {
    FIDE_ID_PREFIX,
    FIDE_ID_LENGTH,
    FIDE_CHAR_TO_ENTITY_TYPE
} from "./constants.js";
import type { FideId, FideFingerprint, ParsedFideId, FideEntityType, FideEntityTypeChar } from "./types.js";

/**
 * Validate that a string is a properly formatted Fide ID.
 *
 * Checks that the value follows the standard Fide ID format:
 * `did:fide:0x` prefix followed by exactly 40 hexadecimal characters (case-insensitive).
 *
 * @param value The Fide ID reference (format: did:fide:0x... or 0x...)
 * @paramDefault value did:fide:0x152f02f1d1c1e62b2e569e11818420c1968be3d9
 * @returns true if valid Fide ID format, false otherwise
 * @throws Never throws. Returns `false` for invalid input.
 */
export function isValidFideId(value: string): value is FideId {
    if (typeof value !== "string") return false;
    if (value.length !== FIDE_ID_LENGTH) return false;
    if (!value.startsWith(FIDE_ID_PREFIX)) return false;

    // Check that everything after prefix is valid hex
    const hex = value.slice(FIDE_ID_PREFIX.length);
    return /^[0-9a-f]{40}$/i.test(hex);
}

/**
 * Extract the 38-character fingerprint from a Fide ID.
 *
 * The fingerprint comprises the last 38 hex characters after the type and source bytes,
 * representing the last 19 bytes of the SHA-256 hash used to create the Fide ID.
 *
 * @param fideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @paramDefault fideId did:fide:0x152f02f1d1c1e62b2e569e11818420c1968be3d9
 * @returns 38-character hexadecimal fingerprint string
 * @throws Error if invalid Fide ID format
 */
export function extractFideIdFingerprint(fideId: string): FideFingerprint {
    if (!isValidFideId(fideId)) {
        throw new Error(`Invalid Fide ID format: ${fideId}. Expected ${FIDE_ID_PREFIX}... (${FIDE_ID_LENGTH} chars)`);
    }
    // Skip prefix (11) + type (1) + source (1) = 13 chars
    return fideId.slice(FIDE_ID_PREFIX.length + 2);
}

/**
 * Extract the type and source hex characters from a Fide ID.
 *
 * Returns the first two hex characters after the prefix, which encode the entity type and source type.
 *
 * @param fideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @paramDefault fideId did:fide:0x152f02f1d1c1e62b2e569e11818420c1968be3d9
 * @returns Object containing typeChar and sourceChar hex values
 * @throws Error if invalid Fide ID format
 */
export function extractFideIdTypeAndSource(fideId: string): { typeChar: string; sourceChar: string } {
    if (!isValidFideId(fideId)) {
        throw new Error(`Invalid Fide ID format: ${fideId}. Expected ${FIDE_ID_PREFIX}... (${FIDE_ID_LENGTH} chars)`);
    }
    return {
        typeChar: fideId[FIDE_ID_PREFIX.length],
        sourceChar: fideId[FIDE_ID_PREFIX.length + 1]
    };
}

/**
 * Parse a Fide ID into its constituent components.
 *
 * Decomposes a Fide ID into entity type, source type, and fingerprint, converting hex characters
 * to their corresponding entity type names.
 *
 * @param fideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @paramDefault fideId did:fide:0x152f02f1d1c1e62b2e569e11818420c1968be3d9
 * @returns Parsed Fide ID components. `entityType` and `sourceType` are resolved via `FIDE_CHAR_TO_ENTITY_TYPE`.
 * @throws Error if invalid Fide ID format or if type characters do not map to known entity types
 */
export function parseFideId(fideId: string): ParsedFideId {
    if (!isValidFideId(fideId)) {
        throw new Error(`Invalid Fide ID format: ${fideId}. Expected ${FIDE_ID_PREFIX}... (${FIDE_ID_LENGTH} chars)`);
    }

    const typeChar = fideId[FIDE_ID_PREFIX.length] as FideEntityTypeChar;
    const sourceChar = fideId[FIDE_ID_PREFIX.length + 1] as FideEntityTypeChar;
    const fingerprint = fideId.slice(FIDE_ID_PREFIX.length + 2);

    const entityType = FIDE_CHAR_TO_ENTITY_TYPE[typeChar];
    const sourceType = FIDE_CHAR_TO_ENTITY_TYPE[sourceChar];

    if (!entityType) {
        throw new Error(`Unknown entity type character: ${typeChar}`);
    }
    if (!sourceType) {
        throw new Error(`Unknown source type character: ${sourceChar}`);
    }

    return {
        fideId: fideId as FideId,
        typeChar,
        sourceChar,
        entityType,
        sourceType,
        fingerprint
    };
}

/**
 * Get the normalized JSON string for a statement's raw identifier.
 *
 * Generates a deterministic JSON representation of an RDF triple with keys in alphabetical order.
 * This ensures the same statement always produces the same Fide ID across all implementations.
 *
 * @param subjectFideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @param predicateFideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @param objectFideId The Fide ID reference (format: did:fide:0x... or 0x...)
 * @paramDefault subjectFideId did:fide:0x152f02f1d1c1e62b2e569e11818420c1968be3d9
 * @paramDefault predicateFideId did:fide:0x6524b049fa7069dd318c44531214a955c3f1fa37
 * @paramDefault objectFideId did:fide:0x66a023246354ad7e064b1e4e009ec8a0699a3043
 * @returns Normalized JSON string with keys in fixed alphabetical order: `{"o":"...","p":"...","s":"..."}`
 * @throws Never throws. Input types are compile-time constrained to `FideId`.
 * @remarks The key order (o, p, s) is critical for deterministic hashing. Do not reorder keys as this will produce different Fide IDs.
 */
export function getStatementRawIdentifier(
    subjectFideId: FideId,
    predicateFideId: FideId,
    objectFideId: FideId
): string {
    // IMPORTANT: Keys MUST be in alphabetical order (o, p, s) for deterministic hashing.
    // DO NOT reorder these keys or use a variable object.
    // This ensures the same statement always produces the same Fide ID across all implementations.
    return JSON.stringify({
        o: objectFideId,
        p: predicateFideId,
        s: subjectFideId
    });
}
