# FCP Schema Critique: critique8 (The Unified Envelope Model)

*Draft: 2026-01-19*

---

## Preliminaries: `deriveFideId(input)`

Throughout this specification, `deriveFideId(input)` refers to the deterministic, offline generation of a Fide ID from a string or byte array. This bridges the **Human World** (literals) to the **Machine World** (addresses).

**Algorithm:**
1. Calculate the **Keccak-256** hash of the UTF-8 string `input`.
2. Take the **last 20 bytes** (least significant bits).
3. Prefix with `0x` to format as an Ethereum address string.

**Pseudocode:** 
`return "0x" + keccak256(input).slice(-40);`

### Reference Implementations

Since most libraries do not have a single function for "String → Address" (most assume "PubKey → Address"), use these patterns:

#### 1. Viem (Recommended)
```typescript
import { keccak256, toBytes, slice } from 'viem'
const deriveFideId = (input: string) => slice(keccak256(toBytes(input)), 12)
```

#### 2. Ethers.js (v6)
```typescript
import { id, dataSlice } from 'ethers'
const deriveFideId = (input: string) => dataSlice(id(input), 12)
```

#### 3. Web3.js
```javascript
const deriveFideId = (input) => '0x' + web3.utils.keccak256(input).slice(-40)
```

> **Note:** Do not use `keccak256` directly if it returns 32 bytes (Bytes32). FCP IDs MUST be 20 bytes (Address) to maintain compatibility with standard indexing tools.

### Why doesn't this exist as a native function?

In standard Ethereum development, converting an arbitrary string to an address is rare. Standard paths are:
* **Keys → Addresses:** Standard (`computeAddress`)
* **Strings → Hashes:** Standard (`keccak256`)
* **Strings → Addresses:** **Custom Protocol Logic** (FCP Standard)

### Recommendation
Define this helper **once** in your SDK (e.g., `@fide/utils`) and document it as the canonical implementation. Do not rely on developers "finding" a native library function, as they may use 32-byte hashing by mistake.

### Standard Namespaces

FCP uses Compact URIs (CURIEs) for predicates. Indexers and SDKs should recognize these standard prefixes to ensure interoperability:

- **`schema:`** → `http://schema.org/` (General attributes and properties)
- **`rdf:`** → `http://www.w3.org/1999/02/22-rdf-syntax-ns#` (Typing and structural relationships)
- **`fide:`** → Protocol-specific mechanics (e.g., `fide:reasoning`)

### Predicate Selection Strategy

To avoid technical debt and maximize interoperability, FCP follows a "Standard First" strategy:

1.  **If a standard exists, use it.** For human judgments/reviews, use `schema:reviewBody`.
2.  **If the context is AI-specific, use `fide:`.** No standard exists for "Agent Internal Monologue," so we define `fide:reasoning` (similar to OpenTelemetry defining `gen_ai.*` semantic conventions).
3.  **For external identity links, use `schema:identifier`.** The URN format (`fide:<AuthorityFideId>:<Type>:<Value>`) encodes the platform authority without requiring custom predicates.

| Context | Concept | Predicate | Rationale |
| :--- | :--- | :--- | :--- |
| **Evaluation** | Explanation | `schema:reviewBody` | Standard for reviews/judgments. |
| **Action** | Status | `schema:actionStatus` | Standard (Completed, Failed, etc.). |
| **Action** | Chain of Thought | `fide:reasoning` | AI-specific log; no W3C/Schema.org equivalent. |
| **Identity** | Name | `schema:name` | Universal property. |
| **Identity** | External Identifier | `schema:identifier` | Standard for linking to external systems (Twitter, GitHub, etc.). |
| **Action** | Input Data | `schema:object` | Standard for the object of an action. |
| **Action** | Output Data | `schema:result` | Standard for the result of an action. |

---

## 0. Foundational Model: Signed RDF

The Fide Context Protocol implements a cryptographic version of **RDF (Resource Description Framework)**. If HTML is the "Links of Documents" (the Web), RDF is the "Links of Facts" (the Knowledge Graph).

### 0.1 The Core Concept: The Triple
In traditional databases (SQL), data is stored in tables. In FCP, knowledge is stored in **Triples**. A triple is the atomic unit of knowledge:
1.  **Subject:** The thing you are talking about (e.g., `0xAlice`).
2.  **Predicate:** The relationship or attribute (e.g., `schema:knows`).
3.  **Object:** The value or the target entity (e.g., `0xBob`).

### 0.2 FCP as a "Signed Quad-Store"
In the semantic web, adding a 4th dimension—**Context**—turns a Triple into a **Quad**. 
*   **Triple:** `[Subject, Predicate, Object]`
*   **Quad:** `[Subject, Predicate, Object]` + **[Context]** (Who signed it? When? In which envelope?)

FCP is a **Signed Quad-Store**. Every fact is not just a statement, but a statement cryptographically bound to an author and a timestamp.

### 0.3 The Model: A Directed Graph
Because any Subject can be linked to any Object, FCP forms a **Directed Graph**.
*   Alice → `schema:knows` → Bob
*   Alice → `schema:identifier` → `fide:0xTwitter:slug:alice`
*   Bob → `creative_work:likes` → Pizza
*   Pizza → `schema:hasIngredient` → Cheese

This graph model is why FCP is powerfully decentralized: **You don't need a rigid schema.** Anyone can add a new edge (claim) to the graph without asking permission or breaking existing data structures.

### 0.4 The `rdf:` Prefix
FCP uses the `rdf:` prefix for fundamental structural concepts defined by the RDF standard:
*   **`rdf:type`**: Signifies the "Is A" relationship.
*   *Example:* `0xAlice` `rdf:type` `schema:Person` ("Alice is an instance of a Person").

---

## Executive Summary

This proposal defines the final **Unified Envelope Model** (critique8). Every interaction in the FCP protocol is a "shipping container" (Envelope) holding a "manifest" (`FideClaims`) of one or more "items" (`claims`).

```typescript
// === 1. THE MANIFEST (The Signed Payload) ===
interface FideClaims {
  // === GLOBAL CONTEXT ===
  signedAt: string;           // ISO 8601 UTC timestamp of the signing event
  subject: address;           // WHO/WHAT (shared across all items)
  
  // === THE ITEMS ===
  claims: FideClaim[];        // <--- PLURAL holds SINGULAR
}

interface FideClaim {
  // === LIFECYCLE CONTROL ===
  replaces: address;           // The specific Claim ID to replace (0x0 if new)
  validFrom: string;           // When this specific fact becomes true
  validTo: string;             // When this specific fact expires
  
  // === THE DATA ===
  predicate: string;           // WHAT KIND (signed string)
  object: address;             // TARGET (Entity ID or deriveFideId of value)
  objectLiteral: string;       // PROOF (The pre-image string used to derive the object ID)
}

// === 2. THE SHIPPING CONTAINER (The Envelope) ===
interface FideClaimEnvelope {
  // Envelope ID (Derived: deriveFideId(authorSignature))
  // Note: In the transport layer (.jsonl), this may be omitted or treated 
  // as a non-normative "helpful hint" to avoid dual-source-of-truth risks.
  fideId: address;               

  // Signing Key FideId (The address of the account that signed)
  authorshipKeyFideId: address;  

  // Result of eth_signTypedData (EIP-712 hex encoded 65 byte signature)
  authorSignature: string;       

  // The Manifest (The Payload)
  signedMessage: FideClaims;     
}


> **Key Design Decisions:**
> - **Plural Naming** — `FideClaims` (struct) and `claims` (array) clarify that every event is a batch of assertions.
> - **Unified Subject** — Shared subject ensures atomicity and simplifies graph indexing.
> - **Deterministic IDs** — Every individual claim item has a globally unique, referencable ID derived from its position.
> - **Self-Contained** — Signed literals ensure intent forensics and anti-fragility.

### Field Placement Summary

| Field | Location | Why? |
| --- | --- | --- |
| **`fideId`** | **Envelope** | Identifies the package. Derived from signature. |
| **`signedAt`** | **Manifest** | Global timestamp of the *signing event*. |
| **`subject`** | **Manifest** | The *actor* or target is consistent across the batch (atomic). |
| **`validFrom`** | **Claim** | When this specific fact becomes true. |
| **`validTo`** | **Claim** | When this specific fact expires. |
| **`replaces`** | **Claim** | Surgical replacement of specific old facts. |


---

## 1. Referenceability: Deterministic ID Derivation

One of the core requirements is the ability to make claims *about* other claims (e.g., a "Verdicts" evaluating a specific reasoning step). We achieve this without bloat by using **Deterministic ID Derivation**.

### 1.1 The Chain of IDs

1.  **Envelope ID (`E_ID`)**: `deriveFideId(authorSignature)`
    *   *Why:* The EIP-712 signature is the unique, immutable anchor of the entire event.
2.  **Claim ID (`C_ID`)**: `deriveFideId(E_ID + "_" + index)`
    *   *Why:* It allows referencing an individual item in a batch (0-indexed) without requiring the item itself to store an ID.

### 1.2 Example: Evaluating a Reasoning Step
If an Agent publishes an Action envelope (`0xabc...`) where the "reasoning" is the 6th item (index `5`):
-   The Reasoning Claim ID is `deriveFideId("0xabc..._5")`.
-   A Judge can evaluate that specific claim by setting it as the `subject` of a new claim.

### 1.3 The "Derive on Read" Pattern

To avoid **"Dual Source of Truth"** risk and minimize storage bloat, we follow a strict derivation policy:

1.  **On Disk (Transport/Git)**: Keep it minimal. Do not store individual claim IDs.
    ```json
    // .jsonl file content
    {
      "fideId": "0xEnvelopeFideId...", 
      "signedMessage": { ... },
      "signature": "0x..."
      // NO individual claim IDs stored here
    }
    ```
2.  **In Memory (SDK/Indexer API)**: Enrich the objects on the fly. The developer should see the IDs, but they are calculated by the tooling, not fetched from storage.
    ```typescript
    // SDK enrichment logic (pseudo-code)
    const envelope = await client.getEnvelope("0x123...");
    
    // The developer accesses the ID as if it was stored
    console.log(envelope.claims[0].id); // SDK calculates this getter on-read!
    ```

**Philosophy:** Don't store what you can calculate. Let the SDK handle the complexity so the developer gets a rich experience without the protocol carrying redundant data.

### 1.4 EIP-712 Definitions

To sign a claim using `eth_signTypedData`, use the following `types` structure. This ensures the signature precisely covers both the manifest context and the granular claim items.

```javascript
const types = {
  FideClaims: [
    { name: 'signedAt', type: 'string' },
    { name: 'subject', type: 'address' },
    { name: 'claims', type: 'FideClaim[]' } // <--- PLURAL holds SINGULAR
  ],
  
  FideClaim: [ // <--- Renamed from FideItem
    { name: 'replaces', type: 'address' },
    { name: 'validFrom', type: 'string' },
    { name: 'validTo', type: 'string' },
    { name: 'predicate', type: 'string' },
    { name: 'object', type: 'address' },
    { name: 'objectLiteral', type: 'string' }
  ]
}
```

---

## 2. Design Decisions (critique8 Rationale)

### 2.1 Why Plural Naming?

> **❌ Rejected: FideClaim (Singular)**
>
> We considered keeping the struct name singular.
>
> **Why we moved to Plural:**
> 1. **Semantic Clarity** — An "Envelope" usually contains multiple things. `FideClaims` (the manifest) holding `claims` (the items) is the perfect mental model.
> 2. **Eliminates confusion** — It distinguishes the **Batch Event** from the **Atomic Assertions** inside it.

### 2.2 Why a Shared Subject?

> **❌ Rejected: Per-Claim Subject**
>
> We considered putting the `subject` inside the `claims` array to allow batching assertions about multiple different entities in one signature.
>
> **Why we rejected it (Contextual Locality):**
>
> 1. **Efficient Subscriptions** — Listeners subscribing to updates *about* a specific entity can filter envelopes by the top-level `subject` field without parsing the internal array.
> 2. **Spam Isolation** — Prevents low-quality assertions about unrelated entities from "hitching a ride" inside an envelope containing high-quality assertions about popular entities.
> 3. **Atomic Indexing** — Ensures that an entire event maps to a single node in the graph, simplifying database sharding and partitioning logic.


### 2.3 Why No `schemaFideId`? (Revisited)

> **Decision:** Still Removed.
> The protocol has exactly **one** structure (`FideClaims`). If the structure changes in the future, the EIP-712 `version` field or a new `primaryType` handles the discrimination.

### 2.4 Authorization is Authentication

Under the Fide Context Protocol, "Authorization" does not mean "Permissions" in the Web2 sense (ACLs).

- **The Only Rule:** Did the key associated with the `authorshipKeyFideId` sign this? If yes, it is "authenticated."
- **The Graph's Job:** It is up to the *consumer* (the Judge or the Application) to decid if that author's opinion matters.

By decoupling "Who can say it" from "Is it true," the protocol remains truly decentralized. We don't enforce who can speak; we only enforce that if they speak, we know exactly who they are and what they said.

### 2.5 The "Strict Literal Pre-image" Rule (Summary Rule)

To enable **Self-Healing Verification**, the `objectLiteral` field must strictly follow these rules based on the nature of the `object`:

1.  **Literal Attributes**: `objectLiteral` is the value itself (e.g., `"Alice"`).
2.  **Well-Known Entities**: `objectLiteral` is the **canonical string** used to derive the ID (e.g., `"iso-639-3:eng"`). This allows any indexer to verify that `object: 0x7f3a...` is mathematically correct without a central lookup.
3.  **Random Entities (UUID)**: `objectLiteral` is `""` (Empty string). Since UUIDs are random, there is no pre-image to verify.

| Target Nature | `objectLiteral` Content | Example |
| :--- | :--- | :--- |
| **Simple Literal** | The literal value | `"English"` |
| **Well-Known Entity** | The derivation string | `"iso-639-3:eng"` |
| **Random Entity (UUID)** | Empty String | `""` |
| **Structured Identifier (URN)** | The URN string | `"fide:0x123...:slug:alice"` |

> **Note on Structured Identifiers**: For external identity links using `schema:identifier`, the `objectLiteral` contains a URN in the format `fide:<AuthorityFideId>:<Type>:<Value>`. This is a valid URI string that encodes both the authority (which platform) and the value (the username/ID) in a single, self-describing literal.


---

## 3. Mapping Model critique8

### 3.1 Simple Attribute (Length 1)

```typescript
{
  subject: "0xAlice...",
  claims: [
    {
      predicate: "name:primary",
      object: deriveFideId("Alice Smith"),
      objectLiteral: "Alice Smith",
      replaces: "0x0000000000000000000000000000000000000000",
      validFrom: "2026-01-19T12:00:00Z",
      validTo: ""
    }
  ]
}
```

### 3.2 Complex Action (Batch)

An action that used to be a specialized schema is now a single `FideClaims` manifest:

```typescript
{
  signedAt: "2026-01-19T12:00:00Z",
  subject: ActionEntityFideId,
  claims: [
    { predicate: "schema:agent", object: AgentFideId, objectLiteral: "", replaces: "0x0000000000000000000000000000000000000000", validFrom: "", validTo: "" },
    { predicate: "schema:actionStatus", object: deriveFideId("schema:CompletedActionStatus"), objectLiteral: "schema:CompletedActionStatus", replaces: "0x0000000000000000000000000000000000000000", validFrom: "", validTo: "" },
    { predicate: "schema:startTime", object: deriveFideId("2026-01-19T12:00:00Z"), objectLiteral: "2026-01-19T12:00:00Z", replaces: "0x0000000000000000000000000000000000000000", validFrom: "", validTo: "" },
    { predicate: "schema:endTime", object: deriveFideId("2026-01-19T12:00:05Z"), objectLiteral: "2026-01-19T12:00:05Z", replaces: "0x0000000000000000000000000000000000000000", validFrom: "", validTo: "" },
    { predicate: "schema:object", object: deriveFideId("{...inputs...}"), objectLiteral: "{...json...}", replaces: "0x0000000000000000000000000000000000000000", validFrom: "", validTo: "" },
    { predicate: "schema:result", object: deriveFideId("{...outputs...}"), objectLiteral: "{...json...}", replaces: "0x0000000000000000000000000000000000000000", validFrom: "", validTo: "" },
    { predicate: "fide:reasoning", object: deriveFideId("..."), objectLiteral: "Reasoning string...", replaces: "0x0000000000000000000000000000000000000000", validFrom: "", validTo: "" }
  ]
}
```

### 3.3 Evaluation / Judgment (Review)

A Judge evaluating a previous claim (using `schema:Review` semantics):

```typescript
{
  signedAt: "2026-01-19T14:00:00Z",
  subject: TargetClaimFideId,
  claims: [
    { 
      predicate: "rdf:type", 
      object: deriveFideId("schema:Review"), 
      objectLiteral: "schema:Review", 
      replaces: "0x0000000000000000000000000000000000000000", 
      validFrom: "", validTo: "" 
    },
    { 
      predicate: "schema:reviewBody", 
      object: deriveFideId("The agent followed the protocol correctly..."), 
      objectLiteral: "The agent followed the protocol correctly...", 
      replaces: "0x0000000000000000000000000000000000000000", 
      validFrom: "", validTo: "" 
    }
  ]
}
```

### 3.4 Well-Known Entity Link (Self-Healing)

Linking Alice to the "English" language using the ISO-639-3 standard:

```typescript
{
  subject: AliceFideId,
  claims: [
    {
      predicate: "schema:inLanguage",
      // ID derived from: deriveFideId("iso-639-3:eng")
      object: "0x7f3a1234...", 
      // The Pre-image Proof:
      objectLiteral: "iso-639-3:eng",
      replaces: "0x0000000000000000000000000000000000000000",
      validFrom: "",
      validTo: ""
    }
  ]
}
```

### 3.5 External Identity Linking (Structured Identifiers)

FCP uses **Structured Identifiers** to link entities to external platforms (Twitter, GitHub, email systems, etc.) without requiring a central platform registry.

#### The Pattern: `fide:<AuthorityFideId>:<Type>:<Value>`

Every character in this URN format serves a purpose:
1.  **`fide`**: The scheme (tells parsers "this is a Fide Structured Identifier")
2.  **`<AuthorityFideId>`**: The Fide ID of the platform/system that owns the namespace (e.g., Twitter's entity ID)
3.  **`<Type>`**: The identifier type (see taxonomy below)
4.  **`<Value>`**: The actual identifier string

#### Type Taxonomy

| Type | Mutability | Example |
| :--- | :--- | :--- |
| **`id`** | Immutable | Numeric user IDs (Twitter: `44196397`) |
| **`slug`** | Mutable | Usernames/handles (Twitter: `elonmusk`) |
| **`email`** | Mutable | Email addresses |
| **`url`** | Mutable | Profile URLs |

#### Why This Design is "Emergent Authority"

This pattern is fully decentralized:
*   **Today**: You use the well-known Fide ID for Twitter (`0xTwitterID`).
*   **Tomorrow**: A student builds "CampusNet" and generates their own Fide ID (`0xCampusID`).
*   **Result**: They can immediately issue `fide:0xCampusID:slug:alice` identifiers. The protocol doesn't need updating; authority emerges from the graph.

#### Example: Linking Alice to Twitter

```typescript
{
  subject: AliceFideId,
  claims: [
    {
      // STANDARD PREDICATE (Not inventing schema:slug)
      predicate: "schema:identifier",
      
      // STRUCTURED URN (Self-describing)
      objectLiteral: "fide:0x1234567890abcdef1234567890abcdef12345678:slug:elonmusk",
      
      // DETERMINISTIC ID (Derived from the URN)
      object: deriveFideId("fide:0x1234567890abcdef1234567890abcdef12345678:slug:elonmusk"),
      
      replaces: "0x0000000000000000000000000000000000000000",
      validFrom: "",
      validTo: ""
    }
  ]
}
```

#### Why `schema:identifier` (Not Custom Predicates)

Schema.org's `identifier` property is the universal standard for expressing "this entity has this identifier in that system." It covers ISBNs, GTINs, UUIDs, usernames, and more. By encoding the platform authority and type into the URN itself, we avoid inventing non-standard predicates like `schema:slug` or `fide:twitterHandle`.

---

---

## 4. Derived Types (Structural Typing)

Indexers no longer rely on type flags. They derive the "Nature of the Claim" from its structure.

| Type | Condition |
| :--- | :--- |
| **Relationship (Random/UUID)** | `objectLiteral === ""` |
| **Relationship (Well-Known)** | `deriveFideId(objectLiteral) === object` |
| **Attribute (Literal)** | `deriveFideId(objectLiteral) === object` |
| **External Identifier** | `predicate === "schema:identifier"` AND `objectLiteral.startsWith("fide:")` |
| **Action** | `subject` is an Action Entity; uses `schema:actionStatus` |
| **Evaluation** | `subject` is a Claim ID; uses `schema:reviewBody` |

---

## 5. Transport: JSON Lines (.jsonl)

The **Envelope** is the atomic unit of transport.

-   **One Line** = One `FideClaimEnvelope` (containing a `FideClaims` manifest).
-   **One File** = A temporal log of Envelopes.

### 5.1 Filename Convention

```
YYYY-MM-DD-<HHmm>-<sequence>.jsonl
```

- `YYYY-MM-DD`: Date of the broadcast window.
- `<HHmm>`: Start time of the window (24-hour format).
- `<sequence>`: Incrementing counter (1, 2, 3...) for rollover. Grows indefinitely as needed.

*Example:* `2024-01-19-1400-1.jsonl`

### 5.2 The "Rollover" Rule

To maintain performance and compatibility with Git hosts (e.g., GitHub's 100MB file limit):

1. **Size Limit:** Files **SHOULD** be rotated when they reach **50MB** in size.
2. **Sequence:** When rotating due to size within the same time window, increment the `<sequence>` number.
3. **Appends Only:** Indexers expect files to be append-only. Never rewrite a published `.jsonl` file except for rare compliance/GDPR purges.


---

## 6. Trade-offs Summary

### 6.1 Pros
- **Zero Ambiguity** — One structure for everything.
- **Atomic Batches** — Actions/Evaluations land as complete units.
- **Referenceability** — Every sub-claim has a deterministic ID for evaluation.
- **Intent Forensics** — Signed literals prove what the user actually saw.
- **Git Friendly** — `.jsonl` grouped by time prevents file explosion.

### 6.2 Cons
- **Fixed Subject** — Cannot batch assertions for multiple different subjects in one signed event. (Rationale: This ensures Contextual Locality and prevents "Trojan Horse" spam; multiple envelopes can still be grouped in a single `.jsonl` file).
- **Redundant Literal Storage** — Common predicates (e.g., "name") are stored as strings in every claim. (Mitigation: Indexers normalize on write; Git compression handles redundancy in the raw log).

---

## 7. Recommendation

**Adopt the Unified Envelope Model (critique8) as the FCP Protocol Standard.**

1.  **Stop using specialized schemas** for Attributes, Relationships, Actions, and Evaluations. 
2.  **Standardize on the `FideClaims` manifest** (the array-based structure) for all interactions.
3.  **Implement Indexers** that derive types structurally and maintain the deterministic `C_ID` mapping for referencability.

---

## 8. Next Steps

1. [ ] **EIP-712 Definitions**: Finalize the `FideClaims` and `FideClaim` type records for `eth_signTypedData`.
2. [ ] **SDK Update**: Implement `deriveFideId(signature + "_" + index)` for individual item referencing.
3. [ ] **Migration Plan**: Map existing `FideActionStep` and `FideEvaluation` rows into the unified `FideClaims` format in the indexer database.
4. [ ] **Documentation**: Update the official FCP Schema docs to deprecate the 4-schema model in favor of the single SPO-Array model.

---

*"Manifest. Envelope. Items. One structure. Implicit types. Deterministic IDs."*
