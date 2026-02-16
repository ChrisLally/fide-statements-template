/**
 * FCP SDK Merkle Tree Utilities
 * Build and verify Merkle trees for batch attestations
 * 
 * Uses SHA-256 for hashing (same as Fide ID derivation).
 * Zero external dependencies - uses native Web Crypto API.
 */

/**
 * Merkle proof element
 */
export interface MerkleProofElement {
    /** The sibling hash at this level */
    hash: string;
    /** Position of the sibling: 'left' or 'right' */
    position: 'left' | 'right';
}

/**
 * Merkle proof for a specific leaf
 */
export type MerkleProof = MerkleProofElement[];

/**
 * Result from building a Merkle tree
 */
export interface MerkleTreeResult {
    /** The Merkle root (hex string) */
    root: string;
    /** Proofs for each leaf, indexed by leaf value */
    proofs: Map<string, MerkleProof>;
    /** The leaves used to build the tree (normalized) */
    leaves: string[];
}

/**
 * Get the Web Crypto API (works in browsers and Node.js)
 */
async function getSubtleCrypto(): Promise<SubtleCrypto> {
    if (globalThis.crypto?.subtle) {
        return globalThis.crypto.subtle;
    }
    const { webcrypto } = await import("node:crypto");
    return webcrypto.subtle as unknown as SubtleCrypto;
}

/**
 * Hash two values together using SHA-256
 * Sorts inputs to ensure consistent ordering
 */
async function hashPair(left: string, right: string): Promise<string> {
    const subtle = await getSubtleCrypto();

    // Concatenate left + right (already sorted at construction time)
    const combined = left + right;
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);

    const hashBuffer = await subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize a Fide ID to a consistent hex format for hashing
 * Accepts: "did:fide:0x..." or "0x..."
 * Returns: lowercase hex without prefix
 */
function normalizeLeaf(fideId: string): string {
    const trimmed = fideId.trim().toLowerCase();

    if (trimmed.startsWith('did:fide:0x')) {
        return trimmed.slice('did:fide:0x'.length);
    }
    if (trimmed.startsWith('0x')) {
        return trimmed.slice(2);
    }
    return trimmed;
}

/**
 * Build a Merkle tree from an array of Fide IDs
 *
 * The tree is built bottom-up by iteratively hashing pairs of nodes.
 * If there's an odd number of nodes, the last node is duplicated.
 *
 * @param leaves - Array of statement Fide IDs to include in the tree
 * @returns MerkleTreeResult with root and proofs for each leaf
 * @throws Error if leaves array is empty
 * 
 * @example
 * ```ts
 * const result = await buildMerkleTree([
 *   'did:fide:0x00abc...',
 *   'did:fide:0x00def...',
 *   'did:fide:0x00ghi...'
 * ]);
 * 
 * console.log('Root:', result.root);
 * console.log('Proof for first leaf:', result.proofs.get('did:fide:0x00abc...'));
 * ```
 */
export async function buildMerkleTree(leaves: string[]): Promise<MerkleTreeResult> {
    if (leaves.length === 0) {
        throw new Error('Cannot build Merkle tree from empty array');
    }

    // Normalize all leaves
    const normalizedLeaves = leaves.map(normalizeLeaf);

    // Initialize proofs map (keyed by original leaf value)
    const proofs = new Map<string, MerkleProof>();
    leaves.forEach(leaf => proofs.set(leaf, []));

    // Also map normalized → original for lookup
    const normalizedToOriginal = new Map<string, string>();
    leaves.forEach((original, i) => {
        normalizedToOriginal.set(normalizedLeaves[i], original);
    });

    // Build tree level by level
    let currentLevel = [...normalizedLeaves];

    // Track which original leaves each node represents
    // At level 0, each node represents itself
    let nodeToLeaves: Map<string, string[]> = new Map();
    normalizedLeaves.forEach(leaf => nodeToLeaves.set(leaf, [leaf]));

    while (currentLevel.length > 1) {
        const nextLevel: string[] = [];
        const nextNodeToLeaves: Map<string, string[]> = new Map();

        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left; // Duplicate if odd

            const parent = await hashPair(left, right);
            nextLevel.push(parent);

            // Track which leaves this parent represents
            const leftLeaves = nodeToLeaves.get(left) || [];
            const rightLeaves = nodeToLeaves.get(right) || [];
            nextNodeToLeaves.set(parent, [...leftLeaves, ...rightLeaves]);

            // Add proof elements for all leaves on each side
            // Leaves on the left get right sibling, leaves on the right get left sibling
            for (const leafNorm of leftLeaves) {
                const original = normalizedToOriginal.get(leafNorm)!;
                const proof = proofs.get(original)!;
                proof.push({ hash: right, position: 'right' });
            }

            // Only add if right != left (not a duplicate)
            if (left !== right) {
                for (const leafNorm of rightLeaves) {
                    const original = normalizedToOriginal.get(leafNorm)!;
                    const proof = proofs.get(original)!;
                    proof.push({ hash: left, position: 'left' });
                }
            }
        }

        currentLevel = nextLevel;
        nodeToLeaves = nextNodeToLeaves;
    }

    return {
        root: currentLevel[0],
        proofs,
        leaves
    };
}

/**
 * Verify that a leaf is part of a Merkle tree given its proof
 *
 * @param leaf - The leaf value to verify in Merkle tree
 * @param proof - The Merkle proof path (array of hashes from leaf to root)
 * @param root - The Merkle tree root hash (0x-prefixed hex)
 * @returns True if the proof is valid
 * 
 * @example
 * ```ts
 * const isValid = await verifyMerkleProof(
 *   'did:fide:0x00abc...',
 *   proof,
 *   root
 * );
 * ```
 */
export async function verifyMerkleProof(
    leaf: string,
    proof: MerkleProof,
    root: string
): Promise<boolean> {
    let currentHash = normalizeLeaf(leaf);

    for (const element of proof) {
        if (element.position === 'left') {
            currentHash = await hashPair(element.hash, currentHash);
        } else {
            currentHash = await hashPair(currentHash, element.hash);
        }
    }

    return currentHash === root;
}
