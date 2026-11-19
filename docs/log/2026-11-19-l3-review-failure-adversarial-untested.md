---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: H3
evidence:
  - packages/core/test/unit/lint/model.test.ts
  - docs/decisions/0008-two-tier-lints.md
supersedes: none
---

**What.** Review finding L3-6: the parser's reading of adversarial replies was not pinned by a test, and the ADR amendment did not state it.

**Why.** The pre-registration should name exactly how a reply is read, including replies built to mislead it.

**Result.** One test pins it: extra fields accepted, a flag inside prose malformed, two JSON objects malformed, a duplicated verdict key read last-wins, text after a code fence malformed. Dropping the fence's end anchor fails it. The ADR 0008 amendment states the same.

**Consequence.** Steering by an item's own content is recorded as a finding of this date.
