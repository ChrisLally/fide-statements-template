This is a classic "Theory vs. Practice" trade-off.

For **FCP specifically**, introducing the **Lifecycle first** is risky because the protocol is so heavily dependent on its specific definitions. If a developer tries to read "Drafting" (Step 1) without knowing what a "Fide ID" or "Claim" is, they will hit a wall immediately.

However, you can have your cake and eat it too. You don't need to force them to read the entire Ontology spec before they see action.

### The "Lifecycle First" Risk

If you put Lifecycle first, Step 1 (Drafting) says: *"Transform working memory into structured FCP claims."*.

* The reader immediately asks: "What is an FCP claim? What is the structure?"
* They have to click away to the Ontology section to understand the first sentence of the Lifecycle section.

### The Recommendation: The "Sandwich" Method

Keep **Ontology first in the sidebar**, but use your **Introduction (`index.mdx`)** to give them a "Taste of the Lifecycle."

**1. The Intro (`/docs/fcp/index.mdx`) - The Hook**
Use the intro to show the *flow* immediately. Show them the 5-step diagram and a code snippet of a signed claim. This satisfies the "dive in" desire without breaking the learning curve.

**2. Ontology (`/docs/fcp/ontology`) - The Foundation**
Keep this first in the folder structure. They cannot effectively Draft (Lifecycle Step 1) if they don't know the Schema (Ontology).

* *Why:* You need the *vocabulary* before you can speak the *language*.

**3. Lifecycle (`/docs/fcp/lifecycle`) - The Action**
This follows naturally. Now that they know what a "Claim" and an "Entity" are, they are ready to learn how to Sign, Broadcast, and Index them.

### Revised Folder Order

This order ensures they have the tools (Ontology) before they try to build the house (Lifecycle).

```text
docs/fcp/
├── index.mdx                     # Intro: The "Hook" (Show the 5 steps here briefly)
│
├── ontology/                     # First: Learn the Vocabulary (Nouns)
│   ├── identifiers/
│   ├── entities/
│   ├── schema/
│   └── patterns/
│
└── lifecycle/                    # Second: Execute the Process (Verbs)
    ├── index.mdx                 # Deep dive into the pipeline
    ├── drafting.mdx
    ├── signing.mdx
    ├── broadcasting.mdx
    ├── indexing.mdx
    └── evaluating.mdx

```

### Why this creates a better "Dev Experience"

* **The "Hello World" Effect:** Your Intro page acts as the "Lifecycle Lite." It shows them the end result (Evaluating) and the input (Drafting) quickly.
* **No Context Switching:** By the time they click "Lifecycle > Signing," they already know what EIP-712 is and what a Fide ID is because they saw it in Ontology. They don't have to jump back and forth.
* **Reference Utility:** When they come back later just to look up a field name, "Ontology" is right at the top, which is where reference specs belong.
