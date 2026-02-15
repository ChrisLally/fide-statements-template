/**
 * FCP SDK - Signing Module
 * 
 * Re-exports all signing utilities from submodules.
 */

// Ed25519 Signing (native, zero-dependency)
export {
    generateEd25519KeyPair,
    exportEd25519Keys,
    importEd25519Keys,
    signEd25519,
    verifyEd25519,
    type Ed25519KeyPair,
    type ExportedEd25519Keys
} from "./ed25519.js";

// EIP-712 Signing (requires viem peer dependency)
export {
    getEthereumAddress,
    signEip712,
    verifyEip712,
    createEthereumCaip10,
    FCP_EIP712_DOMAIN,
    type Eip712Domain
} from "./eip712.js";

// EIP-191 Signing (requires viem peer dependency)
export {
    signEip191,
    verifyEip191
} from "./eip191.js";
