---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/test/property/cedar.test.ts
supersedes: none
---

**What.** `exportCedar` throws `CedarExportError` on a policy that turns on any content guard or trust option, and exports a policy whose blocks are all `off` exactly as one without them.

**Why.** The injection screen (ADR 0039, card E2.10) is a set of regular expressions over content, which the export does not translate, and the secret, PII and trust options will change the gate when their cards land. A partial export would silently disagree with the evaluator.

**Result.** No registered preset sets either block, so all three export; the refusal and the `off` case are tested.

**Consequence.** When E2.9 or E2.11 lands, its options stay refused until a card translates them or the export states another exclusion.
