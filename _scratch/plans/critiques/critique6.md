# FCP Protocol Critique — January 18, 2026

## Executive Summary

The Fide Context Protocol (FCP) is a **remarkably well-designed specification** for capturing verifiable context in a distributed graph. It successfully balances theoretical rigor with practical implementability. This critique identifies strengths, gaps, and recommendations for v2 consideration.

**Overall Assessment:** Production-ready. The gaps identified are refinements, not blockers.

---

## FCP Positioning: World Models

**One-liner:** *"Build World Models with FCP — the open standard for graphing Context."*

This positions the **user** as the builder and **FCP** as the enabling standard.

### Why "World Model"?

The term "World Model" is strategic:
- **AI/ML Resonance**: World Models are a hot concept in AI research (LeCun's JEPA, Dreamer, etc.). This positions FCP at the intersection of knowledge graphs and agent cognition.
- **Beyond Data Storage**: It answers "why use FCP?" — not just to store data, but to build a **shared understanding of reality** that agents can reason over.
- **Developer Motivation**: Tells developers *why* they're using these schemas (to build a World Model) rather than just what they are (data structures).

### Schema → World Model Mapping

| Schema | World Model Role | What It Captures |
|--------|------------------|------------------|
| `FideEntityAttribute` | **State** | What things are right now |
| `FideEntityRelationship` | **Structure** | How things connect |
| `FideActionStep` | **History** | How we got here (reasoning traces) |
| `FideEvaluation` | **Belief** | What we trust to be true |

Together, these four schemas "capture the state, history, and evaluation of your world model."

**Recommendation:** Update `/content/docs/fcp/index.mdx` and `/content/docs/fcp/schemas/index.mdx` to use this framing in introductions.

---

## Part 1: What FCP Gets Right ✅

### 1.1 The "4 Schema" Constraint

**Reference:** `/content/docs/fcp/schemas/index.mdx`

FCP identifies the minimal viable set of schemas:

| Schema | Purpose |
|--------|---------|
| `FideEntityAttribute` | Properties of entities |
| `FideEntityRelationship` | Edges between entities |
| `FideActionStep` | Reasoning traces and workflows |
| `FideEvaluation` | Trust signals and verdicts |

**Why this works:** Most protocols over-engineer with dozens of specialized schemas. FCP's constraint forces composability. Any real-world use case can be modeled with these four primitives.

**Comparison:** This is Schema.org-level thinking but actually implementable. Unlike Schema.org's 800+ types, FCP is learnable in an afternoon.

---

### 1.2 Git as Transport Layer

**Reference:** `/content/docs/fcp/claims/broadcasting.mdx`

Using Git for claim broadcasting is a strategically brilliant decision:

| Benefit | Why It Matters |
|---------|----------------|
| **Existing Infrastructure** | GitHub, GitLab, Gitea all work out of the box |
| **Natural Versioning** | History, diffs, blame come free |
| **Deterministic Replay** | Any indexer can `git clone` and reconstruct state |
| **No Gas Fees** | Unlike blockchain, no cost per claim |
| **Developer Familiarity** | Every engineer knows Git |

**Why this works:** This is "boring technology" in the best sense. Git is battle-tested, globally distributed, and free. The protocol delegates transport reliability to a solved problem.

---

### 1.3 DAG Structure for Action Steps

**Reference:** `/content/docs/fcp/schemas/fide-action-step.mdx`, `/content/docs/fcp/schemas/fide-action-step-notes.ts`

The move from `stepIndex` (linear) to `previousStepFideId` (DAG) is correct:

```
Linear (Old):           DAG (New):
Step 0 → Step 1 → Step 2    Step A
                              ↓
                         ┌────┴────┐
                         ↓         ↓
                       Step B   Step C
                         ↓         ↓
                       Step D   Step E
```

**Why this works:** Real agent behavior is not linear. An agent might:
- Spawn parallel tool calls
- Branch on conditional logic
- Merge results from multiple sources

The DAG structure captures this naturally. Each step knows its parent, enabling tree reconstruction without race conditions.

---

### 1.4 Smart Verbs (Predicate Entities)

**Reference:** `/content/docs/fcp/schemas/fide-action-step-notes.ts` (Accordion: "Why Smart Verbs?")

Using `actionType: address` instead of `action: string` is **protocol design at its finest**:

| Old Approach | New Approach |
|--------------|--------------|
| `action: "call_tool"` | `actionType: 0x742d...` (fcp:action:tool_call) |
| Strings fragment data | Canonical IDs ensure interoperability |
| Agents can't introspect | Agents can query the graph for action properties |

**Example of introspection:**
```
Agent: "What is 0x123...?"
Graph: "It is fcp:action:deploy_contract. It has attribute is_irreversible: true."
Agent: "Since this is irreversible, I should check safety policy first."
```

**Why this works:** Actions become first-class entities in the graph. They can have their own attributes, enabling learned ontologies where agents define new verbs without protocol changes.

---

### 1.5 Evaluation Primitives (Not Aggregation)

**Reference:** `/content/docs/fcp/claims/evaluating.mdx`

FCP provides the **primitives** for evaluation, not the aggregation logic:

| Protocol Provides | Application Chooses |
|-------------------|---------------------|
| `FideEvaluation` schema with `value` field | How to aggregate evaluations |
| `methodologyFideId` to track evaluation source | Which evaluators to trust |
| Signed, verifiable signals | Context-dependent weighting |

**The `-1, 0, 1` scale is a suggestion**, not a requirement. Applications can:
- Use simple summation ("opinions cancel out")
- Trust-weight by evaluator reputation
- Filter by methodology ("only count audits")
- Context-specific trust ("trust X for security, Y for quality")

**Why this works:** The protocol avoids baking in a single aggregation model. It provides the raw signals; applications decide what "truth" means for their context. This is the right level of abstraction — primitives, not policy.

---

### 1.6 EIP-712 Deterministic Signing

**Reference:** `/content/docs/fcp/claims/signing.mdx`

Using EIP-712 for structured data signing provides:

- **Type Safety**: Claims are signed as typed structures, not raw bytes
- **Deterministic Encoding**: Same claim always produces same signature
- **Self-Verification**: Anyone can verify without contacting the signer
- **Wallet Compatibility**: Works with MetaMask, Ledger, any Ethereum wallet

**Why this works:** EIP-712 is a battle-tested standard with excellent tooling. The protocol inherits cryptographic guarantees without reinventing signatures.

---

### 1.7 Claim as Entity (Signature-Derived ID)

**Reference:** `/content/docs/fcp/entities/identity.mdx#claim-fide-id`

Every signed claim gets its own Fide ID:

```
claimFideId = 0x + last20Bytes(keccak256(signature))
```

**Why this works:** Claims can be referenced by other claims. This enables:
- Evidence linking (`fcp:rel:evidence`)
- Claim evaluation (`FideEvaluation.subjectFideId`)
- Supersession chains (`claimSupersedes`)

The ID is deterministic (same content + signer = same ID) and collision-resistant.

---

## Part 2: Gaps & Recommendations 🔧

### 2.1 Privacy Model — Documentation Clarity

**Status:** Protocol is sound; docs could be clearer.

**The Model (Already Works):**
1. **Private Broadcasting**: Store claims in a private Git repo. Share access using Git's existing mechanisms (collaborators, deploy keys, SSH).
2. **Trusted Indexing**: Give your trusted indexer read access to your private repo. They index your private claims alongside public claims they choose.
3. **Layered Queries**: Your private indexer serves both private + public data to authorized consumers.

**The protocol doesn't need its own access control** — it delegates to Git's permissions. This is elegant design, not a gap.

**Edge Cases (Application-Layer):**
- **Field-level encryption**: If you want to broadcast publicly but keep `input`/`output` encrypted
- **Selective disclosure**: Sharing different claims with different parties

> **📝 TODO (Docs):** Add a "Private Registries" section to `/content/docs/fcp/claims/broadcasting.mdx` that explicitly walks through the private Git repo → trusted indexer flow. Make clear that Git permissions = access control.

**Priority:** 🟢 Low — Not a protocol gap, just needs explicit documentation.

---

### 2.2 Temporal Validity — Documentation Clarity + Naming

**Status:** Protocol is sound; needs clearer docs and improved field names.

**The Model (Already Works):**
- `claimSignedAt` (currently `claimedAt`) = When the claim was signed
- `claimValidFrom` / `claimValidTo` = When the **fact** was/is/will be true
- `claimReplaces` (currently `claimSupersedes`) = Points to claim being corrected

| Meaning | claimValidFrom | claimValidTo |
|---------|----------------|--------------|
| "Chris IS a student" | 2023-09-01 | "" (indefinite) |
| "Chris WAS a student" | 2019-09-01 | 2023-05-15 |
| "Chris WILL BE a student" | 2025-09-01 | "" |

**Overlapping Validity (Same Signer):**
- If two claims from the same signer contradict with overlapping validity
- **Suggested resolution**: Later `claimSignedAt` wins
- Or: Indexer's choice — this is not a protocol concern

**Retroactive Claims:**
- Completely valid. I can sign a claim today about something that was true in 2019.
- `claimSignedAt` = now; `claimValidFrom/To` = the time period the fact was true.

> **📝 TODO (Schema):** Rename fields for clarity:
> - `claimedAt` → `claimSignedAt` (unambiguous)
> - `claimSupersedes` → `claimReplaces` (simpler English)

> **📝 TODO (Docs):** Add "Temporal Semantics" section to `/content/docs/fcp/claims/index.mdx` explaining:
> - Difference between signing time and validity window
> - Correction pattern with `claimReplaces`
> - Overlapping validity resolution (suggested: later signature wins)

**Priority:** 🟡 Medium — Schema rename is a breaking change; docs are quick win.

---

### 2.3 Reputation Bootstrapping — Indexer Suggestions

**Status:** Not a protocol gap. Reputation is an **indexer/application concern**.

**What the Protocol Provides:**
- `FideEvaluation` — Raw evaluation signals
- `fcp:rel:trust` — Explicit trust declarations
- `fcp:method:trust-score` — Suggested predicate for scoring

**Indexer Sovereignty:**
- Indexers choose who to trust and how to weight evaluations
- There is no central protocol-level trust authority
- Bootstrapping is an indexer problem, not a protocol problem

**Suggested Patterns (for Indexer Docs):**
- **Seed Evaluators**: Start with well-known, trusted entities with initial weight
- **Web of Trust**: Evaluators vouch for other evaluators via `fcp:rel:trust`
- **Time-Decay**: Older evaluators with consistent track records gain weight
- **Sybil Resistance**: Social graph analysis, cluster detection, or stake-based weight

> **📝 TODO (Docs):** Add "Suggested: Reputation Bootstrapping" accordion to `/content/docs/fcp/claims/indexing.mdx` with patterns for seed lists and web of trust.

**Priority:** 🟢 Low — Protocol is sound; these are suggestions for indexers.

---

### 2.4 Claim Retraction — Documentation Clarity

**Status:** Protocol handles this; just needs clearer docs.

**The Pattern (Already Works):**
1. To **correct** a claim: Publish new claim with `claimReplaces` pointing to old
2. To **close out** a claim: Set `claimValidTo` on the replacement
3. To **retract**: Publish replacement with `claimValidTo: <now>` and no new claim

**Example — Ending an attribute:**
```
Original Claim:
  attribute: "engineer"
  claimValidTo: ""          ← Still active
  claimReplaces: 0x0

Terminating Claim:
  attribute: "engineer"
  claimValidTo: 2024-06-01  ← Close it out
  claimReplaces: 0x<original>
```

**Indexer Behavior (Suggested):**
- Default to "current view" (most recent non-replaced claim)
- Expose full history via API for audit trails
- Respect `claimReplaces` chains for traversal

**GDPR:**
- Data lives in user-controlled Git repos; users can rewrite history
- Indexers should respect platform takedowns (repo deletion = drop from index)

> **📝 TODO (Docs):** Expand "Claim Immutability" section in `/content/docs/fcp/claims/index.mdx` with:
> - Retraction pattern using `claimReplaces` + `claimValidTo`
> - Indexer guidance on current vs history views
> - GDPR note

**Priority:** 🟢 Low — Just documentation clarity.

---

### 2.5 Namespace Conventions — Social Norms, Not Governance

**Status:** Not a governance problem. This is social convention.

**The Model:**

| Prefix | Intent | Example |
|--------|--------|---------|
| `fcp:` | **Universal vocabulary** — "I want everyone to understand this" | `fcp:rel:manages`, `fcp:attr:type` |
| `<org>:` | **Org-specific** — "This is for my internal use only" | `google:rel:internal-team-link` |

**Why Keep `fcp:` Prefix?**
- **Signal of intent**: Using `fcp:rel:manages` says "I'm using shared protocol vocabulary"
- **Open extension**: Anyone can propose `fcp:rel:employs` — if it catches on, it becomes de facto standard
- **Distinct from org-specific**: `acme:rel:...` clearly signals "internal, don't expect interop"

**No Squatting:**
- There's no registry to squat
- Anyone can use any prefix
- Using `google:...` doesn't "claim" it — it just signals intent
- If someone uses `fcp:rel:banana` for something weird, the community ignores it

**Protocol Responsibility:**
1. **Document official `fcp:` predicates** — What's in the docs is blessed
2. **Define naming conventions** — How to structure new predicates
3. **Clarify prefix intent** — `fcp:` = shared; `<org>:` = internal

> **💭 Considered & Rejected:**
> - **Reverse-DNS style** (`com.acme:rel:manages`): Rejected — adds verbosity without benefit. Intent is already clear from prefix.
> - **Namespace registry**: Rejected — creates governance burden, centralization, and squatting incentives. Social convention works better.
> - **`fcp:attr:namespace:owner` claims**: Rejected — unnecessary complexity. Just use the namespace; usage determines legitimacy.

> **📝 TODO (Docs):** Add "Namespace Conventions" section to `/content/docs/fcp/entities/identity.mdx`:
> - Explain `fcp:` = shared vocabulary, `<org>:` = internal
> - No registry, no squatting — purely social convention
> - Community can propose new `fcp:` predicates; adoption = legitimacy

**Priority:** 🟢 Low — Social norms will emerge; docs just need to be clear.

---

### 2.6 Schema Versioning — Already Solved

**Status:** Not a gap. Versioning is implicit in `schemaFideId`.

**How It Works:**
1. **Each schema has a unique `schemaFideId`** — derived from EIP-712 type hash
2. **Changing a schema = new schemaFideId** — different type definition → different hash
3. **Indexers support multiple schemas** — accept claims from any known schemaFideId
4. **Old claims remain valid forever** — immutable by design

**Example:**
```
FideEntityAttribute v1 → schemaFideId: 0xabc...
FideEntityAttribute v2 (new field) → schemaFideId: 0xdef...
Indexer: Accepts both, maps to internal model
```

**Semantic Changes?**
- Don't change what a field means. Create a new schema instead.
- Or: Document the semantic shift with a cutoff timestamp.

**No Explicit Version Number Needed:**
- The schemaFideId *is* the version
- Indexers can maintain a mapping of schemaFideId → internal model
- Envelope already contains `schemaFideId` and optional `schemaName` for debugging

> **📝 TODO (Docs):** Add brief "Schema Evolution" note to `/content/docs/fcp/schemas/index.mdx` explaining that schemaFideId is the version.

**Priority:** 🟢 Low — Already solved by design.

---

### 2.7 Performance at Scale — GitHub is Fine for Now

**Status:** Not a concern for v1. GitHub can handle significant scale.

**The Reality:**
- A Git registry with 100K claims is a few MB of JSONL files — trivial
- GitHub repos can handle millions of files (though directory structure matters)
- If someone truly hits limits, they can create a new registry (same topic, different repo)

**Registry Splitting (If Needed):**
- A registry is defined by the `fide-claim-registry` topic
- Anyone can create multiple registries
- Indexers discover all repos with the topic

**For Now:**
- GitHub is the primary transport — battle-tested and free
- Scaling concerns are theoretical until proven otherwise
- If proven otherwise, the protocol already supports multiple registries

> **📝 NOTE:** Premature optimization. Address when someone actually hits scale.

**Priority:** 🟢 Low — Not a real problem yet.

---

### 2.8 Contested Claims Handling — Application Concern

**Status:** Not a protocol gap. This is application UX.

**What the Protocol Provides:**
- `FideEvaluation` with `value` field (-1, 0, 1)
- Applications can query evaluations and compute their own aggregations
- There is no protocol-level "contested" status — it's just signals

**Application Choices:**
- Show contested claims with "disputed" label
- Hide claims below a confidence threshold
- Escalate to human review
- Ignore evaluations entirely (trust the claim author)

**Appeals:**
- No special protocol mechanism
- Appeals are just new evaluations
- Claim authors can publish evidence claims and request re-evaluation
- This is social, not protocol

> **📝 TODO (Docs):** Add "Suggested: Handling Evaluation Signals" accordion to `/content/docs/fcp/claims/evaluating.mdx` with application patterns.

**Priority:** 🟢 Low — Applications define their own UX.

---

### 2.9 Key Rotation / Revocation Pattern

**Status:** Mechanics exist; pattern not documented.

**How Key Rotation Already Works:**
1. Controller signs `FideEntityRelationship` with `fcp:rel:control` to Old Key
2. When rotating: Controller signs new relationship to New Key with `claimValidFrom: <now>`
3. Controller signs updated relationship to Old Key with `claimValidTo: <now>` (this claim replaces the original control claim)

**Key Compromise Scenario:**

If a private key is stolen:
1. Original owner STILL has access to the key (attacker copied it, didn't delete it)
2. Owner immediately signs a claim ending control: `fcp:rel:control` with `claimValidTo: <now>`, `claimReplaces: <original control claim>`
3. Owner establishes control of a new key
4. Any claims signed by the old key AFTER the `claimValidTo` should be rejected by indexers

If the original owner loses ALL access to the key:
1. Owner uses a different key they control (or establishes a new one via another authority path)
2. Owner signs a claim ending control of the compromised key
3. This is why having multiple keys / backup authority paths matters

**Claims Signed During Valid Period:**
- Claims signed by the key BEFORE `claimValidTo` are still valid and attributed to it
- This is intentional — you cannot retroactively invalidate past claims
- The claim's `claimSignedAt` timestamp determines validity, not "when we discovered compromise"


> **💭 Considered & Rejected: `fcp:rel:revokes` Predicate**
> 
> We considered adding an explicit `fcp:rel:revokes` predicate to invalidate past claims. **Rejected.**
> 
> **Why rejected:**
> 1. **Adds complexity**: Would need to define which claims are revoked (all? specific ones? by time range?)
> 2. **Undermines immutability**: The protocol's strength is that signed claims are permanent records. Revocation muddies this.
> 3. **Existing mechanism works**: Setting `claimValidTo` on the control relationship achieves the goal (invalidates future claims)
> 4. **Trust layer handles disputes**: If past claims are disputed, evaluators can issue negative evaluations. The claims remain as historical record, but applications can see they're contested.
> 5. **Practical reality**: You can't un-sign something. The signature exists. Pretending it doesn't creates worse problems than acknowledging "this key was valid then, isn't now."

**Conclusion:** Key compromise is handled by ending control, not by revocation. Past claims remain valid but are attributed to a key that is now known to be compromised. Applications can use this information as they see fit.

> **📝 TODO (Docs):** Add "Key Rotation Pattern" section to `/content/docs/fcp/claims/signing.mdx` showing the rotation workflow and compromise response.

**Priority:** 🟡 Medium — Developers will need this for production.

---

### 2.10 Protocol Governance

**Status:** Decided. Fide team defines core predicates; hybrid model evolves over time.

**Governance Model (v1):**
1. **Fide Team Defines Core**: Official `fcp:` predicates are documented in FCP specs
2. **Community Proposes**: Anyone can propose new predicates via GitHub issues/discussions
3. **Adoption = Legitimacy**: If a predicate catches on, it may be promoted to "official"

**Future Considerations:**
- RFC process with formal review periods
- Working group for predicate proposals
- Community voting on "suggested" vs "strict" promotion

> **💭 Considered & Rejected (for v1):**
> - **Pure Anarchy**: No curation — rejected because core predicates need consistency for interoperability.
> - **Formal RFC Process**: Too heavyweight for initial launch; can add later.
> 
> **Conclusion:** Start with Fide-managed core predicates. Evolve towards hybrid as community grows.

**Priority:** 🟢 Low — Model is defined; just needs documentation.

---

### 2.11 Error Signaling / Rejection Feedback

**Status:** Application-specific. Not a protocol concern.

**The Reality:**
- Claim drafting and broadcasting happens in various contexts (CLI tools, SDKs, web UIs, agent runtimes)
- Each application handles errors in its own way
- The application/method should be protocol-compliant; how it reports errors is up to the implementation

**Protocol's Role:**
- Define what makes a claim valid (schema, signature, timestamps)
- Indexers reject invalid claims
- How the author learns about rejection is application-specific

**Future:**
- We will share a list of recommended tools and SDKs
- Each will have its own error handling patterns

> **💭 Considered & Rejected:**
> - **Standard Error Schema** (`FideIndexerRejection`): Rejected — adds protocol complexity; applications vary too much.
> - **Required Indexer Feedback API**: Rejected — over-specifies implementation.
> 
> **Conclusion:** Error signaling is out of scope for the protocol. Applications handle this.

**Priority:** 🟢 Low — Not a protocol concern.

---

### 2.12 Query Patterns / API Surface

**Status:** Not specified. What queries should indexers support?

**Likely Required:**
- Get entity by Fide ID
- Get claims about entity
- Get evaluations for claim
- Traverse relationships

**Likely Optional:**
- Full-text search on attributes
- Aggregate evaluation scores
- Historical claim versions

**Current State:**
- Indexers define their own APIs
- No interoperability guarantee between indexers
- Client code becomes indexer-specific

> **💭 Considered & Rejected:**
> - **FCP Query Standard** (required API surface for all indexers): Rejected for v1 — over-specifies implementation; indexers have different architectures (SQL, graph DB, search engine) that don't map to one API.
> - **GraphQL Schema**: Rejected — would require all indexers to support GraphQL; too prescriptive.
> 
> **Conclusion:** Query API is intentionally out of scope. Consider as future work if interoperability becomes critical.

**Priority:** 🟢 Low — Out of scope for protocol spec.

---

### 2.13 Cross-Indexer Consistency

**Status:** Not addressed. Should indexers produce identical results?

**Scenario:**
- Indexer A syncs Registry X at 10:00 AM
- Indexer B syncs Registry X at 10:05 AM
- Registry X had a new claim at 10:02 AM
- Query at 10:03 AM: A says "no", B says "yes"

**Reality:**
- FCP is eventually consistent
- No single "canonical" indexer
- Different indexers may index different registries
- Timing differences are expected

**Guidance:**
- Applications should not assume instant propagation
- For critical queries, poll multiple indexers or wait
- There is no "correct" indexer — each has their own view

> **📝 TODO (Docs):** Add "Eventual Consistency" note to `/content/docs/fcp/claims/indexing.mdx` explaining that timing differences are expected.

**Priority:** 🟢 Low — Just needs brief documentation.

---

### 2.14 Empty / Minimal Claims

**Status:** Edge case. What if fields are semantically empty?

**Examples:**
- `attributeValue: ""` — Is this valid? Meaningful?
- `reasoning: ""` — ActionStep with no reasoning?
- `output: "{}"` — Empty JSON object?

**Current Schema:**
- `required: true` means the field must be present
- It doesn't mean the value must be non-empty

**Guidance:**
- Empty strings are technically valid
- Semantically empty claims are up to evaluators to judge
- Indexers should accept; applications can filter

**Potential Consequences:**
- Many empty/low-quality claims could result in negative evaluations
- Indexers may define their own reputation gates (reject claims from signers with poor track records)
- Applications can filter by quality signals

> **📝 NOTE:** Not a protocol issue. Edge case for applications and evaluators.

**Priority:** 🟢 Low — No action needed.

---

### 2.15 Evidence Content Integrity

**Status:** Understood. Optional, not required.

**Scenario:**
- Claim references `fcp:attr:media:uri: https://example.com/doc.pdf`
- Six months later, content at that URL changes
- Original claim references what existed at signing time

**Options for Content Integrity:**
1. **Author includes `fcp:attr:media:contentHash`**: Optional. Author can attest to what they saw.
2. **Third party attests to hash**: Anyone can claim "content at URL X had hash Y at time Z"
3. **IPFS or content-addressed storage**: Use `ipfs://...` URIs where the hash IS the address
4. **Indexer snapshots**: Indexer can archive content at ingestion time

**Key Insight:**
- `contentHash` is OPTIONAL — up to the claim author whether to include
- Anyone else can make a separate claim attesting to content at a URL
- This is not a protocol requirement; it's a trust signal

**Link Rot:**
- URLs die. This is life.
- Claims reference what existed at signing time
- If content is important, use content-addressed storage (IPFS, Arweave, etc.)

> **📝 NOTE:** No protocol requirement for content hashing. It's a best practice for important evidence.

**Priority:** 🟢 Low — Already understood; no action needed.

---

### 2.16 Internationalization / Encoding

**Status:** Already solved. The `0x...` address model is language-independent.

**How FCP Works in Every Language:**

1. **Canonical predicates are defined in English**: `fcp:rel:manages` → hashes to `0x123...`
2. **The actual data uses `0x...` addresses**: Language-independent at the protocol level
3. **Translations are just attributes on predicate entities**:
   - `fcp:attr:name:es` = "gestionar"
   - `fcp:attr:name:fr` = "gérer"
   - `fcp:attr:name:zh` = "管理"

**Example:**
```
Predicate Entity: 0x123... (canonical: fcp:rel:manages)
  - fcp:attr:name:primary = "manages"
  - fcp:attr:name:es = "gestionar"
  - fcp:attr:name:abbreviated = "mgr"
```

**Key Insight:**
- UIs can display predicates in any language by querying the name attributes
- The canonical English name (`fcp:rel:manages`) is just for documentation
- The protocol uses `0x...` everywhere — no language dependency

**Encoding:**
- All strings are UTF-8 (inherited from EIP-712)
- Predicate names are case-sensitive (`fcp:rel:manages` ≠ `fcp:rel:Manages`)
- No restrictions on language for `attributeValue` fields
- Right-to-left languages are valid

> **📝 NOTE:** FCP is language-independent by design. Translations are attributes, not protocol changes.

**Priority:** 🟢 Low — Already solved.

---

### 2.17 Signing Key Creation & Verification

**Status:** Important for production. Protocol should define suggested verification patterns.

**Creating a Signing Key:**

Anyone can create a signing key using standard Ethereum tooling:

| Method | Description | Use Case |
|--------|-------------|----------|
| **MetaMask/Browser Wallet** | Download extension, create wallet | Individual users, testing |
| **Hardware Wallet** | Ledger, Trezor | High-security, long-term keys |
| **Programmatic** | ethers.js, viem, web3.py | Applications, agents, automation |
| **Secure Enclave** | AWS KMS, GCP HSM, Azure Key Vault | Enterprise, agent infrastructure |

**Example (JavaScript):**
```javascript
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';

const privateKey = generatePrivateKey();
const address = privateKeyToAddress(privateKey);
// address is now your signing_key FideId: 0x...
```

**The Trust Problem:**

Anyone can create a key. But should indexers trust claims from anonymous keys?

**Suggested Pattern (Indexer):**
- Indexers MAY require signing keys to be linked to a social identity before indexing claims
- This is a **suggestion**, not a strict protocol requirement
- Different indexers may have different requirements

**Social Verification Methods:**

| Method | Friction | Reliability | Description |
|--------|----------|-------------|-------------|
| **ENS Text Records** | Low | High | Add Twitter handle to ENS domain; on-chain verification |
| **Guild.xyz** | Very Low | Medium-High | Connect wallet + Twitter; generates proof URL |
| **Cryptographic Signature** | Medium | Absolute | Sign message linking wallet to social handle; post to social |
| **DNS TXT Record** | Low | High | Add wallet address to domain's DNS; proves domain ownership |

**ENS Text Records (Gold Standard):**
```
1. Go to app.ens.domains
2. Edit Profile → Social Accounts
3. Add Twitter handle
4. Verify by signing or posting verification string
5. Proof is now on-chain and permanent
```

**Cryptographic Signature (DIY):**
```
Message: "I am @[TwitterHandle] and I control wallet 0x[Address]"
1. Sign message with wallet (Etherscan, MyCrypto, etc.)
2. Post message + signature hash to Twitter
3. Anyone can verify mathematically
```

**FCP Representation:**

Once verified, the link is represented as FCP claims:

```
FideEntityRelationship:
  fromFideId: 0x<signing_key>
  toFideId: 0x<person_or_agent_entity>
  relationshipType: fcp:rel:control (inverse direction)
  
FideEntityAttribute:
  subjectFideId: 0x<signing_key>
  attributeType: fcp:attr:external-id
  attributeValue: "twitter:@handle" or "ens:name.eth"
```

**Indexer Suggestions:**

| Policy | Description |
|--------|-------------|
| **Open** | Index all valid claims (spam risk) |
| **Social-Verified** | Only index claims from keys linked to social accounts |
| **ENS-Only** | Only index claims from keys with ENS domains |
| **Invite-Only** | Only index claims from keys on allowlist |

> **💭 Considered & Rejected:**
> - **Protocol-Mandated Verification**: Rejected — different contexts need different trust levels. A private indexer might not need social verification.
> - **On-Chain Identity Registry**: Rejected — adds blockchain dependency; social verification works today.
> 
> **Conclusion:** Signing key creation is permissionless. Social verification is SUGGESTED for indexers that want spam resistance. FCP represents these links as standard claims.

**Priority:** 🟡 Medium — Important for production deployments. Should document verification patterns.

---

## Part 3: Questions for Future Versions 🔮

These are not gaps but **design decisions** that may need future attention:

### 3.1 Smart Contract Integration

**Status:** Intentionally vague for now.

The docs mention "future blockchain anchoring" as a possibility:
- **Merkle root anchoring** — Cheap, batch proofs for temporal verification
- **Full on-chain storage** — Expensive, maximum verifiability
- **EAS integration** — Ethereum Attestation Service compatibility

**Decision:** Keep this open. The protocol works without blockchain. If blockchain anchoring becomes valuable, it can be added as an optional layer.

---

### 3.2 Agent-to-Agent Communication — Already Supported

**Status:** Not a gap. Multi-agent works via cross-referenced sessions.

**How It Works:**
- Each agent has their own `sessionFideId` (tied to their `executorFideId`)
- An action step can represent a message: `actionType: fcp:action:send_message`
- The receiving agent starts their own session and references the sender's claim

**Example:**
```
Agent A (Session 1):
  ActionStep: actionType=fcp:action:send_message, output="Do X"
  → claimFideId: 0xabc...

Agent B (Session 2):
  ActionStep: actionType=fcp:action:receive_message, input=<ref to 0xabc>
  ActionStep: actionType=fcp:action:tool_call, reasoning="Agent A asked me to do X"
```

**The link:** Agent B's action step can include `fcp:rel:references` pointing to Agent A's claim, or embed the reference in `input`.

**Conclusion:** Multi-agent = multiple sessions with cross-references. No special protocol mechanism needed.

---

### 3.3 Incentive Mechanisms — Out of Scope

**Status:** Intentionally out of scope for the protocol.

**FCP is an open standard without built-in incentives.** The protocol defines data structures and verification rules, not economics.

**Indexer Business Models (Application-Layer):**
- Premium features / faster sync
- Paid API access
- Enterprise support contracts
- Advertising / sponsorship

**Spam Prevention (Indexer-Level):**
- Rate limiting per signing key
- Reputation gates (minimum evaluator score to be indexed)
- Blocklists

**Why No Protocol-Level Incentives?**
- Avoids token economics complexity
- Keeps protocol simple and neutral
- Allows diverse business models to emerge

---

*Critique prepared: January 18, 2026*
*Protocol version reviewed: FCP v1 (pre-release)*
*Documentation state: `/content/docs/fcp/`*
