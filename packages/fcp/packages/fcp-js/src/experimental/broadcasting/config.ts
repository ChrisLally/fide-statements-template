/**
 * FCP Registry Configuration
 * 
 * Allows registries to specify where attestations are located
 * and other registry metadata.
 */

export interface FCPRegistryConfig {
    /** Path to attestations directory (relative to repo root) */
    attestationsPath?: string;
    /** Optional registry metadata */
    metadata?: {
        name?: string;
        description?: string;
    };
}

/**
 * Default attestation paths to check if no config file exists
 */
export const DEFAULT_ATTESTATION_PATHS = [
    'attestations',
    'fcp-attestations',
    '.fcp/attestations'
];

/**
 * Default attestations path (used when generating paths)
 */
export const DEFAULT_ATTESTATIONS_PATH = 'attestations';

/**
 * Registry config filename
 */
export const REGISTRY_CONFIG_FILENAME = '.fcp-registry.json';
