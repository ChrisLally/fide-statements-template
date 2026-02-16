/**
 * FCP SDK EIP-712 Signing Utilities
 * Ethereum-compatible signing using viem (optional peer dependency)
 */

/**
 * EIP-712 Domain for Fide Context Protocol
 */
export interface Eip712Domain {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
}

/**
 * Default FCP EIP-712 Domain
 */
export const FCP_EIP712_DOMAIN: Eip712Domain = {
    name: 'Fide Context Protocol',
    version: '1',
    chainId: 1, // Mainnet (should be configured per chain)
    verifyingContract: '0x0000000000000000000000000000000000000000'
};

/**
 * Detect which package manager is being used
 */
function detectPackageManager(): string {
    // Check for package manager environment variables
    const userAgent = process.env.npm_config_user_agent || '';

    if (userAgent.includes('pnpm')) return 'pnpm add viem';
    if (userAgent.includes('yarn')) return 'yarn add viem';
    if (userAgent.includes('bun')) return 'bun add viem';
    if (userAgent.includes('npm')) return 'npm install viem';

    // Default to npm if we can't detect
    return 'npm install viem';
}

/**
 * Check if viem is installed
 */
async function checkViemInstalled(): Promise<void> {
    try {
        await import('viem');
    } catch (error) {
        const installCommand = detectPackageManager();
        throw new Error(
            'EIP-712 signing requires viem to be installed.\n\n' +
            `Install it with: ${installCommand}\n\n` +
            'Or use the zero-dependency Ed25519 signing instead:\n' +
            '  import { generateEd25519KeyPair, signEd25519 } from \'@fide.work/fcp\''
        );
    }
}

/**
 * Get Ethereum address from private key
 *
 * Requires viem to be installed as a peer dependency.
 *
 * @param privateKey - The private key for signing (0x-prefixed hex)
 * @returns Ethereum address
 * @throws Error if viem is not installed
 *
 * @remarks
 * Derives the Ethereum address from the private key using:
 * - ECDSA public key derivation
 * - Keccak256 hashing
 * - Last 20 bytes as the address
 *
 * @example
 * ```ts
 * const address = await getEthereumAddress(privateKey);
 * // Result: "0x742d35Cc6634C0532925a3b844Bc9e7595f42e"
 * ```
 */
export async function getEthereumAddress(privateKey: `0x${string}`): Promise<`0x${string}`> {
    await checkViemInstalled();
    const { privateKeyToAddress } = await import('viem/accounts');
    return privateKeyToAddress(privateKey);
}

/**
 * Sign data using EIP-712 typed data signing
 *
 * Requires viem to be installed as a peer dependency.
 *
 * @param data - The data/message to sign or verify (hex string for EIP standards, plaintext for EIP-191)
 * @param privateKey - The private key for signing (0x-prefixed hex)
 * @param domain - EIP-712 domain (defaults to FCP domain)
 * @returns Hex-encoded signature
 * @throws Error if viem is not installed
 *
 * @remarks
 * This function signs data using EIP-712 typed data signing:
 * - Structures the message in FideAttestation format
 * - Uses the provided domain (or defaults to FCP_EIP712_DOMAIN)
 * - Returns an ECDSA signature over the structured hash
 *
 * Supports custom domains for integration with different smart contracts.
 *
 * @example
 * ```ts
 * const signature = await signEip712(merkleRoot, privateKey);
 * ```
 */
export async function signEip712(
    data: string,
    privateKey: `0x${string}`,
    domain: Eip712Domain = FCP_EIP712_DOMAIN
): Promise<`0x${string}`> {
    await checkViemInstalled();
    const { privateKeyToAccount } = await import('viem/accounts');
    const { hashTypedData, keccak256, toHex } = await import('viem');

    const account = privateKeyToAccount(privateKey);

    // Define the EIP-712 typed data structure
    const types = {
        FideAttestation: [
            { name: 'data', type: 'string' }
        ]
    };

    const message = {
        data
    };

    // Sign using EIP-712
    const signature = await account.signTypedData({
        domain,
        types,
        primaryType: 'FideAttestation',
        message
    });

    return signature;
}

/**
 * Verify an EIP-712 signature
 *
 * Requires viem to be installed as a peer dependency.
 *
 * @param data - The data/message to sign or verify (hex string for EIP standards, plaintext for EIP-191)
 * @param signature - The cryptographic signature (0x-prefixed hex string)
 * @param address - The signer's Ethereum address (0x-prefixed hex)
 * @param domain - EIP-712 domain (defaults to FCP domain)
 * @returns True if signature is valid
 * @throws Error if viem is not installed
 *
 * @remarks
 * This function verifies an EIP-712 typed data signature by:
 * - Reconstructing the FideAttestation message structure
 * - Using the provided domain (or defaults to FCP_EIP712_DOMAIN)
 * - Verifying the ECDSA signature against the expected signer address
 *
 * @example
 * ```ts
 * const isValid = await verifyEip712(merkleRoot, signature, address);
 * ```
 */
export async function verifyEip712(
    data: string,
    signature: `0x${string}`,
    address: `0x${string}`,
    domain: Eip712Domain = FCP_EIP712_DOMAIN
): Promise<boolean> {
    await checkViemInstalled();
    const { verifyTypedData } = await import('viem');

    const types = {
        FideAttestation: [
            { name: 'data', type: 'string' }
        ]
    };

    const message = {
        data
    };

    return await verifyTypedData({
        address,
        domain,
        types,
        primaryType: 'FideAttestation',
        message,
        signature
    });
}

/**
 * Create a CAIP-10 identifier for an Ethereum address
 *
 * @param address - The signer's Ethereum address (0x-prefixed hex)
 * @param chainId - Chain ID (defaults to 1 for mainnet)
 * @returns CAIP-10 identifier (e.g., "eip155:1:0x...")
 *
 * @remarks
 * CAIP-10 (Chain Agnostic Improvement Proposal 10) is a standard format for
 * representing blockchain addresses across different chains. This function creates
 * identifiers in the format: `eip155:{chainId}:{address}`
 *
 * Common chainIds:
 * - 1: Ethereum Mainnet
 * - 5: Goerli Testnet
 * - 11155111: Sepolia Testnet
 *
 * @example
 * ```ts
 * const caip10 = createEthereumCaip10(address, 1);
 * // Result: "eip155:1:0x742d35cc6634c0532925a3b844bc9e7595f42e"
 * ```
 */
export function createEthereumCaip10(address: `0x${string}`, chainId: number = 1): string {
    return `eip155:${chainId}:${address.toLowerCase()}`;
}
