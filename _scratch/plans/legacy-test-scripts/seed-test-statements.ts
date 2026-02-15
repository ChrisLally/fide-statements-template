/**
 * Seed test attestations for FCP Playground
 *
 * This script demonstrates using centralized dictionaries for Schema.org and FIDE constants.
 * All predicates and types are imported from dictionary files for consistency.
 *
 * ## Fide ID Structure
 *
 * Every Fide ID is composite of three parts:
 * - Entity Type (1 hex char): What kind of entity (Person=1, Organization=2, CreativeWork=6, etc.)
 * - Identifier Source (1 hex char): How the entity is identified (Product=5, CreativeWork=6, CryptographicAccount=8, Statement=0, etc.)
 * - Fingerprint (38 hex chars): Last 19 bytes of the hash returned by calculateFideId(rawIdentifier)
 *
 * Example: 0x15abcd1234567890abcdef1234567890abcdef12
 *          └─ Type  └─ Source  └──────── Fingerprint (19 bytes = 38 hex chars) ────────┘
 *
 * The rawIdentifier is the pre-image string that was hashed to create the fingerprint.
 * For statements, the rawIdentifier is normalized deterministic JSON: { s: subjectFideId, p: predicateFideId, o: objectFideId }
 * For attestations, the rawIdentifier is normalized deterministic JSON: { m: method, u: caip10User, r: merkleRoot, s: signature }
 *
 * All statements in one batch are signed together:
 * 1. Calculate statement FideIds for each statement
 * 2. Build Merkle root from all statement FideIds
 * 3. Sign the merkle root (one signature covers entire batch)
 * 4. Create one Attestation entity with that signature
 *
 * Usage: pnpm fcp:s
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateFideId, calculateStatementFideId, getStatementRawIdentifier } from '@/lib/fcp/fide-id';
import { createAndBroadcastBatchStatements, type StatementDefinition } from '@/lib/fcp/broadcast/batch-signer';
import { getTestSignerKey } from '@/lib/fcp/seed-helpers';
import type { Database } from '@/types/supabase';
import { getNYCStartOfDayISO } from '@/lib/fcp/time';

dotenv.config({ path: '../../.env' });

// Import from centralized dictionaries
import {
    PREDICATE_TYPE,
    PREDICATE_NAME,
    PREDICATE_DESCRIPTION,
    PREDICATE_WORKS_FOR,
    PREDICATE_CREATOR,
    PREDICATE_KNOWS,
    PREDICATE_OWNS,
    PREDICATE_SAME_AS,
    PREDICATE_KNOWS_ABOUT,
    PREDICATE_INTEREST,
    PREDICATE_KEYWORDS,
    PREDICATE_AGENT,
    PREDICATE_ACTION_STATUS,
    PREDICATE_RESULT,
    PREDICATE_EVIDENCE,
    PREDICATE_PROCEDURE,
    ENTITY_TYPE_PERSON,
    ENTITY_TYPE_ORGANIZATION,
    ENTITY_TYPE_PRODUCT,
    ENTITY_TYPE_CREATIVE_WORK,
    ENTITY_TYPE_EVENT,
    ENTITY_TYPE_PLACE,
    ENTITY_TYPE_REVIEW,
    PREDICATE_REVIEW_RATING,
    ACTION_STATUS_COMPLETED,
} from '@/lib/fcp/vocab';

import {
    PREDICATE_CONTROL,
    PREDICATE_REASONING,
    PREDICATE_REPLACES,
    ENTITY_TYPE_AUTONOMOUS_AGENT,
    ENTITY_TYPE_CRYPTOGRAPHIC_ACCOUNT,
    METHOD_ALIAS_RESOLUTION_TRUST,
    METHOD_STATEMENT_ACCURACY_V1,
    METHOD_STATEMENT_ACCURACY,
    METHOD_QUALITY_SCORE,
    METHOD_RELIABILITY_SCORE,
    METHOD_ALIGNMENT_INDEX,
    METHOD_SKILL_PROFICIENCY,
    METHOD_SPAM_DETECTOR,
    METHOD_BRIDGING_CONSENSUS,
    METHOD_NAME_RESOLUTION,
    METHOD_DESCRIPTION_RESOLUTION
} from '@/lib/fcp/vocab';

// ============================================================================
// TYPES
// ============================================================================


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

async function generateDeterministicFideId(seed: string, entityType: string = 'Person', sourceType: string = 'Product'): Promise<`0x${string}`> {
    return await calculateFideId(entityType as any, sourceType as any, seed);
}


// ============================================================================
// MAIN SEEDING LOGIC
// ============================================================================

async function main() {
    console.log('🌱 Seeding test attestations...\n');

    const fixedTimestamp = getNYCStartOfDayISO();

    const account = privateKeyToAccount(getTestSignerKey());

    // ==========================================================================
    // ENTITY IDs
    // ==========================================================================

    // People
    const aliceId = await generateDeterministicFideId('alice-person-2024', 'Person', 'Product');
    const bobId = await generateDeterministicFideId('bob-person-2024', 'Person', 'Product');
    const charlieId = await generateDeterministicFideId('charlie-person-2024', 'Person', 'Product');
    const danaId = await generateDeterministicFideId('dana-person-2024', 'Person', 'Product');
    const eveId = await generateDeterministicFideId('eve-person-2024', 'Person', 'Product');
    const frankId = await generateDeterministicFideId('frank-person-2024', 'Person', 'Product');

    // Organizations
    const acmeId = await generateDeterministicFideId('acme-org-2024', 'Organization', 'Product');
    const intuitionId = await generateDeterministicFideId('intuition-org-2024', 'Organization', 'Product');
    const techCorpId = await generateDeterministicFideId('techcorp-org-2024', 'Organization', 'Product');
    const startupXId = await generateDeterministicFideId('startupx-org-2024', 'Organization', 'Product');
    const acmeDuplicateId = await generateDeterministicFideId('acme-duplicate-org-2024', 'Organization', 'Product'); // For sameAs testing

    // Products
    const widgetProId = await generateDeterministicFideId('widget-pro-product-2024', 'Product', 'Product');
    const dataVaultId = await generateDeterministicFideId('datavault-product-2024', 'Product', 'Product');
    const aiAssistantId = await generateDeterministicFideId('ai-assistant-product-2024', 'Product', 'Product');

    // Agents
    const fideBotId = await generateDeterministicFideId('fidebot-agent-2024', 'AutonomousAgent', 'Product');
    const reviewBotId = await generateDeterministicFideId('reviewbot-agent-2024', 'AutonomousAgent', 'Product');
    const indexerBotId = await generateDeterministicFideId('indexerbot-agent-2024', 'AutonomousAgent', 'Product');

    // Events
    const acmeDevConId = await generateDeterministicFideId('acme-devcon-event-2024', 'Event', 'Product');
    const hackathonId = await generateDeterministicFideId('hackathon-event-2024', 'Event', 'Product');
    const conferenceId = await generateDeterministicFideId('conference-event-2024', 'Event', 'Product');

    // Places
    const acmeHQId = await generateDeterministicFideId('acme-hq-place-2024', 'Place', 'Product');
    const techHubId = await generateDeterministicFideId('tech-hub-place-2024', 'Place', 'Product');
    const coworkingId = await generateDeterministicFideId('coworking-place-2024', 'Place', 'Product');

    // Creative Works
    const acmeDocsId = await generateDeterministicFideId('acme-docs-2024', 'CreativeWork', 'CreativeWork');
    const whitepaperId = await generateDeterministicFideId('whitepaper-2024', 'CreativeWork', 'CreativeWork');
    const tutorialId = await generateDeterministicFideId('tutorial-2024', 'CreativeWork', 'CreativeWork');
    const researchPaperId = await generateDeterministicFideId('research-paper-2024', 'CreativeWork', 'CreativeWork');

    // Article with URL-based alias (to test CreativeWork resolution)
    const articleUrl = 'https://foundationcapital.com/context-graphs-ais-trillion-dollar-opportunity/';
    const articleAliasId = await calculateFideId('CreativeWork', 'Product', articleUrl); // 0x65... (Product-sourced)

    // Methodologies (for evaluations) - these will be calculated as genesis Statement IDs after broadcasting
    // PLACEHOLDER: These will be updated after evaluation method genesis statements are broadcast
    let entityCredibilityMethod: string = '';  // Will become Statement ID (0x00...) - for evaluating entity credibility
    let statementAccuracyMethod: string = '';  // Will become Statement ID (0x00...) - for evaluating statement accuracy
    let qualityMethod: string = '';
    let reliabilityMethod: string = '';
    let alignmentMethod: string = '';
    let proficiencyMethod: string = '';

    // For creating EvaluationMethod ENTITIES (as subjects), use Product source with GitHub URLs
    // These are aliases (0xe5) that will resolve to Statement-derived primaries (0xe0)
    // The rawIdentifier is a unique GitHub URL
    const aliasResolutionTrustMethodId = await calculateFideId('EvaluationMethod', 'Product', METHOD_ALIAS_RESOLUTION_TRUST);
    const trustScoreMethodId = await calculateFideId('EvaluationMethod', 'Product', METHOD_BRIDGING_CONSENSUS);
    const qualityMethodId = await calculateFideId('EvaluationMethod', 'Product', METHOD_QUALITY_SCORE);
    const reliabilityMethodId = await calculateFideId('EvaluationMethod', 'Product', METHOD_RELIABILITY_SCORE);
    const alignmentMethodId = await calculateFideId('EvaluationMethod', 'Product', METHOD_ALIGNMENT_INDEX);
    const proficiencyMethodId = await calculateFideId('EvaluationMethod', 'Product', METHOD_SKILL_PROFICIENCY);
    const nameResolutionMethodId = await calculateFideId('EvaluationMethod', 'Product', METHOD_NAME_RESOLUTION);
    const descriptionResolutionMethodId = await calculateFideId('EvaluationMethod', 'Product', METHOD_DESCRIPTION_RESOLUTION);
    const spamPolicyId = await generateDeterministicFideId('spam-policy-2024', 'CreativeWork', 'CreativeWork'); // Keep for policy flags

    // Cryptographic Accounts
    const aliceKeyId = await generateDeterministicFideId('alice-signing-key-2024', 'CryptographicAccount', 'CryptographicAccount');
    const bobKeyId = await generateDeterministicFideId('bob-signing-key-2024', 'CryptographicAccount', 'CryptographicAccount');
    const charlieKeyId = await generateDeterministicFideId('charlie-signing-key-2024', 'CryptographicAccount', 'CryptographicAccount');
    const fideBotKeyId = await generateDeterministicFideId('fidebot-signing-key-2024', 'CryptographicAccount', 'CryptographicAccount');
    const reviewBotKeyId = await generateDeterministicFideId('reviewbot-signing-key-2024', 'CryptographicAccount', 'CryptographicAccount');

    // Map Fide IDs to their raw identifiers for use in statements
    const fideIdToRawIdentifier = new Map<`0x${string}`, string>([
        // People
        [aliceId, 'alice-person-2024'],
        [bobId, 'bob-person-2024'],
        [charlieId, 'charlie-person-2024'],
        [danaId, 'dana-person-2024'],
        [eveId, 'eve-person-2024'],
        [frankId, 'frank-person-2024'],
        // Organizations
        [acmeId, 'acme-org-2024'],
        [intuitionId, 'intuition-org-2024'],
        [techCorpId, 'techcorp-org-2024'],
        [startupXId, 'startupx-org-2024'],
        [acmeDuplicateId, 'acme-duplicate-org-2024'],
        // Products
        [widgetProId, 'widget-pro-product-2024'],
        [dataVaultId, 'datavault-product-2024'],
        [aiAssistantId, 'ai-assistant-product-2024'],
        // Agents
        [fideBotId, 'fidebot-agent-2024'],
        [reviewBotId, 'reviewbot-agent-2024'],
        [indexerBotId, 'indexerbot-agent-2024'],
        // Events
        [acmeDevConId, 'acme-devcon-event-2024'],
        [hackathonId, 'hackathon-event-2024'],
        [conferenceId, 'conference-event-2024'],
        // Places
        [acmeHQId, 'acme-hq-place-2024'],
        [techHubId, 'tech-hub-place-2024'],
        [coworkingId, 'coworking-place-2024'],
        // Creative Works
        [acmeDocsId, 'acme-docs-2024'],
        [whitepaperId, 'whitepaper-2024'],
        [tutorialId, 'tutorial-2024'],
        [researchPaperId, 'research-paper-2024'],
        [spamPolicyId, 'spam-policy-2024'],
        [articleAliasId, articleUrl],
        // Methods (as entities) - GitHub URLs (0xe5 aliases)
        [aliasResolutionTrustMethodId, METHOD_ALIAS_RESOLUTION_TRUST],
        [trustScoreMethodId, METHOD_BRIDGING_CONSENSUS],
        [qualityMethodId, METHOD_QUALITY_SCORE],
        [reliabilityMethodId, METHOD_RELIABILITY_SCORE],
        [alignmentMethodId, METHOD_ALIGNMENT_INDEX],
        [proficiencyMethodId, METHOD_SKILL_PROFICIENCY],
        [nameResolutionMethodId, METHOD_NAME_RESOLUTION],
        [descriptionResolutionMethodId, METHOD_DESCRIPTION_RESOLUTION],
        // Cryptographic Accounts
        [aliceKeyId, 'alice-signing-key-2024'],
        [bobKeyId, 'bob-signing-key-2024'],
        [charlieKeyId, 'charlie-signing-key-2024'],
        [fideBotKeyId, 'fidebot-signing-key-2024'],
        [reviewBotKeyId, 'reviewbot-signing-key-2024'],
    ]);

    // Add skill entities (used in proficiency evaluations)
    const typescriptSkillId = await calculateFideId('CreativeWork', 'CreativeWork', 'TypeScript');
    const pythonSkillId = await calculateFideId('CreativeWork', 'CreativeWork', 'Python');
    const machineLearningSkillId = await calculateFideId('CreativeWork', 'CreativeWork', 'Machine Learning');
    fideIdToRawIdentifier.set(typescriptSkillId, 'TypeScript');
    fideIdToRawIdentifier.set(pythonSkillId, 'Python');
    fideIdToRawIdentifier.set(machineLearningSkillId, 'Machine Learning');

    // Helper function to get raw identifier for a Fide ID
    const getRawIdentifier = (fideId: `0x${string}`): string => {
        const rawId = fideIdToRawIdentifier.get(fideId);
        if (!rawId) {
            throw new Error(`Missing raw identifier mapping for Fide ID: ${fideId}`);
        }
        return rawId;
    };

    // Helper function to create a statement with proper raw identifiers
    const createStatement = (stmt: {
        subject: `0x${string}`;
        predicate: string;
        object: `0x${string}`;
        objectRawIdentifier: string;
    }): StatementDefinition => {
        return {
            ...stmt,
            subjectRawIdentifier: getRawIdentifier(stmt.subject),
            objectRawIdentifier: stmt.objectRawIdentifier,
        };
    };

    // ==========================================================================
    // 1. EVALUATION METHOD ENTITIES
    // ==========================================================================

    console.log('1️⃣  Evaluation methods...');

    // Map evaluation method GitHub URLs to their predicate name strings
    // These names will be used as the object in genesis statements (schema:name)
    const evaluationMethodNames = new Map<`0x${string}`, string>([
        [aliasResolutionTrustMethodId, 'Fide-AliasResolutionTrust-v1'],
        [trustScoreMethodId, 'Fide-BridgingConsensus-v1'],
        [qualityMethodId, 'Fide-QualityScore-v1'],
        [reliabilityMethodId, 'Fide-ReliabilityScore-v1'],
        [alignmentMethodId, 'Fide-AIAlignment-v1'],
        [proficiencyMethodId, 'Fide-SkillProficiency-v1'],
        [nameResolutionMethodId, 'Fide-NameResolution-v1'],
        [descriptionResolutionMethodId, 'Fide-DescriptionResolution-v1'],
    ]);

    const evaluationMethods: StatementDefinition[] = [
        // Type declarations for EvaluationMethods
        createStatement({ subject: aliasResolutionTrustMethodId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', 'fide:EvaluationMethod'), objectRawIdentifier: 'fide:EvaluationMethod' }),
        createStatement({ subject: trustScoreMethodId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', 'fide:EvaluationMethod'), objectRawIdentifier: 'fide:EvaluationMethod' }),
        createStatement({ subject: qualityMethodId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', 'fide:EvaluationMethod'), objectRawIdentifier: 'fide:EvaluationMethod' }),
        createStatement({ subject: reliabilityMethodId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', 'fide:EvaluationMethod'), objectRawIdentifier: 'fide:EvaluationMethod' }),
        createStatement({ subject: alignmentMethodId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', 'fide:EvaluationMethod'), objectRawIdentifier: 'fide:EvaluationMethod' }),
        createStatement({ subject: proficiencyMethodId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', 'fide:EvaluationMethod'), objectRawIdentifier: 'fide:EvaluationMethod' }),
        createStatement({ subject: nameResolutionMethodId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', 'fide:EvaluationMethod'), objectRawIdentifier: 'fide:EvaluationMethod' }),
        createStatement({ subject: descriptionResolutionMethodId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', 'fide:EvaluationMethod'), objectRawIdentifier: 'fide:EvaluationMethod' }),

        // GENESIS STATEMENTS (schema:name) - These create the Statement IDs used for 0xe0 primaries!
        // Object is the predicate name string (Fide-XXX-v1) that will be used in evaluation statements
        createStatement({ subject: aliasResolutionTrustMethodId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-AliasResolutionTrust-v1'), objectRawIdentifier: 'Fide-AliasResolutionTrust-v1' }),
        createStatement({ subject: trustScoreMethodId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-BridgingConsensus-v1'), objectRawIdentifier: 'Fide-BridgingConsensus-v1' }),
        createStatement({ subject: qualityMethodId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-QualityScore-v1'), objectRawIdentifier: 'Fide-QualityScore-v1' }),
        createStatement({ subject: reliabilityMethodId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-ReliabilityScore-v1'), objectRawIdentifier: 'Fide-ReliabilityScore-v1' }),
        createStatement({ subject: alignmentMethodId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-AIAlignment-v1'), objectRawIdentifier: 'Fide-AIAlignment-v1' }),
        createStatement({ subject: proficiencyMethodId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-SkillProficiency-v1'), objectRawIdentifier: 'Fide-SkillProficiency-v1' }),
        createStatement({ subject: nameResolutionMethodId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-NameResolution-v1'), objectRawIdentifier: 'Fide-NameResolution-v1' }),
        createStatement({ subject: descriptionResolutionMethodId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-DescriptionResolution-v1'), objectRawIdentifier: 'Fide-DescriptionResolution-v1' }),

        // Descriptions
        createStatement({ subject: aliasResolutionTrustMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Evaluates trust in owl:sameAs alias resolutions. Output: Verdict (-1=reject, 0=uncertain, 1=trust)'), objectRawIdentifier: 'Evaluates trust in owl:sameAs alias resolutions. Output: Verdict (-1=reject, 0=uncertain, 1=trust)' }),
        createStatement({ subject: trustScoreMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Aggregates reputation signals from statement accuracy and peer endorsements. Output: Verdict (-1, 0, 1)'), objectRawIdentifier: 'Aggregates reputation signals from statement accuracy and peer endorsements. Output: Verdict (-1, 0, 1)' }),
        createStatement({ subject: qualityMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Evaluates content quality based on completeness and accuracy. Output: Verdict (-1, 0, 1)'), objectRawIdentifier: 'Evaluates content quality based on completeness and accuracy. Output: Verdict (-1, 0, 1)' }),
        createStatement({ subject: reliabilityMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Measures service uptime and operational reliability. Output: Score 0-100'), objectRawIdentifier: 'Measures service uptime and operational reliability. Output: Score 0-100' }),
        createStatement({ subject: alignmentMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Evaluates AI agent behavior for safety and goal alignment. Output: Score 0-100'), objectRawIdentifier: 'Evaluates AI agent behavior for safety and goal alignment. Output: Score 0-100' }),
        createStatement({ subject: proficiencyMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Rates skill mastery from novice to expert. Output: Level 1-5'), objectRawIdentifier: 'Rates skill mastery from novice to expert. Output: Level 1-5' }),
        createStatement({ subject: nameResolutionMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Evaluates trust in schema:name assertions. Used for trusted name resolution. Output: Verdict (-1=reject, 0=uncertain, 1=trust)'), objectRawIdentifier: 'Evaluates trust in schema:name assertions. Used for trusted name resolution. Output: Verdict (-1=reject, 0=uncertain, 1=trust)' }),
        createStatement({ subject: descriptionResolutionMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Evaluates trust in schema:description assertions. Used for trusted description resolution. Output: Verdict (-1=reject, 0=uncertain, 1=trust)'), objectRawIdentifier: 'Evaluates trust in schema:description assertions. Used for trusted description resolution. Output: Verdict (-1=reject, 0=uncertain, 1=trust)' }),
    ];

    console.log(`   ✓ ${evaluationMethods.length} evaluation methods`);

    // Broadcast evaluation methods FIRST (includes genesis statements)
    console.log('\n📦 Broadcasting evaluation method statements...');
    await createAndBroadcastBatchStatements(evaluationMethods, fixedTimestamp, account);
    console.log(`✅ Broadcasted ${evaluationMethods.length} evaluation method statements`);

    // Calculate genesis Statement IDs for use as predicates in evaluation statements
    console.log('\n🔍 Calculating genesis Statement IDs for evaluation methods...');
    const predicateNameId = await calculateFideId('CreativeWork', 'CreativeWork', PREDICATE_NAME) as `0x${string}`;

    const aliasResolutionTrustMethod = await calculateStatementFideId(
        aliasResolutionTrustMethodId,
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-AliasResolutionTrust-v1')
    );
    entityCredibilityMethod = await calculateStatementFideId(
        await calculateFideId('EvaluationMethod', 'Product', METHOD_STATEMENT_ACCURACY_V1),
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-StatementAccuracy-v1')
    );
    statementAccuracyMethod = await calculateStatementFideId(
        await calculateFideId('EvaluationMethod', 'Product', METHOD_STATEMENT_ACCURACY),
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-StatementAccuracy-v1')
    );
    qualityMethod = await calculateStatementFideId(
        qualityMethodId,
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-QualityScore-v1')
    );
    reliabilityMethod = await calculateStatementFideId(
        reliabilityMethodId,
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-ReliabilityScore-v1')
    );
    alignmentMethod = await calculateStatementFideId(
        alignmentMethodId,
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-AIAlignment-v1')
    );
    proficiencyMethod = await calculateStatementFideId(
        proficiencyMethodId,
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-SkillProficiency-v1')
    );
    const nameResolutionMethod = await calculateStatementFideId(
        nameResolutionMethodId,
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-NameResolution-v1')
    );
    const descriptionResolutionMethod = await calculateStatementFideId(
        descriptionResolutionMethodId,
        predicateNameId,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-DescriptionResolution-v1')
    );

    console.log('   ✓ Genesis Statement IDs calculated for evaluation methods');
    console.log(`   - Fide-AliasResolutionTrust-v1: ${aliasResolutionTrustMethod}`);

    // ==========================================================================
    // 2. ENTITY NAMES
    // ==========================================================================

    console.log('2️⃣  Entity names...');

    const entityNames: StatementDefinition[] = [
        // People
        createStatement({ subject: aliceId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Alice Johnson'), objectRawIdentifier: 'Alice Johnson' }),
        createStatement({ subject: aliceId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'AJ'), objectRawIdentifier: 'AJ' }),
        createStatement({ subject: bobId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Bob Smith'), objectRawIdentifier: 'Bob Smith' }),
        createStatement({ subject: charlieId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Charlie Chen'), objectRawIdentifier: 'Charlie Chen' }),
        createStatement({ subject: danaId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Dana Williams'), objectRawIdentifier: 'Dana Williams' }),
        createStatement({ subject: eveId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Eve Martinez'), objectRawIdentifier: 'Eve Martinez' }),
        createStatement({ subject: frankId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Frank Lee'), objectRawIdentifier: 'Frank Lee' }),
        // Organizations
        createStatement({ subject: acmeId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Acme Corporation'), objectRawIdentifier: 'Acme Corporation' }),
        createStatement({ subject: acmeId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Acme Corp'), objectRawIdentifier: 'Acme Corp' }),
        createStatement({ subject: intuitionId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Intuition Systems'), objectRawIdentifier: 'Intuition Systems' }),
        createStatement({ subject: techCorpId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'TechCorp Industries'), objectRawIdentifier: 'TechCorp Industries' }),
        createStatement({ subject: startupXId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'StartupX'), objectRawIdentifier: 'StartupX' }),
        createStatement({ subject: acmeDuplicateId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'ACME Corp'), objectRawIdentifier: 'ACME Corp' }),
        // Products
        createStatement({ subject: widgetProId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Widget Pro'), objectRawIdentifier: 'Widget Pro' }),
        createStatement({ subject: dataVaultId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'DataVault Enterprise'), objectRawIdentifier: 'DataVault Enterprise' }),
        createStatement({ subject: aiAssistantId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'AI Assistant Pro'), objectRawIdentifier: 'AI Assistant Pro' }),
        // Agents
        createStatement({ subject: fideBotId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'FideBot Agent #001'), objectRawIdentifier: 'FideBot Agent #001' }),
        createStatement({ subject: reviewBotId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'ReviewBot Agent #002'), objectRawIdentifier: 'ReviewBot Agent #002' }),
        createStatement({ subject: indexerBotId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'IndexerBot Agent #003'), objectRawIdentifier: 'IndexerBot Agent #003' }),
        // Events
        createStatement({ subject: acmeDevConId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Acme DevCon 2024'), objectRawIdentifier: 'Acme DevCon 2024' }),
        createStatement({ subject: hackathonId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Global AI Hackathon 2024'), objectRawIdentifier: 'Global AI Hackathon 2024' }),
        createStatement({ subject: conferenceId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Web3 Identity Conference'), objectRawIdentifier: 'Web3 Identity Conference' }),
        // Places
        createStatement({ subject: acmeHQId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Acme HQ San Francisco'), objectRawIdentifier: 'Acme HQ San Francisco' }),
        createStatement({ subject: techHubId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Silicon Valley Tech Hub'), objectRawIdentifier: 'Silicon Valley Tech Hub' }),
        createStatement({ subject: coworkingId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Downtown Coworking Space'), objectRawIdentifier: 'Downtown Coworking Space' }),
        // Creative Works
        createStatement({ subject: acmeDocsId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Acme Engineering Standards'), objectRawIdentifier: 'Acme Engineering Standards' }),
        createStatement({ subject: whitepaperId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Decentralized Identity Whitepaper'), objectRawIdentifier: 'Decentralized Identity Whitepaper' }),
        createStatement({ subject: tutorialId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'FCP Getting Started Tutorial'), objectRawIdentifier: 'FCP Getting Started Tutorial' }),
        createStatement({ subject: researchPaperId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Trust Networks Research Paper'), objectRawIdentifier: 'Trust Networks Research Paper' }),
        // Article with URL alias (testing CreativeWork resolution)
        createStatement({ subject: articleAliasId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Context Graphs: AI\'s Trillion-Dollar Opportunity'), objectRawIdentifier: 'Context Graphs: AI\'s Trillion-Dollar Opportunity' }),
        // Methodologies (evaluationMethods already set trustScoreMethodId and qualityMethodId names)
        createStatement({ subject: spamPolicyId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Anti-Spam Policy v2.0'), objectRawIdentifier: 'Anti-Spam Policy v2.0' }),
    ];

    console.log(`   ✓ ${entityNames.length} entity names`);

    // ==========================================================================
    // 3. DESCRIPTIONS
    // ==========================================================================

    console.log('3️⃣  Descriptions...');

    const descriptions: StatementDefinition[] = [
        createStatement({ subject: acmeId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'A leading technology company building the future of work'), objectRawIdentifier: 'A leading technology company building the future of work' }),
        createStatement({ subject: intuitionId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Pioneering decentralized identity and trust networks'), objectRawIdentifier: 'Pioneering decentralized identity and trust networks' }),
        createStatement({ subject: widgetProId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Enterprise-grade widget management platform'), objectRawIdentifier: 'Enterprise-grade widget management platform' }),
        createStatement({ subject: fideBotId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Autonomous agent for attestation verification and indexing'), objectRawIdentifier: 'Autonomous agent for attestation verification and indexing' }),
        createStatement({ subject: trustScoreMethodId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Community trust score based on statement accuracy and peer endorsements'), objectRawIdentifier: 'Community trust score based on statement accuracy and peer endorsements' }),
        createStatement({ subject: articleAliasId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Article exploring context graphs as a transformative opportunity in artificial intelligence and business'), objectRawIdentifier: 'Article exploring context graphs as a transformative opportunity in artificial intelligence and business' }),
    ];

    console.log(`   ✓ ${descriptions.length} descriptions`);

    // ==========================================================================
    // 4. SKILLS & EXPERTISE
    // ==========================================================================

    console.log('4️⃣  Skills & expertise...');

    const skills: StatementDefinition[] = [
        // Alice - Full-stack developer
        createStatement({ subject: aliceId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'TypeScript'), objectRawIdentifier: 'TypeScript' }),
        createStatement({ subject: aliceId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'React'), objectRawIdentifier: 'React' }),
        createStatement({ subject: aliceId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Solidity'), objectRawIdentifier: 'Solidity' }),
        // Bob - Backend developer
        createStatement({ subject: bobId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Python'), objectRawIdentifier: 'Python' }),
        createStatement({ subject: bobId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'PostgreSQL'), objectRawIdentifier: 'PostgreSQL' }),
        createStatement({ subject: bobId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Kubernetes'), objectRawIdentifier: 'Kubernetes' }),
        // Charlie - ML Engineer
        createStatement({ subject: charlieId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Machine Learning'), objectRawIdentifier: 'Machine Learning' }),
        createStatement({ subject: charlieId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'PyTorch'), objectRawIdentifier: 'PyTorch' }),
        // Dana - Designer
        createStatement({ subject: danaId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'UI/UX Design'), objectRawIdentifier: 'UI/UX Design' }),
        createStatement({ subject: danaId, predicate: PREDICATE_KNOWS_ABOUT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Figma'), objectRawIdentifier: 'Figma' }),
    ];

    console.log(`   ✓ ${skills.length} skills`);

    // ==========================================================================
    // 5. INTERESTS
    // ==========================================================================

    console.log('5️⃣  Interests...');

    const interests: StatementDefinition[] = [
        createStatement({ subject: aliceId, predicate: PREDICATE_INTEREST, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Decentralized Identity'), objectRawIdentifier: 'Decentralized Identity' }),
        createStatement({ subject: aliceId, predicate: PREDICATE_INTEREST, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Web3'), objectRawIdentifier: 'Web3' }),
        createStatement({ subject: bobId, predicate: PREDICATE_INTEREST, object: await calculateFideId('CreativeWork', 'CreativeWork', 'AI Agents'), objectRawIdentifier: 'AI Agents' }),
        createStatement({ subject: charlieId, predicate: PREDICATE_INTEREST, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Trust Networks'), objectRawIdentifier: 'Trust Networks' }),
        createStatement({ subject: eveId, predicate: PREDICATE_INTEREST, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Open Source'), objectRawIdentifier: 'Open Source' }),
    ];

    console.log(`   ✓ ${interests.length} interests`);

    // ==========================================================================
    // 6. TAGS / KEYWORDS
    // ==========================================================================

    console.log('6️⃣  Tags...');

    const tags: StatementDefinition[] = [
        createStatement({ subject: acmeId, predicate: PREDICATE_KEYWORDS, object: await calculateFideId('CreativeWork', 'CreativeWork', 'innovative'), objectRawIdentifier: 'innovative' }),
        createStatement({ subject: acmeId, predicate: PREDICATE_KEYWORDS, object: await calculateFideId('CreativeWork', 'CreativeWork', 'remote-friendly'), objectRawIdentifier: 'remote-friendly' }),
        createStatement({ subject: acmeId, predicate: PREDICATE_KEYWORDS, object: await calculateFideId('CreativeWork', 'CreativeWork', 'enterprise'), objectRawIdentifier: 'enterprise' }),
        createStatement({ subject: widgetProId, predicate: PREDICATE_KEYWORDS, object: await calculateFideId('CreativeWork', 'CreativeWork', 'productivity'), objectRawIdentifier: 'productivity' }),
        createStatement({ subject: widgetProId, predicate: PREDICATE_KEYWORDS, object: await calculateFideId('CreativeWork', 'CreativeWork', 'saas'), objectRawIdentifier: 'saas' }),
        createStatement({ subject: intuitionId, predicate: PREDICATE_KEYWORDS, object: await calculateFideId('CreativeWork', 'CreativeWork', 'web3'), objectRawIdentifier: 'web3' }),
        createStatement({ subject: intuitionId, predicate: PREDICATE_KEYWORDS, object: await calculateFideId('CreativeWork', 'CreativeWork', 'identity'), objectRawIdentifier: 'identity' }),
    ];

    console.log(`   ✓ ${tags.length} tags`);

    // ==========================================================================
    // 7. RELATIONSHIPS
    // ==========================================================================

    console.log('7️⃣  Relationships...');

    const relationships: StatementDefinition[] = [
        // Employment (worksFor)
        createStatement({ subject: aliceId, predicate: PREDICATE_WORKS_FOR, object: acmeId, objectRawIdentifier: getRawIdentifier(acmeId) }),
        createStatement({ subject: bobId, predicate: PREDICATE_WORKS_FOR, object: acmeId, objectRawIdentifier: getRawIdentifier(acmeId) }),
        createStatement({ subject: charlieId, predicate: PREDICATE_WORKS_FOR, object: intuitionId, objectRawIdentifier: getRawIdentifier(intuitionId) }),
        createStatement({ subject: danaId, predicate: PREDICATE_WORKS_FOR, object: techCorpId, objectRawIdentifier: getRawIdentifier(techCorpId) }),
        createStatement({ subject: eveId, predicate: PREDICATE_WORKS_FOR, object: startupXId, objectRawIdentifier: getRawIdentifier(startupXId) }),
        createStatement({ subject: frankId, predicate: PREDICATE_WORKS_FOR, object: intuitionId, objectRawIdentifier: getRawIdentifier(intuitionId) }),
        // Social (knows)
        createStatement({ subject: aliceId, predicate: PREDICATE_KNOWS, object: bobId, objectRawIdentifier: getRawIdentifier(bobId) }),
        createStatement({ subject: aliceId, predicate: PREDICATE_KNOWS, object: charlieId, objectRawIdentifier: getRawIdentifier(charlieId) }),
        createStatement({ subject: aliceId, predicate: PREDICATE_KNOWS, object: danaId, objectRawIdentifier: getRawIdentifier(danaId) }),
        createStatement({ subject: bobId, predicate: PREDICATE_KNOWS, object: charlieId, objectRawIdentifier: getRawIdentifier(charlieId) }),
        createStatement({ subject: bobId, predicate: PREDICATE_KNOWS, object: eveId, objectRawIdentifier: getRawIdentifier(eveId) }),
        createStatement({ subject: charlieId, predicate: PREDICATE_KNOWS, object: frankId, objectRawIdentifier: getRawIdentifier(frankId) }),
        createStatement({ subject: danaId, predicate: PREDICATE_KNOWS, object: eveId, objectRawIdentifier: getRawIdentifier(eveId) }),
        createStatement({ subject: eveId, predicate: PREDICATE_KNOWS, object: frankId, objectRawIdentifier: getRawIdentifier(frankId) }),
        // Ownership (owns)
        createStatement({ subject: acmeId, predicate: PREDICATE_OWNS, object: widgetProId, objectRawIdentifier: getRawIdentifier(widgetProId) }),
        createStatement({ subject: techCorpId, predicate: PREDICATE_OWNS, object: dataVaultId, objectRawIdentifier: getRawIdentifier(dataVaultId) }),
        createStatement({ subject: startupXId, predicate: PREDICATE_OWNS, object: aiAssistantId, objectRawIdentifier: getRawIdentifier(aiAssistantId) }),
        // Creation (schema:creator) - CreativeWork → creator → Person
        createStatement({ subject: widgetProId, predicate: PREDICATE_CREATOR, object: aliceId, objectRawIdentifier: getRawIdentifier(aliceId) }),
        createStatement({ subject: acmeDocsId, predicate: PREDICATE_CREATOR, object: aliceId, objectRawIdentifier: getRawIdentifier(aliceId) }),
        createStatement({ subject: dataVaultId, predicate: PREDICATE_CREATOR, object: bobId, objectRawIdentifier: getRawIdentifier(bobId) }),
        createStatement({ subject: whitepaperId, predicate: PREDICATE_CREATOR, object: charlieId, objectRawIdentifier: getRawIdentifier(charlieId) }),
        createStatement({ subject: researchPaperId, predicate: PREDICATE_CREATOR, object: charlieId, objectRawIdentifier: getRawIdentifier(charlieId) }),
        createStatement({ subject: tutorialId, predicate: PREDICATE_CREATOR, object: danaId, objectRawIdentifier: getRawIdentifier(danaId) }),
        // Control (fide:control - accountability chain)
        createStatement({ subject: aliceId, predicate: PREDICATE_CONTROL, object: aliceKeyId, objectRawIdentifier: getRawIdentifier(aliceKeyId) }),
        createStatement({ subject: bobId, predicate: PREDICATE_CONTROL, object: bobKeyId, objectRawIdentifier: getRawIdentifier(bobKeyId) }),
        createStatement({ subject: charlieId, predicate: PREDICATE_CONTROL, object: charlieKeyId, objectRawIdentifier: getRawIdentifier(charlieKeyId) }),
        createStatement({ subject: acmeId, predicate: PREDICATE_CONTROL, object: fideBotId, objectRawIdentifier: getRawIdentifier(fideBotId) }),
        createStatement({ subject: fideBotId, predicate: PREDICATE_CONTROL, object: fideBotKeyId, objectRawIdentifier: getRawIdentifier(fideBotKeyId) }),
        createStatement({ subject: intuitionId, predicate: PREDICATE_CONTROL, object: reviewBotId, objectRawIdentifier: getRawIdentifier(reviewBotId) }),
        createStatement({ subject: reviewBotId, predicate: PREDICATE_CONTROL, object: reviewBotKeyId, objectRawIdentifier: getRawIdentifier(reviewBotKeyId) }),
    ];

    console.log(`   ✓ ${relationships.length} relationships`);

    // ==========================================================================
    // 8. EVIDENCE LINKS
    // ==========================================================================

    console.log('8️⃣  Evidence links...');

    const evidence: StatementDefinition[] = [
        // Link statements to supporting evidence
        createStatement({ subject: widgetProId, predicate: PREDICATE_EVIDENCE, object: acmeDocsId, objectRawIdentifier: getRawIdentifier(acmeDocsId) }),
        createStatement({ subject: whitepaperId, predicate: PREDICATE_EVIDENCE, object: researchPaperId, objectRawIdentifier: getRawIdentifier(researchPaperId) }),
        createStatement({ subject: trustScoreMethodId, predicate: PREDICATE_EVIDENCE, object: whitepaperId, objectRawIdentifier: getRawIdentifier(whitepaperId) }),
    ];

    console.log(`   ✓ ${evidence.length} evidence links`);

    // ==========================================================================
    // 9. ENTITY EVALUATIONS (Multiple Entity Types)
    // ==========================================================================

    console.log('9️⃣  Entity evaluations (across entity types)...');

    const entityEvaluations: StatementDefinition[] = [
        // Evaluate Person entities (reputation/trust)
        // Note: predicate is the raw identifier string, not a fingerprint
        // High trust
        createStatement({ subject: aliceId, predicate: entityCredibilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        createStatement({ subject: bobId, predicate: entityCredibilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        createStatement({ subject: charlieId, predicate: entityCredibilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        // Low trust
        createStatement({ subject: frankId, predicate: entityCredibilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '-1'), objectRawIdentifier: '-1' }),

        // Evaluate Product entities (quality scoring)
        createStatement({ subject: widgetProId, predicate: qualityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        createStatement({ subject: dataVaultId, predicate: qualityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        createStatement({ subject: aiAssistantId, predicate: qualityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '-1'), objectRawIdentifier: '-1' }),

        // Evaluate Organization entities (credibility)
        createStatement({ subject: acmeId, predicate: entityCredibilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        createStatement({ subject: intuitionId, predicate: entityCredibilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        createStatement({ subject: startupXId, predicate: entityCredibilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '-1'), objectRawIdentifier: '-1' }),

        // NEW: Reliability Scores (0-100) for Products/Services
        // Excellent uptime
        createStatement({ subject: widgetProId, predicate: reliabilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '98'), objectRawIdentifier: '98' }),
        // Very reliable
        createStatement({ subject: dataVaultId, predicate: reliabilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '95'), objectRawIdentifier: '95' }),
        // Moderate reliability
        createStatement({ subject: aiAssistantId, predicate: reliabilityMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '72'), objectRawIdentifier: '72' }),

        // NEW: AI Alignment Index (0-100) for Autonomous Agents
        // Highly aligned
        createStatement({ subject: fideBotId, predicate: alignmentMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '92'), objectRawIdentifier: '92' }),
        // Well-aligned
        createStatement({ subject: reviewBotId, predicate: alignmentMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '88'), objectRawIdentifier: '88' }),
        // Excellent alignment
        createStatement({ subject: indexerBotId, predicate: alignmentMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '95'), objectRawIdentifier: '95' }),

        // NEW: Skill Proficiency Levels (1-5) for People + Skills
        // Alice's TypeScript proficiency - Expert
        createStatement({ subject: typescriptSkillId, predicate: proficiencyMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '5'), objectRawIdentifier: '5' }),
        // Bob's Python proficiency - Advanced
        createStatement({ subject: pythonSkillId, predicate: proficiencyMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '4'), objectRawIdentifier: '4' }),
        // Charlie's Machine Learning proficiency - Expert
        createStatement({ subject: machineLearningSkillId, predicate: proficiencyMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '5'), objectRawIdentifier: '5' }),
    ];

    console.log(`   ✓ ${entityEvaluations.length} entity evaluations`);

    // ==========================================================================
    // 10. STATEMENT EVALUATIONS (Verdict evaluations)
    // ==========================================================================

    console.log('1️⃣0️⃣  Statement evaluations (verdicts on statements)...');

    // To evaluate statements, we calculate their Fide IDs using the same derivation
    // function as the indexer: deriveStatementFideId(subject, predicate, object)

    // Calculate statement Fide IDs for statements we want to evaluate
    // Formula: calculateFideId(subjectFideId + predicateFideId + objectFideId)
    // Must convert predicate strings to Fide IDs first

    // Helper: derive statement ID using normalized deterministic JSON format (RFC 8785)
    // CRITICAL: Must match the JSON format used in calculateStatementFideId and materialize.ts
    // Otherwise verdicts will point to non-existent statement IDs
    const deriveStatementID = async (subject: `0x${string}`, predicate: string, object: `0x${string}`): Promise<`0x${string}`> => {
        const predicateId = await calculateFideId('CreativeWork', 'CreativeWork', predicate) as `0x${string}`;
        // ✅ Use calculateStatementFideId for normalized deterministic statement ID calculation
        return await calculateStatementFideId(subject, predicateId, object);
    };

    // Example: Alice works for Acme (verify this statement)
    const aliceWorksForAcmeStmtId = await deriveStatementID(aliceId, PREDICATE_WORKS_FOR, acmeId);

    // Example: Bob works for Intuition (verify this statement)
    const bobWorksForIntuitionStmtId = await deriveStatementID(bobId, PREDICATE_WORKS_FOR, intuitionId);

    // Example: Alice knows about TypeScript (verify this statement)
    const aliceKnowsTypescriptStmtId = await deriveStatementID(
        aliceId,
        PREDICATE_KNOWS_ABOUT,
        typescriptSkillId
    );

    // Example: Charlie knows about Machine Learning (verify this statement)
    const charlieKnowsMLStmtId = await deriveStatementID(
        charlieId,
        PREDICATE_KNOWS_ABOUT,
        machineLearningSkillId
    );

    // Add statement IDs to mapping with their normalized deterministic JSON raw identifiers
    // Statement raw identifier format: {"s":"0x...","p":"0x...","o":"0x..."}
    const addStatementToMapping = async (stmtId: `0x${string}`, subject: `0x${string}`, predicate: string, object: `0x${string}`): Promise<void> => {
        const predicateId = await calculateFideId('CreativeWork', 'CreativeWork', predicate) as `0x${string}`;
        const statementRawIdentifier = getStatementRawIdentifier(subject, predicateId, object);
        fideIdToRawIdentifier.set(stmtId, statementRawIdentifier);
    };

    await addStatementToMapping(aliceWorksForAcmeStmtId, aliceId, PREDICATE_WORKS_FOR, acmeId);
    await addStatementToMapping(bobWorksForIntuitionStmtId, bobId, PREDICATE_WORKS_FOR, intuitionId);
    await addStatementToMapping(aliceKnowsTypescriptStmtId, aliceId, PREDICATE_KNOWS_ABOUT, typescriptSkillId);
    await addStatementToMapping(charlieKnowsMLStmtId, charlieId, PREDICATE_KNOWS_ABOUT, machineLearningSkillId);

    // Use statement accuracy method for statement evaluations (already calculated above as genesis Statement ID)
    const statementEvaluations: StatementDefinition[] = [
        // Verify relationship statements with positive verdicts
        // Verified
        createStatement({ subject: aliceWorksForAcmeStmtId, predicate: statementAccuracyMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        // Verified
        createStatement({ subject: bobWorksForIntuitionStmtId, predicate: statementAccuracyMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        // Verified
        createStatement({ subject: aliceKnowsTypescriptStmtId, predicate: statementAccuracyMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),

        // Add one with neutral verdict for variety
        // Neutral
        createStatement({ subject: charlieKnowsMLStmtId, predicate: statementAccuracyMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '0'), objectRawIdentifier: '0' }),
    ];

    console.log(`   ✓ ${statementEvaluations.length} statement evaluations (verdicts)`);

    // ==========================================================================
    // 10b. NAME & DESCRIPTION EVALUATIONS
    // ==========================================================================

    console.log('1️⃣0️⃣b️⃣  Name & description evaluations (trust verdicts)...');

    // Calculate Statement IDs for schema:name assertions we want to evaluate
    const aliceNameStmtId = await deriveStatementID(
        aliceId,
        PREDICATE_NAME,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Alice Johnson')
    );
    const aliceNicknameStmtId = await deriveStatementID(
        aliceId,
        PREDICATE_NAME,
        await calculateFideId('CreativeWork', 'CreativeWork', 'AJ')
    );
    const acmeNameStmtId = await deriveStatementID(
        acmeId,
        PREDICATE_NAME,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Acme Corporation')
    );
    const acmeShortNameStmtId = await deriveStatementID(
        acmeId,
        PREDICATE_NAME,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Acme Corp')
    );
    const intuitionNameStmtId = await deriveStatementID(
        intuitionId,
        PREDICATE_NAME,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Intuition Systems')
    );
    const widgetProNameStmtId = await deriveStatementID(
        widgetProId,
        PREDICATE_NAME,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Widget Pro')
    );

    // Calculate Statement IDs for schema:description assertions
    const acmeDescStmtId = await deriveStatementID(
        acmeId,
        PREDICATE_DESCRIPTION,
        await calculateFideId('CreativeWork', 'CreativeWork', 'A leading technology company building the future of work')
    );
    const intuitionDescStmtId = await deriveStatementID(
        intuitionId,
        PREDICATE_DESCRIPTION,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Pioneering decentralized identity and trust networks')
    );
    const widgetProDescStmtId = await deriveStatementID(
        widgetProId,
        PREDICATE_DESCRIPTION,
        await calculateFideId('CreativeWork', 'CreativeWork', 'Enterprise-grade widget management platform')
    );

    // Add statement IDs to mapping
    await addStatementToMapping(aliceNameStmtId, aliceId, PREDICATE_NAME, await calculateFideId('CreativeWork', 'CreativeWork', 'Alice Johnson'));
    await addStatementToMapping(aliceNicknameStmtId, aliceId, PREDICATE_NAME, await calculateFideId('CreativeWork', 'CreativeWork', 'AJ'));
    await addStatementToMapping(acmeNameStmtId, acmeId, PREDICATE_NAME, await calculateFideId('CreativeWork', 'CreativeWork', 'Acme Corporation'));
    await addStatementToMapping(acmeShortNameStmtId, acmeId, PREDICATE_NAME, await calculateFideId('CreativeWork', 'CreativeWork', 'Acme Corp'));
    await addStatementToMapping(intuitionNameStmtId, intuitionId, PREDICATE_NAME, await calculateFideId('CreativeWork', 'CreativeWork', 'Intuition Systems'));
    await addStatementToMapping(widgetProNameStmtId, widgetProId, PREDICATE_NAME, await calculateFideId('CreativeWork', 'CreativeWork', 'Widget Pro'));
    await addStatementToMapping(acmeDescStmtId, acmeId, PREDICATE_DESCRIPTION, await calculateFideId('CreativeWork', 'CreativeWork', 'A leading technology company building the future of work'));
    await addStatementToMapping(intuitionDescStmtId, intuitionId, PREDICATE_DESCRIPTION, await calculateFideId('CreativeWork', 'CreativeWork', 'Pioneering decentralized identity and trust networks'));
    await addStatementToMapping(widgetProDescStmtId, widgetProId, PREDICATE_DESCRIPTION, await calculateFideId('CreativeWork', 'CreativeWork', 'Enterprise-grade widget management platform'));

    // Create evaluation verdicts for names and descriptions
    const nameDescriptionEvaluations: StatementDefinition[] = [
        // Name evaluations - trust primary names, reject/uncertain for alternatives
        createStatement({ subject: aliceNameStmtId, predicate: nameResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }), // Trust "Alice Johnson"
        createStatement({ subject: aliceNicknameStmtId, predicate: nameResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '0'), objectRawIdentifier: '0' }), // Uncertain about "AJ"
        createStatement({ subject: acmeNameStmtId, predicate: nameResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }), // Trust "Acme Corporation"
        createStatement({ subject: acmeShortNameStmtId, predicate: nameResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }), // Also trust "Acme Corp"
        createStatement({ subject: intuitionNameStmtId, predicate: nameResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }), // Trust "Intuition Systems"
        createStatement({ subject: widgetProNameStmtId, predicate: nameResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }), // Trust "Widget Pro"

        // Description evaluations - trust all descriptions
        createStatement({ subject: acmeDescStmtId, predicate: descriptionResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }), // Trust Acme description
        createStatement({ subject: intuitionDescStmtId, predicate: descriptionResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }), // Trust Intuition description
        createStatement({ subject: widgetProDescStmtId, predicate: descriptionResolutionMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }), // Trust Widget Pro description
    ];

    console.log(`   ✓ ${nameDescriptionEvaluations.length} name & description evaluations (trust verdicts)`);

    // ==========================================================================
    // 11. AGENT ACTIONS
    // ==========================================================================

    console.log('1️⃣1️⃣  Agent actions...');

    // Agent actions are statements about what agents did
    const actions: StatementDefinition[] = [
        // FideBot indexed an attestation
        createStatement({ subject: fideBotId, predicate: PREDICATE_AGENT, object: widgetProId, objectRawIdentifier: 'indexed' }),
        createStatement({ subject: fideBotId, predicate: PREDICATE_ACTION_STATUS, object: await calculateFideId('CreativeWork', 'CreativeWork', ACTION_STATUS_COMPLETED), objectRawIdentifier: ACTION_STATUS_COMPLETED }),
        createStatement({ subject: fideBotId, predicate: PREDICATE_RESULT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Successfully indexed 15 attestations'), objectRawIdentifier: 'Successfully indexed 15 attestations' }),
        createStatement({ subject: fideBotId, predicate: PREDICATE_REASONING, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Verified signatures and extracted graph edges'), objectRawIdentifier: 'Verified signatures and extracted graph edges' }),
        // ReviewBot analyzed trust
        createStatement({ subject: reviewBotId, predicate: PREDICATE_AGENT, object: aliceId, objectRawIdentifier: 'analyzed' }),
        createStatement({ subject: reviewBotId, predicate: PREDICATE_ACTION_STATUS, object: await calculateFideId('CreativeWork', 'CreativeWork', ACTION_STATUS_COMPLETED), objectRawIdentifier: ACTION_STATUS_COMPLETED }),
        createStatement({ subject: reviewBotId, predicate: PREDICATE_RESULT, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Trust score: 0.92'), objectRawIdentifier: 'Trust score: 0.92' }),
        createStatement({ subject: reviewBotId, predicate: PREDICATE_REASONING, object: await calculateFideId('CreativeWork', 'CreativeWork', 'High statement accuracy and strong peer endorsements'), objectRawIdentifier: 'High statement accuracy and strong peer endorsements' }),
    ];

    console.log(`   ✓ ${actions.length} agent actions`);

    // ==========================================================================
    // 12. METHODOLOGY LINKS
    // ==========================================================================

    console.log('1️⃣2️⃣  Methodology links...');

    const methodologies: StatementDefinition[] = [
        // Link evaluations to their methodologies
        createStatement({ subject: aliceId, predicate: PREDICATE_PROCEDURE, object: trustScoreMethodId, objectRawIdentifier: getRawIdentifier(trustScoreMethodId) }),
        createStatement({ subject: bobId, predicate: PREDICATE_PROCEDURE, object: trustScoreMethodId, objectRawIdentifier: getRawIdentifier(trustScoreMethodId) }),
        createStatement({ subject: widgetProId, predicate: PREDICATE_PROCEDURE, object: qualityMethodId, objectRawIdentifier: getRawIdentifier(qualityMethodId) }),
    ];

    console.log(`   ✓ ${methodologies.length} methodology links`);

    // ==========================================================================
    // 13. EDGE CASES (For testing error handling and complex scenarios)
    // ==========================================================================

    console.log('1️⃣3️⃣  Edge cases...');

    // Create a malicious actor for negative evaluations
    const spamBotId = await generateDeterministicFideId('spambot-agent-2024', 'AutonomousAgent', 'Product');
    const spamBotKeyId = await generateDeterministicFideId('spambot-signing-key-2024', 'CryptographicAccount', 'CryptographicAccount');

    // Create conflicting statements (same subject+predicate, different objects)
    // This tests conflict resolution logic
    const conflictPersonId = await generateDeterministicFideId('conflict-person-2024', 'Person', 'Product');
    const companyAId = await generateDeterministicFideId('company-a-2024', 'Organization', 'Product');
    const companyBId = await generateDeterministicFideId('company-b-2024', 'Organization', 'Product');

    // Add edge case entities to mapping
    fideIdToRawIdentifier.set(spamBotId, 'spambot-agent-2024');
    fideIdToRawIdentifier.set(spamBotKeyId, 'spambot-signing-key-2024');
    fideIdToRawIdentifier.set(conflictPersonId, 'conflict-person-2024');
    fideIdToRawIdentifier.set(companyAId, 'company-a-2024');
    fideIdToRawIdentifier.set(companyBId, 'company-b-2024');

    // Identity resolution test entities
    const primaryUserId = await generateDeterministicFideId('primary-user-2024', 'Person', 'Product');
    const twitterUserId = await generateDeterministicFideId('twitter-user-2024', 'Person', 'Product');
    const githubUserId = await generateDeterministicFideId('github-user-2024', 'Person', 'Product');
    fideIdToRawIdentifier.set(primaryUserId, 'primary-user-2024');
    fideIdToRawIdentifier.set(twitterUserId, 'twitter-user-2024');
    fideIdToRawIdentifier.set(githubUserId, 'github-user-2024');

    const edgeCases: StatementDefinition[] = [
        // --- Conflicting Statements (same subject+predicate, different objects) ---
        // Test entity for conflict resolution
        createStatement({ subject: conflictPersonId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', ENTITY_TYPE_PERSON), objectRawIdentifier: ENTITY_TYPE_PERSON }),
        createStatement({ subject: conflictPersonId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Conflict Test Person'), objectRawIdentifier: 'Conflict Test Person' }),
        createStatement({ subject: companyAId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', ENTITY_TYPE_ORGANIZATION), objectRawIdentifier: ENTITY_TYPE_ORGANIZATION }),
        createStatement({ subject: companyAId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Company A'), objectRawIdentifier: 'Company A' }),
        createStatement({ subject: companyBId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', ENTITY_TYPE_ORGANIZATION), objectRawIdentifier: ENTITY_TYPE_ORGANIZATION }),
        createStatement({ subject: companyBId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Company B'), objectRawIdentifier: 'Company B' }),
        // Conflicting employment: same person, same predicate, different objects
        createStatement({ subject: conflictPersonId, predicate: PREDICATE_WORKS_FOR, object: companyAId, objectRawIdentifier: getRawIdentifier(companyAId) }),
        createStatement({ subject: conflictPersonId, predicate: PREDICATE_WORKS_FOR, object: companyBId, objectRawIdentifier: getRawIdentifier(companyBId) }),

        // --- Negative/Spam Evaluations ---
        // Test agent: SpamBot
        createStatement({ subject: spamBotId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', ENTITY_TYPE_AUTONOMOUS_AGENT), objectRawIdentifier: ENTITY_TYPE_AUTONOMOUS_AGENT }),
        createStatement({ subject: spamBotId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'SpamBot 3000'), objectRawIdentifier: 'SpamBot 3000' }),
        createStatement({ subject: spamBotKeyId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', ENTITY_TYPE_CRYPTOGRAPHIC_ACCOUNT), objectRawIdentifier: ENTITY_TYPE_CRYPTOGRAPHIC_ACCOUNT }),
        createStatement({ subject: spamBotId, predicate: PREDICATE_CONTROL, object: spamBotKeyId, objectRawIdentifier: getRawIdentifier(spamBotKeyId) }),
        // Negative evaluations (spam indicators)
        // 1 = is spam
        createStatement({ subject: spamBotId, predicate: METHOD_SPAM_DETECTOR, object: await calculateFideId('CreativeWork', 'CreativeWork', '1'), objectRawIdentifier: '1' }),
        // -1 = untrusted
        createStatement({ subject: spamBotId, predicate: statementAccuracyMethod, object: await calculateFideId('CreativeWork', 'CreativeWork', '-1'), objectRawIdentifier: '-1' }),

        // --- Identity linking and resolution (sameAs relationships) ---
        // Primary user identity
        createStatement({ subject: primaryUserId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', ENTITY_TYPE_PERSON), objectRawIdentifier: ENTITY_TYPE_PERSON }),
        createStatement({ subject: primaryUserId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Primary User'), objectRawIdentifier: 'Primary User' }),
        // Twitter alias for same person
        createStatement({ subject: twitterUserId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', ENTITY_TYPE_PERSON), objectRawIdentifier: ENTITY_TYPE_PERSON }),
        createStatement({ subject: twitterUserId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Primary User (@twitter)'), objectRawIdentifier: 'Primary User (@twitter)' }),
        // GitHub alias for same person
        createStatement({ subject: githubUserId, predicate: PREDICATE_TYPE, object: await calculateFideId('CreativeWork', 'CreativeWork', ENTITY_TYPE_PERSON), objectRawIdentifier: ENTITY_TYPE_PERSON }),
        createStatement({ subject: githubUserId, predicate: PREDICATE_NAME, object: await calculateFideId('CreativeWork', 'CreativeWork', 'Primary User (github)'), objectRawIdentifier: 'Primary User (github)' }),

        // --- Minimal data edge case ---
        // Statement with minimal description (single space to test edge cases)
        createStatement({ subject: widgetProId, predicate: PREDICATE_DESCRIPTION, object: await calculateFideId('CreativeWork', 'CreativeWork', ' '), objectRawIdentifier: ' ' }),
    ];

    console.log(`   ✓ ${edgeCases.length} edge case statements`);

    // ==========================================================================
    // BROADCAST ALL STATEMENTS IN SINGLE ATTESTATION
    // ==========================================================================

    // Combine all statements into a single batch for one attestation
    // Merkle root commits to all statement FideIds, regardless of their subjects
    // SignedStatementBatch is the EIP-712 signing envelope
    const allStatements = [
        ...evaluationMethods,
        ...entityNames,
        ...descriptions,
        ...skills,
        ...interests,
        ...tags,
        ...relationships,
        ...evidence,
        ...entityEvaluations,
        ...statementEvaluations,
        ...nameDescriptionEvaluations,
        ...actions,
        ...methodologies,
        ...edgeCases
    ].filter((stmt) => stmt.predicate !== PREDICATE_TYPE);

    console.log('\n📦 Broadcasting all statements in single attestation...');
    await createAndBroadcastBatchStatements(allStatements, fixedTimestamp, account);
    console.log(`\n✅ Seeded ${allStatements.length} statements total (1 attestation, 1 signature, 1 merkle root)`);

    // ==========================================================================
    // PROV-O LINKING: Create statement linking attestation to signer
    // ==========================================================================
    // Pattern: Attestation → prov:wasAssociatedWith → Signer (CryptographicAccount)
    // This statement is created separately so it will be indexed and available
    // for attestation metadata parsing

    console.log('\n🔗 Creating PROV-O statement: Attestation → prov:wasAssociatedWith → Signer...');

    // The indexer will create the Attestation entity from the attestation payload.
    // We create a statement linking it to the signer's CryptographicAccount.
    // Using the account address as the raw identifier for the signer's key.
    const signerAddress = account.address.toLowerCase();
    const caip10Signer = `eip155:31337:${signerAddress}`;
    const signerKeyId = await calculateFideId('CryptographicAccount', 'CryptographicAccount', caip10Signer);

    // Add signer to mapping for PROV-O statement
    fideIdToRawIdentifier.set(signerKeyId, caip10Signer);

    // Create PROV-O linking statement
    // Note: The attestation ID will be calculated by the indexer during materialization
    // For now, we'll use a deterministic ID based on signer + timestamp
    const provoRawId = JSON.stringify({ signer: signerAddress, timestamp: fixedTimestamp });
    const provoLinkId = await calculateFideId('CreativeWork', 'CreativeWork', provoRawId);

    const provoStatements: StatementDefinition[] = [
        // Link pattern: The indexer-generated Attestation will be linked to the signer
    // This statement documents that these statements were signed by this account
        {
            subject: provoLinkId,
            predicate: 'prov:wasAssociatedWith',
            subjectRawIdentifier: provoRawId,
            object: signerKeyId,
            objectRawIdentifier: caip10Signer
        }
    ];

    // Broadcast PROV-O statement in a second attestation
    // The indexer will then have the complete chain: Attestation → prov:wasAssociatedWith → Signer
    await createAndBroadcastBatchStatements(provoStatements, fixedTimestamp, account);
    console.log('✅ PROV-O linking statement broadcasted (indexer will finalize Attestation → Signer chain)');

    // ==========================================================================
    // STATEMENT-DERIVED PRIMARY IDS (FCP Identity Resolution)
    // ==========================================================================
    // FCP Protocol Rule: Primary identities are Statement-derived (source_type='0')
    // Only 4 entity types are self-sourced primaries: 0x66, 0x88, 0xa0, 0x00
    // All others need Statement-derived primaries: 0x1X→0x10, 0x2X→0x20, etc.
    //
    // Primary derivation:
    // 1. Pick a genesis statement (e.g., first schema:name statement)
    // 2. Calculate Statement Fide ID (0x00...)
    // 3. Use that Statement ID as raw identifier for primary (e.g., 0x10..., 0x20...)
    // 4. Create owl:sameAs pointing Product IDs → Statement-derived primary

    console.log('\n🔗 Calculating Statement-derived primary identities for ALL entities...');

    // Helper: Calculate Statement-derived primary for an entity
    // Returns the primary Fide ID (0xX0...) where rawIdentifier is the genesis Statement ID
    const calculatePrimary = async (entityId: `0x${string}`, entityType: string, nameObjectId: `0x${string}`): Promise<`0x${string}`> => {
        const predicateNameId = await calculateFideId('CreativeWork', 'CreativeWork', PREDICATE_NAME) as `0x${string}`;
        const genesisStmtId = await calculateStatementFideId(entityId, predicateNameId, nameObjectId);
        const primaryId = await calculateFideId(entityType as any, 'Statement', genesisStmtId);
        // Register the Statement ID as the raw identifier for this primary
        fideIdToRawIdentifier.set(primaryId, genesisStmtId);
        return primaryId;
    };

    // Collect all entities that need Statement-derived primaries (source_type != entity_type)
    // Entity types that are self-sourced (skip these): 0x66, 0x88, 0xa0, 0x00
    const entitiesToResolve: Array<{ id: `0x${string}`, type: string, nameObject: `0x${string}` }> = [
        // People
        { id: aliceId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Alice Johnson') as `0x${string}` },
        { id: bobId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Bob Smith') as `0x${string}` },
        { id: charlieId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Charlie Chen') as `0x${string}` },
        { id: danaId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Dana Williams') as `0x${string}` },
        { id: eveId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Eve Martinez') as `0x${string}` },
        { id: frankId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Frank Lee') as `0x${string}` },
        // Organizations
        { id: acmeId, type: 'Organization', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Acme Corporation') as `0x${string}` },
        { id: acmeDuplicateId, type: 'Organization', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'ACME Corp') as `0x${string}` },
        { id: intuitionId, type: 'Organization', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Intuition Systems') as `0x${string}` },
        { id: techCorpId, type: 'Organization', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'TechCorp Industries') as `0x${string}` },
        { id: startupXId, type: 'Organization', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'StartupX') as `0x${string}` },
        // Products
        { id: widgetProId, type: 'Product', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Widget Pro') as `0x${string}` },
        { id: dataVaultId, type: 'Product', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'DataVault Enterprise') as `0x${string}` },
        { id: aiAssistantId, type: 'Product', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'AI Assistant Pro') as `0x${string}` },
        // Agents
        { id: fideBotId, type: 'AutonomousAgent', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'FideBot Agent #001') as `0x${string}` },
        { id: reviewBotId, type: 'AutonomousAgent', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'ReviewBot Agent #002') as `0x${string}` },
        { id: indexerBotId, type: 'AutonomousAgent', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'IndexerBot Agent #003') as `0x${string}` },
        // Events
        { id: acmeDevConId, type: 'Event', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Acme DevCon 2024') as `0x${string}` },
        { id: hackathonId, type: 'Event', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Global AI Hackathon 2024') as `0x${string}` },
        { id: conferenceId, type: 'Event', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Web3 Identity Conference') as `0x${string}` },
        // Places
        { id: acmeHQId, type: 'Place', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Acme HQ San Francisco') as `0x${string}` },
        { id: techHubId, type: 'Place', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Silicon Valley Tech Hub') as `0x${string}` },
        { id: coworkingId, type: 'Place', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Downtown Coworking Space') as `0x${string}` },
        // Identity test entities
        { id: primaryUserId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Primary User') as `0x${string}` },
        { id: twitterUserId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Primary User (@twitter)') as `0x${string}` },
        { id: githubUserId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Primary User (github)') as `0x${string}` },
        // Edge case entities
        { id: spamBotId, type: 'AutonomousAgent', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'SpamBot 3000') as `0x${string}` },
        { id: conflictPersonId, type: 'Person', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Conflict Test Person') as `0x${string}` },
        { id: companyAId, type: 'Organization', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Company A') as `0x${string}` },
        { id: companyBId, type: 'Organization', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Company B') as `0x${string}` },
        // CreativeWork with URL alias (testing document resolution)
        { id: articleAliasId, type: 'CreativeWork', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Context Graphs: AI\'s Trillion-Dollar Opportunity') as `0x${string}` },
        // EvaluationMethods (0xe5... → 0xe0...)
        { id: aliasResolutionTrustMethodId, type: 'EvaluationMethod', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-AliasResolutionTrust-v1') as `0x${string}` },
        { id: trustScoreMethodId, type: 'EvaluationMethod', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-BridgingConsensus-v1') as `0x${string}` },
        { id: qualityMethodId, type: 'EvaluationMethod', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-QualityScore-v1') as `0x${string}` },
        { id: reliabilityMethodId, type: 'EvaluationMethod', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-ReliabilityScore-v1') as `0x${string}` },
        { id: alignmentMethodId, type: 'EvaluationMethod', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-AIAlignment-v1') as `0x${string}` },
        { id: proficiencyMethodId, type: 'EvaluationMethod', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-SkillProficiency-v1') as `0x${string}` },
        { id: nameResolutionMethodId, type: 'EvaluationMethod', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-NameResolution-v1') as `0x${string}` },
        { id: descriptionResolutionMethodId, type: 'EvaluationMethod', nameObject: await calculateFideId('CreativeWork', 'CreativeWork', 'Fide-DescriptionResolution-v1') as `0x${string}` },
    ];

    // Calculate Statement-derived primary for each entity
    const primaryMap = new Map<`0x${string}`, `0x${string}`>();
    for (const entity of entitiesToResolve) {
        // Special handling for EvaluationMethods: calculate genesis Statement ID from schema:name
        if (entity.type === 'EvaluationMethod') {
            // Get the method name (e.g., "Fide-BridgingConsensus-v1")
            const methodName = evaluationMethodNames.get(entity.id);
            if (!methodName) {
                throw new Error(`Missing method name for evaluation method: ${entity.id}`);
            }

            // Calculate genesis statement: 0xe5... schema:name "Fide-XXX-v1"
            const predicateNameId = await calculateFideId('CreativeWork', 'CreativeWork', PREDICATE_NAME) as `0x${string}`;
            const nameObjectId = await calculateFideId('CreativeWork', 'CreativeWork', methodName) as `0x${string}`;
            const genesisStmtId = await calculateStatementFideId(entity.id, predicateNameId, nameObjectId);

            // Primary is 0xe0 with the genesis Statement ID as rawIdentifier
            const primaryId = await calculateFideId('EvaluationMethod', 'Statement', genesisStmtId) as `0x${string}`;
            fideIdToRawIdentifier.set(primaryId, genesisStmtId); // Register Statement ID as raw identifier
            primaryMap.set(entity.id, primaryId);
        } else {
            const primaryId = await calculatePrimary(entity.id, entity.type, entity.nameObject);
            primaryMap.set(entity.id, primaryId);
        }
    }

    console.log(`   ✓ Calculated ${primaryMap.size} Statement-derived primaries`);

    // ==========================================================================
    // OWL:SAMEAS STATEMENTS (Point ALL entities to Statement-derived primaries)
    // ==========================================================================
    console.log('\n🔗 Creating owl:sameAs statements for ALL entities...');

    const sameAsStatements: StatementDefinition[] = [];

    // Create owl:sameAs for every entity that needs resolution
    for (const [entityId, primaryId] of primaryMap.entries()) {
        sameAsStatements.push(
            createStatement({
                subject: entityId,
                predicate: PREDICATE_SAME_AS,
                object: primaryId,
                objectRawIdentifier: getRawIdentifier(primaryId)
            })
        );
    }

    console.log(`   ✓ ${sameAsStatements.length} owl:sameAs statements created`);

    // Broadcast sameAs statements
    console.log('\n📦 Broadcasting owl:sameAs statements...');
    await createAndBroadcastBatchStatements(sameAsStatements, fixedTimestamp, account);
    console.log(`✅ Broadcasted ${sameAsStatements.length} owl:sameAs statements`);

    // ==========================================================================
    // OWL:SAMEAS TRUST EVALUATIONS (Critique 21)
    // ==========================================================================
    // Evaluation-based trust: Create evaluation statements that mark owl:sameAs
    // statements as trusted using Fide-AliasResolutionTrust-v1 method.
    //
    // The materialized view (fcp_statements_identifiers_resolved) will only use
    // owl:sameAs statements that have been evaluated as trusted (verdict=1).

    console.log('\n🔗 Creating trust evaluations for ALL owl:sameAs statements...');

    // Create evaluation statements for EVERY owl:sameAs statement
    const aliasEvaluations: StatementDefinition[] = [];

    for (const [entityId, primaryId] of primaryMap.entries()) {
        // Calculate the Statement ID for this owl:sameAs statement
        const sameAsStmtId = await deriveStatementID(entityId, PREDICATE_SAME_AS, primaryId);

        // Add to mapping
        await addStatementToMapping(sameAsStmtId, entityId, PREDICATE_SAME_AS, primaryId);

        // Create evaluation marking this owl:sameAs as trusted (verdict=1)
        aliasEvaluations.push(
            createStatement({
                subject: sameAsStmtId,
                predicate: aliasResolutionTrustMethod,  // Genesis Statement ID (0x00...)
                object: await calculateFideId('CreativeWork', 'CreativeWork', '1'),
                objectRawIdentifier: '1'
            })
        );
    }

    console.log(`   ✓ ${aliasEvaluations.length} owl:sameAs trust evaluations created`);

    // Broadcast alias evaluations in a separate attestation
    console.log('\n📦 Broadcasting owl:sameAs trust evaluations...');
    await createAndBroadcastBatchStatements(aliasEvaluations, fixedTimestamp, account);
    console.log(`✅ Broadcasted ${aliasEvaluations.length} alias trust evaluations`);
}

main().catch(console.error);
