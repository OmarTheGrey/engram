---
date: 2026-10-25
author: claude-agent
type: finding
card: PX1
chapter: limitations
pillar: plane
hypothesis: H1
evidence:
  - packages/pi-extension/test/attacks.test.ts
  - packages/pi-extension/src/extension.ts
supersedes: none
---

**What.** Pi's compaction and branch summaries send the session's messages to the model without the `context` event, so the memory tag never applies to them.

**Why.** Finding R7-15 suspected it from the bundle; pi 1.3.0's core/compaction/compaction.js serialises the messages to summarise with convertToLlm and calls the model directly.

**Result.** A session that read memory and then compacted sent the plain memory text in the summarisation request (the attack test failed on the PR's code). The extension now replaces memory results and recall messages with a notice in the arrays pi hands `session_before_compact` and `session_before_tree`, and the request carries none. That relies on pi summarising the arrays it passed the handler, which the test pins at pi 1.3.0.

**Consequence.** A pi upgrade reruns the compaction attack test before the pin moves.
