---
date: 2026-11-19
author: claude-agent
type: finding
card: RV1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/conditions.ts
  - docs/research/preregistration.md
  - docs/tasks/RV1.md
supersedes: none
---

**What.** v1's conditions omit text that C3 and C4 send, and the ids differ between conditions on other arms; proposed v1 wording, for the lead.

**Why.** Review finding RV-EXP-10.

**Result.** C3 sends, before its legend and the policy JSON, a sentence naming the preset, one naming the requester's id, level and memberships, and one instruction to read and write only what the policy allows (`policyInstruction`); C4 adds, after C3's text, a sentence naming the item attributes, the legend and one instruction to decide from them (`metadataInstruction`). v1 describes neither. The proposed lines for v1's C3 and C4 are in `docs/tasks/RV1.md`, section "Proposed v1 wording". Ids: MEM-INV-Bench's are fixed by this card; under C5 on GateMem and LongMemEval events still share the items' counter, and on GateMem the turns are numbered first, so only items the model writes differ.

**Consequence.** The lead words v1 before the tag.
