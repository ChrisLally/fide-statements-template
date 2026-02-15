/**
 * FCP SDK Attestation Verification Utilities
 * 
 * Full verification functions that combine Merkle proof and signature verification.
 */

import { verifyStatementInAttestation, parseAttestationData, type AttestationData } from "./create.js";
import { verifyEd25519 } from "../signing/ed25519.js";
import { verifyEip712 } from "../signing/eip712.js";
import { verifyEip191 } from "../signing/eip191.js";
import type { MerkleProof } from "../merkle/index.js";
import type { SigningMethod } from "./create.js";

/**
 * Options for verifying an attestation
 */
export interface VerifyAttestationOptions {
    /** The signing method used (`eip712`/`eip191` require `viem` to be installed). */
    method: SigningMethod;
    /** Public key or address for signature verification */
    publicKeyOrAddress: CryptoKey | `0x${string}`;
}

/**
 * Verify a complete attestation (both Merkle proof and signature)
 *
 * This function performs full verification:
 * 1. Verifies the Merkle proof (statement is in the batch)
 * 2. Verifies the signature (signer authorized the batch)
 *
 * @param statementFideId - The leaf value to verify in Merkle tree
 * @param proof - The Merkle proof path (array of hashes from leaf to root)
 * @param attestationData - The attestation data structure
 * @param options - Configuration options for operation (method, public key/address, etc.)
 * @returns True if both Merkle proof and signature are valid
 * 
 * @example
 * ```ts
 * // With Ed25519
 * const isValid = await verifyAttestation(
 *   statementFideId,
 *   proof,
 *   attestationData,
 *   {
 *     method: 'ed25519',
 *     publicKeyOrAddress: publicKey
 *   }
 * );
 * 
 * // With EIP-712
 * const isValid = await verifyAttestation(
 *   statementFideId,
 *   proof,
 *   attestationData,
 *   {
 *     method: 'eip712',
 *     publicKeyOrAddress: address
 *   }
 * );
 * ```
 */
export async function verifyAttestation(
    statementFideId: string,
    proof: MerkleProof,
    attestationData: AttestationData | string,
    options: VerifyAttestationOptions
): Promise<boolean> {
    // Parse attestation data if it's a string
    const data = typeof attestationData === 'string' 
        ? parseAttestationData(attestationData)
        : attestationData;

    // 1. Verify Merkle proof
    const merkleValid = await verifyStatementInAttestation(statementFideId, proof, data);
    if (!merkleValid) {
        return false;
    }

    // 2. Verify signature based on method
    let signatureValid = false;

    if (options.method === 'ed25519') {
        if (typeof options.publicKeyOrAddress === 'string') {
            throw new Error('Ed25519 verification requires a CryptoKey, not an address string');
        }
        signatureValid = await verifyEd25519(
            data.r, // merkle root
            data.s, // signature
            options.publicKeyOrAddress
        );
    } else if (options.method === 'eip712') {
        if (typeof options.publicKeyOrAddress !== 'string') {
            throw new Error('EIP-712 verification requires an address string, not a CryptoKey');
        }
        if (!data.s.startsWith('0x')) {
            throw new Error('EIP-712 signature must be hex-encoded (0x prefix)');
        }
        signatureValid = await verifyEip712(
            data.r, // merkle root
            data.s as `0x${string}`, // signature
            options.publicKeyOrAddress
        );
    } else if (options.method === 'eip191') {
        if (typeof options.publicKeyOrAddress !== 'string') {
            throw new Error('EIP-191 verification requires an address string, not a CryptoKey');
        }
        if (!data.s.startsWith('0x')) {
            throw new Error('EIP-191 signature must be hex-encoded (0x prefix)');
        }
        signatureValid = await verifyEip191(
            data.r, // merkle root
            data.s as `0x${string}`, // signature
            options.publicKeyOrAddress
        );
    } else {
        throw new Error(`Unsupported signing method: ${options.method}`);
    }

    return signatureValid;
}
