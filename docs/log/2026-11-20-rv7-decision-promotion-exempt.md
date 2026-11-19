---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** A reviewer's in-place promotion of an item carrying grants is exempt from the owner's rewrite rule. The exemption holds only when the promoted item is the projected one with its status and version changed and nothing else.

**Why.** The task names promotion as a flow that must keep working. A reviewer is never the owner (ADR 0026), and activating a candidate shows the grantee only the owner's text. The exemption is a `promotion` option that `evaluateWrite` takes from the promotion gate alone. `Plane.write` never passes it, and the gate checks the item itself, so a caller cannot widen it.

**Result.** `write-grants.test.ts` has a reviewer promoting Dana's granted org candidate in place. It fails when the option is dropped (mutation check).

**Consequence.** Nothing else in core rewrites an item under its id without being its owner. A new path that does would need the lead's rule.
