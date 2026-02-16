/**
 * FCP SDK EIP-191 Signing Utilities
 * Ethereum-compatible signing using EIP-191 Personal Sign (requires viem peer dependency)
 */

/**
 * Detect which package manager is being used
 */
function detectPackageManager(): string {
    const userAgent = process.env.npm_config_user_agent || '';

    if (userAgent.includes('pnpm')) return 'pnpm add viem';
    if (userAgent.includes('yarn')) return 'yarn add viem';
    if (userAgent.includes('bun')) return 'bun add viem';
    if (userAgent.includes('npm')) return 'npm install viem';

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
            'EIP-191 signing requires viem to be installed.\n\n' +
            `Install it with: ${installCommand}\n\n` +
            'Or use the zero-dependency Ed25519 signing instead:\n' +
            '  import { generateEd25519KeyPair, signEd25519 } from \'@fide.work/fcp\''
        );
    }
}

/**
 * Sign data using EIP-191 Personal Sign
 *
 * Requires viem to be installed as a peer dependency.
 *
 * @param data - The data/message to sign or verify (hex string for EIP standards, plaintext for EIP-191)
 * @param privateKey - The private key for signing (0x-prefixed hex)
 * @returns Hex-encoded signature
 * @throws Error if viem is not installed
 *
 * @remarks
 * This function implements EIP-191 Personal Sign, which:
 * - Prefixes the data with the Ethereum signed message header
 * - Hashes the prefixed data with Keccak256
 * - Signs using the Ethereum private key
 *
 * Commonly used for Ethereum wallet signatures.
 *
 * @example
 * ```ts
 * const signature = await signEip191(merkleRoot, privateKey);
 * ```
 */
export async function signEip191(
    data: string,
    privateKey: `0x${string}`
): Promise<`0x${string}`> {
    await checkViemInstalled();
    const { privateKeyToAccount } = await import('viem/accounts');

    const account = privateKeyToAccount(privateKey);
    const signature = await account.signMessage({
        message: data
    });

    return signature;
}

/**
 * Verify an EIP-191 signature
 *
 * Requires viem to be installed as a peer dependency.
 *
 * @param data - The data/message to sign or verify (hex string for EIP standards, plaintext for EIP-191)
 * @param signature - The cryptographic signature (0x-prefixed hex string)
 * @param address - The signer's Ethereum address (0x-prefixed hex)
 * @returns True if signature is valid
 * @throws Error if viem is not installed
 *
 * @remarks
 * This function verifies an EIP-191 Personal Sign signature by:
 * - Reconstructing the signed message with the Ethereum header
 * - Checking that the signature matches the expected signer address
 *
 * @example
 * ```ts
 * const isValid = await verifyEip191(merkleRoot, signature, address);
 * ```
 */
export async function verifyEip191(
    data: string,
    signature: `0x${string}`,
    address: `0x${string}`
): Promise<boolean> {
    await checkViemInstalled();
    const { verifyMessage } = await import('viem');

    return await verifyMessage({
        address,
        message: data,
        signature
    });
}
