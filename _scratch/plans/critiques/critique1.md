# FCP Schema Critique: Context Graph Alignment Analysis

*Generated: 2026-01-14*
*Updated: 2026-01-14 (Incorporating Learning Loop Analysis)*

---

## Executive Summary

After reviewing the context graphs research collection and synthesizing feedback from multiple analyses, the consensus is clear: **FCP has successfully built a world-class Recording System, but must now evolve into a Learning Engine.**

Your `FideDecisionTrace` schema is the "killer app" of the protocol, but it currently lacks the formal loops required to fulfill the "Trillion Dollar Opportunity" thesis. Specifically, the graph needs to look **backward (to Precedent)** and **forward (to Outcomes)** to create the compound interest effect described by Foundation Capital.

---

## 1. The "Missing Loop" Architecture

The current architecture is largely linear: **Input → Decision → Output**. 
To align with the context graph paradigm, we must close two critical loops:

1.  **The Precedent Loop (Backward):** How does today's decision reference last quarter's exception?
2.  **The Learning Loop (Forward):** How does a decision made today get "graded" by its outcome 90 days from now?

### Gap Assessment
| Requirement | Status | Coverage |
|-------------|--------|----------|
| What happened | ✅ | `FideEntityRelationship`, `FideEntityAttribute` |
| Why it happened | ✅ | `FideDecisionTrace` |
| **Precedent linking** | ⚠️ | Missing explicit trace-to-trace edges |
| **Outcome tracking** | 🚨 | **Critical Gap**: No way to grade decision quality |

---

## 2. Schema Categories: Reframing for Context

Your categories should reflect the shift from a database of facts to a substrate for reasoning.

| Current | **Proposed (Learning Loop Aware)** | Rationale |
|---------|------------------------------------|-----------|
| Defining Entities | Identity Layer | Infrastructure foundation |
| Connecting Entities | Graph Structure | Relational foundation |
| Verifying Work | **Decision Layer** | The core "Why" and "How" |
| Signals | **Trust Layer** | Judgments and Reputation |
| Events | (Remove) | Eliminate vestigial noise |
| Definitions | Protocol Governance | Metadata and versioning |

---

## 3. The "Priority One" Upgrades (Surgery List)

### A. Upgrade `FideDecisionTrace` (Critical)
To move from "thought logging" to "structural guardrails," the trace schema must be decision-aware.

1.  **Add `policyFideIds`:** (Optional bytes32[]). Links to the specific `FideId` of the policies (e.g., "Hiring Policy v2.1") that constrained the agent.
2.  **Expand `action` Enum:** Add `approval` (human validation) and `exception` (policy override). Overrides are high-signal data points for risk modeling.

### B. Solve Precedent via `FideEvidence` (Medium)
Don't create a new schema for precedents; it creates bloat. Instead, treat **Precedent as Internal Evidence**.

- **Recommendation:** Extend `FideEvidence`. Allow `evidenceFideId` to accept a `FideDecisionTrace` signature. Add a `type` field to distinguish between `document`, `url`, and `trace_precedent`.

### C. The Outcome Gap: `FideOutcomeLink` (Critical Priority)
This is the most important addition. You cannot run RLHF or calculate ROI on autonomy without outcomes. Outcomes happen *after* the decision is sealed; therefore, they require a new claim pointing back.

```typescript
FideOutcomeLink {
   traceID: uuid,           // The decision we are "grading"
   outcomeType: string,     // 'revenue', 'churn', 'security_breach'
   outcomeValue: string,    // '+500', 'false_positive', 'critical'
   timestamp: string        // When the outcome was observed
}
```

---

## 4. Context Graph Alignment: Strong vs. Weak

| Tier | Schemas | Alignment |
|------|---------|-----------|
| **Tier 1 (Reasoning Substrate)** | `FideDecisionTrace`, `FideGeneration`, `FideOutcomeLink` | ✅ **Strong Context Graph Primitives** |
| **Tier 2 (Trust Engine)** | `FideClaimVerdict`, `FideEntityScore`, `FidePolicyFlag` | ✅ Methodology-anchored judgments are brilliant |
| **Tier 3 (Structure Layer)** | `FideEntityType`, `FideEntityRelationship` | ⚠️ Infrastructure (not differentiating) |
| **Tier 4 (The Risk Area)** | `FideEntityAttribute` | ⚠️ **Semantic Swamp Risk.** Needs indexer-level filtering |

---

## 5. Summary Verdict & Recommendations

### Keep (The Moat)
- **`FideId` (3-tier)**: Solves namespace collision.
- **`FideDecisionTrace`**: The protocol's most valuable asset.
- **Methodology-Anchored Verdicts**: Solves the black-box judging problem.

### Refine (The Surgery)
- **Consolidate `PolicyFlag`?** NO. Keep separate; "Safety" is semantically distinct from "Truth."
- **`FideEntityAttribute`**: Tighten `attributeCategory` enums. Restrict the Indexer, not the schema, but establish protocol-level conventions for "Decision-Critical" data vs "Noise."

### Create (The missing piece)
- **`FideOutcomeLink`**: Essential for closing the learning loop. This transforms FCP from a history of agent actions into a dataset for optimizing agent intelligence.

**Goal Confirmation:** With these updates, your architecture transitions from a **System of Record for Data** to a true **System of Record for Decisions**, uniquely capable of powering autonomous agents through searchable precedent and outcome-driven learning.
