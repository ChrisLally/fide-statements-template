/**
 * @fide.work/fcp - Fide Context Protocol SDK
 *
 * Core functions for calculating Fide IDs and working with
 * the FCP protocol in JavaScript/TypeScript.
 */

// ============================================================================
// FIDE ID MODULE
// ============================================================================

// Core calculation functions
export { calculateFideId, calculateStatementFideId } from "./fide-id/index.js";

// Utility functions
export {
    isValidFideId,
    extractFideIdFingerprint,
    extractFideIdTypeAndSource,
    parseFideId,
    getStatementRawIdentifier
} from "./fide-id/index.js";

// Constants
export {
    FIDE_ENTITY_TYPE_MAP,
    FIDE_CHAR_TO_ENTITY_TYPE,
    FIDE_ID_PREFIX,
    FIDE_ID_HEX_LENGTH,
    FIDE_ID_LENGTH,
    FIDE_ID_FINGERPRINT_LENGTH
} from "./fide-id/index.js";

// Types
export type {
    FideEntityType,
    FideStatementPredicateEntityType,
    FideEntityTypeChar,
    FideId,
    FideFingerprint,
    ParsedFideId
} from "./fide-id/index.js";

// ============================================================================
// SIGNING MODULE
// ============================================================================

// Ed25519 Signing (native, zero-dependency)
export {
    generateEd25519KeyPair,
    exportEd25519Keys,
    importEd25519Keys,
    signEd25519,
    verifyEd25519,
    type Ed25519KeyPair,
    type ExportedEd25519Keys
} from "./signing/index.js";

// EIP-712 Signing (requires viem peer dependency)
export {
    getEthereumAddress,
    signEip712,
    verifyEip712,
    createEthereumCaip10,
    FCP_EIP712_DOMAIN,
    type Eip712Domain
} from "./signing/index.js";

// EIP-191 Signing (requires viem peer dependency)
export {
    signEip191,
    verifyEip191
} from "./signing/index.js";

// ============================================================================
// MERKLE TREE MODULE
// ============================================================================

export {
    buildMerkleTree,
    verifyMerkleProof,
    type MerkleProofElement,
    type MerkleProof,
    type MerkleTreeResult
} from "./merkle/index.js";

// ============================================================================
// STATEMENT MODULE
// ============================================================================

export {
    createStatement,
    buildStatementBatch,
    type StatementInput,
    type Statement
} from "./statement/index.js";

// ============================================================================
// ATTESTATION MODULE
// ============================================================================

export {
    createAttestation,
    createProvenanceStatements,
    verifyStatementInAttestation,
    verifyAttestation,
    parseAttestationData,
    verifyAttestationFideId,
    type SigningMethod,
    type AttestationData,
    type AttestationResult,
    type CreateAttestationOptions,
    type ProvenanceStatement,
    type VerifyAttestationOptions
} from "./attestation/index.js";

// ============================================================================
// BROADCASTING MODULE
// ============================================================================

export {
    formatAttestationForJSONL,
    generateRegistryPath,
    generateJSONLFilename,
    DEFAULT_ATTESTATION_PATHS,
    DEFAULT_ATTESTATIONS_PATH,
    REGISTRY_CONFIG_FILENAME,
    type JSONLAttestation,
    type JSONLStatement,
    type FCPRegistryConfig
} from "./broadcasting/index.js";

// ============================================================================
// SCHEMA MODULE
// ============================================================================

export {
    SCHEMA_PREDICATES,
    PROV_PREDICATES,
    OWL_PREDICATES,
    SEC_PREDICATES,
    FIDE_EVALUATION_METHODS,
    expandPredicateIdentifier,
    type PredicateNamespace
} from "./schema/index.js";
