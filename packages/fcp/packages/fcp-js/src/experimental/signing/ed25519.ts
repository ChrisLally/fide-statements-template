/**
 * FCP SDK Signing Utilities
 * Ed25519 key generation and signing using native Web Crypto API
 */

/**
 * Ed25519 Key Pair
 */
export interface Ed25519KeyPair {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
}

/**
 * Exported Ed25519 Keys (hex strings)
 */
export interface ExportedEd25519Keys {
    publicKeyHex: string;
    privateKeyHex: string;
    address: string; // Derived address for CAIP-10
}

/**
 * Get the Web Crypto API (works in browsers and Node.js)
 */
async function getWebCrypto(): Promise<Crypto> {
    if (globalThis.crypto) {
        return globalThis.crypto;
    }
    // Node.js fallback
    const { webcrypto } = await import("node:crypto");
    return webcrypto as unknown as Crypto;
}

/**
 * Generate a new Ed25519 key pair for signing
 *
 * Uses native Web Crypto API - no external dependencies required.
 *
 * @returns Promise resolving to a CryptoKey pair
 *
 * @remarks
 * This is a zero-dependency function that works in both Node.js and browsers.
 * The generated key pair can be exported as hex strings using {@link exportEd25519Keys}.
 *
 * @example
 * ```ts
 * const keyPair = await generateEd25519KeyPair();
 * const exported = await exportEd25519Keys(keyPair);
 * console.log('Address:', exported.address);
 * ```
 */
export async function generateEd25519KeyPair(): Promise<Ed25519KeyPair> {
    const crypto = await getWebCrypto();

    const keyPair = await crypto.subtle.generateKey(
        {
            name: "Ed25519",
        },
        true, // extractable
        ["sign", "verify"]
    );

    return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey
    };
}

/**
 * Export Ed25519 keys as hex strings
 *
 * @param keyPair - The Ed25519 key pair (JWK format)
 * @returns Exported keys with public key, private key, and derived address
 *
 * @remarks
 * Keys are exported in standard formats:
 * - Public key: SubjectPublicKeyInfo (SPKI) format as hex
 * - Private key: PKCS8 format as hex
 * - Address: Derived from the raw public key bytes (last 32 bytes of SPKI key)
 *
 * @example
 * ```ts
 * const keyPair = await generateEd25519KeyPair();
 * const { publicKeyHex, privateKeyHex, address } = await exportEd25519Keys(keyPair);
 * ```
 */
export async function exportEd25519Keys(keyPair: Ed25519KeyPair): Promise<ExportedEd25519Keys> {
    const crypto = await getWebCrypto();

    // Export public key (SubjectPublicKeyInfo format)
    const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyHex = Buffer.from(publicKeyBuffer).toString("hex");

    // Export private key (PKCS8 format)
    const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const privateKeyHex = Buffer.from(privateKeyBuffer).toString("hex");

    // Derive address from public key (last 32 bytes of public key in hex)
    // Ed25519 public keys are 32 bytes, but SPKI format adds metadata
    const publicKeyBytes = new Uint8Array(publicKeyBuffer);
    const rawPublicKey = publicKeyBytes.slice(-32); // Last 32 bytes are the actual key
    const address = Buffer.from(rawPublicKey).toString("hex");

    return {
        publicKeyHex,
        privateKeyHex,
        address
    };
}

/**
 * Import Ed25519 keys from hex strings
 *
 * @param publicKeyHex - Public key in hex format (SPKI)
 * @param privateKeyHex - Private key in hex format (PKCS8)
 * @returns Imported CryptoKey pair
 *
 * @remarks
 * Keys must be in standard formats:
 * - Public key: SubjectPublicKeyInfo (SPKI) format as hex
 * - Private key: PKCS8 format as hex
 *
 * Use this to restore keys previously exported with {@link exportEd25519Keys}.
 *
 * @example
 * ```ts
 * const keyPair = await importEd25519Keys(publicKeyHex, privateKeyHex);
 * ```
 */
export async function importEd25519Keys(
    publicKeyHex: string,
    privateKeyHex: string
): Promise<Ed25519KeyPair> {
    const crypto = await getWebCrypto();

    const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");
    const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");

    const publicKey = await crypto.subtle.importKey(
        "spki",
        publicKeyBuffer,
        {
            name: "Ed25519",
        },
        true,
        ["verify"]
    );

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privateKeyBuffer,
        {
            name: "Ed25519",
        },
        true,
        ["sign"]
    );

    return { publicKey, privateKey };
}

/**
 * Sign data using Ed25519 private key
 *
 * @param data - The data/message to sign or verify (hex string for EIP standards, plaintext for EIP-191)
 * @param privateKey - The Ed25519 key pair (JWK format)
 * @returns Hex-encoded signature
 *
 * @remarks
 * This function:
 * - UTF-8 encodes the input data
 * - Signs using the Ed25519 algorithm
 * - Returns the signature as a hex string
 *
 * @example
 * ```ts
 * const signature = await signEd25519("Hello, world!", keyPair.privateKey);
 * ```
 */
export async function signEd25519(data: string, privateKey: CryptoKey): Promise<string> {
    const crypto = await getWebCrypto();
    const encoder = new TextEncoder();

    const signature = await crypto.subtle.sign(
        "Ed25519",
        privateKey,
        encoder.encode(data)
    );

    return Buffer.from(signature).toString("hex");
}

/**
 * Verify an Ed25519 signature
 *
 * @param data - The data/message to sign or verify (hex string for EIP standards, plaintext for EIP-191)
 * @param signatureHex - The cryptographic signature (0x-prefixed hex string)
 * @param publicKey - The Ed25519 key pair (JWK format)
 * @returns True if signature is valid
 *
 * @remarks
 * This function:
 * - UTF-8 encodes the input data
 * - Verifies the hex-encoded signature using the Ed25519 algorithm
 * - Returns true only if the signature is cryptographically valid
 *
 * @example
 * ```ts
 * const isValid = await verifyEd25519("Hello, world!", signature, keyPair.publicKey);
 * ```
 */
export async function verifyEd25519(
    data: string,
    signatureHex: string,
    publicKey: CryptoKey
): Promise<boolean> {
    const crypto = await getWebCrypto();
    const encoder = new TextEncoder();

    const signature = Buffer.from(signatureHex, "hex");

    return await crypto.subtle.verify(
        "Ed25519",
        publicKey,
        signature,
        encoder.encode(data)
    );
}
