---
date: 2026-11-21
author: claude-agent
type: decision
card: L5
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - packages/core/test/unit/lint/near-duplicate.test.ts
supersedes: none
---

**What.** An item whose strict content hash an earlier item of its class shares takes no part in the tier; the finding is `info`, names the earliest earlier match, and carries the estimate, the cosine and the shingle kind, never content.

**Why.** Exact copies are the `duplicate` lint's, so a policy listing both gets one finding per item and the duplicate findings stay the same. A near-duplicate is advisory, so it is less severe than an exact one.

**Result.** A test asserts that with both lints listed the duplicate findings equal those of `duplicate` alone. Cost if wrong: a policy listing only the tier misses exact copies.

**Consequence.** Nothing else.
