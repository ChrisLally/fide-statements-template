/**
 * FCP SDK Attestation Utilities
 * 
 * High-level helpers for creating and verifying attestations.
 * Combines Fide ID calculation, Merkle trees, and signing.
 */

import { calculateFideId } from "../../fide-id/index.js";
import type { FideId } from "../../fide-id/types.js";
import { buildMerkleTree, verifyMerkleProof, type MerkleProof } from "../merkle/index.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Signing method identifier
 *
 * `ed25519` has no external dependency.
 * `eip712` and `eip191` require the optional `viem` peer dependency.
 */
export type SigningMethod = 'ed25519' | 'eip712' | 'eip191';

/**
 * Attestation data structure (baked into Fide ID)
 * Uses short keys to match protocol: m, u, r, s
 */
export interface AttestationData {
    /** Method: Signing standard used */
    m: SigningMethod;
    /** User: CAIP-10 signer identifier */
    u: string;
    /** Root: Merkle tree commitment */
    r: string;
    /** Signature: Cryptographic proof */
    s: string;
}

/**
 * Full attestation result
 */
export interface AttestationResult {
    /** The Attestation Fide ID */
    attestationFideId: FideId;
    /** The raw attestation data */
    attestationData: AttestationData;
    /** The normalized JSON string (raw identifier) */
    rawIdentifier: string;
    /** The Merkle root */
    merkleRoot: string;
    /** Proofs for each statement, keyed by statement Fide ID */
    proofs: Map<string, MerkleProof>;
}

/**
 * Options for creating an attestation
 */
export interface CreateAttestationOptions {
    /** The signing method to use (`eip712`/`eip191` require `viem` to be installed). */
    method: SigningMethod;
    /** CAIP-10 identifier for the signer (e.g., "eip155:1:0x...") */
    caip10User: string;
    /** Signing function - takes merkle root string, returns signature hex string */
    sign: (merkleRoot: string) => Promise<string>;
}

/**
 * Provenance statement linking a statement to its attestation
 */
export interface ProvenanceStatement {
    subjectFideId: string;
    predicateFideId: string;
    objectFideId: string;
    predicateRawIdentifier: string;
    objectRawIdentifier: string;
}

// ============================================================================
// ATTESTATION CREATION
// ============================================================================

/**
 * Create an attestation for a batch of statement Fide IDs
 *
 * This function:
 * 1. Builds a Merkle tree from the statement Fide IDs
 * 2. Signs the Merkle root using the provided signing function
 * 3. Creates the attestation data structure
 * 4. Derives the Attestation Fide ID
 *
 * @param statementFideIds - Array of statement Fide IDs.
 * @param options - Configuration options for operation.
 * @paramDefault statementFideIds ["did:fide:0x10...", "did:fide:0x10..."]
 * @paramDefault options {"method":"ed25519","caip10User":"ed25519:123...","sign":"async (root) => 'signature'"}
 * @returns Full attestation result including ID, data, and proofs
 * 
 * @example
 * ```ts
 * import { createAttestation, signEd25519 } from '@fide.work/fcp';
 * 
 * const result = await createAttestation(
 *   [statement1FideId, statement2FideId],
 *   {
 *     method: 'ed25519',
 *     caip10User: 'ed25519::abc123...',
 *     sign: (root) => signEd25519(root, privateKey)
 *   }
 * );
 * 
 * console.log('Attestation ID:', result.attestationFideId);
 * ```
 */
export async function createAttestation(
    statementFideIds: string[],
    options: CreateAttestationOptions
): Promise<AttestationResult> {
    if (statementFideIds.length === 0) {
        throw new Error('Cannot create attestation from empty statement list');
    }

    // 1. Build Merkle tree
    const merkleResult = await buildMerkleTree(statementFideIds);
    const merkleRoot = merkleResult.root;

    // 2. Sign the Merkle root
    const signature = await options.sign(merkleRoot);

    // 3. Create attestation data (with short keys, alphabetically ordered)
    const attestationData: AttestationData = {
        m: options.method,
        r: merkleRoot,
        s: signature,
        u: options.caip10User
    };

    // 4. Create normalized JSON string (alphabetically ordered for determinism)
    // IMPORTANT: Keys MUST be in alphabetical order (m, r, s, u) for deterministic hashing
    const rawIdentifier = JSON.stringify({
        m: attestationData.m,
        r: attestationData.r,
        s: attestationData.s,
        u: attestationData.u
    });

    // 5. Derive Attestation Fide ID
    const attestationFideId = await calculateFideId('Attestation', 'Attestation', rawIdentifier);

    return {
        attestationFideId,
        attestationData,
        rawIdentifier,
        merkleRoot,
        proofs: merkleResult.proofs
    };
}

/**
 * Create provenance statements linking each statement to the attestation
 *
 * These are the "Statement → prov:wasGeneratedBy → Attestation" triples
 * that connect content statements to their attestation.
 *
 * @param statementFideIds - Array of statement Fide IDs to include in attestation
 * @param attestationResult - The attestation data structure
 * @returns Array of provenance statements to publish
 * 
 * @example
 * ```ts
 * const provenance = await createProvenanceStatements(
 *   statementFideIds,
 *   attestationResult
 * );
 * // Each provenance statement links a content statement to the attestation
 * ```
 */
export async function createProvenanceStatements(
    statementFideIds: string[],
    attestationResult: AttestationResult
): Promise<ProvenanceStatement[]> {
    // Get the prov:wasGeneratedBy predicate ID
    const wasGeneratedByPredicateId = await calculateFideId(
        'CreativeWork',
        'CreativeWork',
        'prov:wasGeneratedBy'
    );

    return statementFideIds.map(statementFideId => ({
        subjectFideId: statementFideId,
        predicateFideId: wasGeneratedByPredicateId,
        objectFideId: attestationResult.attestationFideId,
        predicateRawIdentifier: 'prov:wasGeneratedBy',
        objectRawIdentifier: attestationResult.rawIdentifier
    }));
}

// ============================================================================
// ATTESTATION VERIFICATION
// ============================================================================

/**
 * Verify that a statement is part of an attestation
 *
 * This verifies the Merkle proof but does NOT verify the signature.
 * Signature verification depends on the signing method and should
 * be done separately using verifyEd25519 or verifyEip712.
 *
 * @param statementFideId - The leaf value to verify.
 * @param proof - The Merkle proof path.
 * @param attestationData - The attestation data.
 * @paramDefault statementFideId did:fide:0x10...
 * @paramDefault proof ["hash1", "hash2"]
 * @paramDefault attestationData {"r":"root-hash"}
 * @returns True if the statement is in the attestation
 * 
 * @example
 * ```ts
 * const isInBatch = await verifyStatementInAttestation(
 *   statementFideId,
 *   proof,
 *   attestationData
 * );
 * ```
 */
export async function verifyStatementInAttestation(
    statementFideId: string,
    proof: MerkleProof,
    attestationData: AttestationData | { r: string }
): Promise<boolean> {
    return await verifyMerkleProof(statementFideId, proof, attestationData.r);
}

/**
 * Parse attestation data from a raw identifier string
 *
 * @param rawIdentifier - The JSON string from objectRawIdentifier
 * @returns Parsed attestation data
 * @throws Error if JSON is invalid
 * 
 * @example
 * ```ts
 * const attestationData = parseAttestationData(provenanceStatement.objectRawIdentifier);
 * ```
 */
export function parseAttestationData(rawIdentifier: string): AttestationData {
    const parsed = JSON.parse(rawIdentifier);

    if (!parsed.m || !parsed.u || !parsed.r || !parsed.s) {
        throw new Error('Invalid attestation data: missing required fields (m, u, r, s)');
    }

    return {
        m: parsed.m as SigningMethod,
        u: parsed.u,
        r: parsed.r,
        s: parsed.s
    };
}

/**
 * Verify that an attestation's Fide ID is correctly derived
 *
 * @param attestationFideId - The claimed attestation Fide ID
 * @param rawIdentifier - The raw identifier JSON string
 * @returns True if the Fide ID is correctly derived
 * 
 * @example
 * ```ts
 * const isValidId = await verifyAttestationFideId(
 *   provenanceStatement.objectFideId,
 *   provenanceStatement.objectRawIdentifier
 * );
 * ```
 */
export async function verifyAttestationFideId(
    attestationFideId: string,
    rawIdentifier: string
): Promise<boolean> {
    const expectedId = await calculateFideId('Attestation', 'Attestation', rawIdentifier);
    return attestationFideId.toLowerCase() === expectedId.toLowerCase();
}
