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
supersedes: none
---

**What.** The request encoding (`cedarReadRequest`, `cedarWriteRequest`, `cedarInstant`, `confidenceBits`) lives in `packages/core/src/policy/cedar.ts` beside `exportCedar`, depends on no policy, and is not exported from `packages/core/src/index.ts`.

**Why.** The schema fixes how Engram data must look to a Cedar engine, so its encoding is part of the translation, and an organisation reading the policy in Cedar needs it too. Keeping it policy-independent puts every policy judgement in the exported text, where the test checks it. The card names no change to the package index, a shared file.

**Result.** The test imports the module directly; no other package reaches it.

**Consequence.** If wrong, a later card adds one export line to the index; nothing else moves.
