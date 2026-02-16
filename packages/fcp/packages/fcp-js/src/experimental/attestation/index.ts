/**
 * FCP SDK - Attestation Module
 * 
 * Re-exports all attestation utilities.
 */

export {
    createAttestation,
    createProvenanceStatements,
    verifyStatementInAttestation,
    parseAttestationData,
    verifyAttestationFideId,
    type SigningMethod,
    type AttestationData,
    type AttestationResult,
    type CreateAttestationOptions,
    type ProvenanceStatement
} from "./create.js";

export {
    verifyAttestation,
    type VerifyAttestationOptions
} from "./verify.js";
