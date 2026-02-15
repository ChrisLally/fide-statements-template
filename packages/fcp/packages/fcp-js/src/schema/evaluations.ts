/**
 * FCP SDK Evaluation Method Constants
 */

/**
 * Common Fide evaluation methods.
 * 
 * These are used as predicates in Evaluation (0xe5) statements.
 */
export const FIDE_EVALUATION_METHODS = {
    /** 
     * Trust in an identity resolution (owl:sameAs) claim.
     * Evaluates a Statement about owl:sameAs.
     */
    aliasResolutionTrust: 'https://github.com/fide-work/evaluation-methods/alias-resolution-trust/v1',

    /**
     * Trust in an owl:sameAs claim specifically for Person entities.
     */
    owlSameAsPerson: 'https://github.com/fide-work/evaluation-methods/owl-sameas-person/v1',

    /**
     * Trust in an owl:sameAs claim specifically for Organization entities.
     */
    owlSameAsOrganization: 'https://github.com/fide-work/evaluation-methods/owl-sameas-organization/v1',

    /**
     * Trust in the accuracy of a statement.
     */
    statementAccuracy: 'https://github.com/fide-work/evaluation-methods/statement-accuracy/v1',

    /**
     * Trust in bridging consensus.
     */
    bridgingConsensus: 'https://github.com/fide-work/evaluation-methods/bridging-consensus/v1'
} as const;
