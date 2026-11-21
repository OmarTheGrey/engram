---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
  - packages/core/test/unit/policy/secrets.test.ts
supersedes: none
---

**What.** Content beyond `SCAN_LIMIT` (65,536 characters) is denied when `secrets` or `pii` is in block, and held when the guards on are in review, under `engram/write/guard-failure`, the reason naming the limit.

**Why.** The coordinator's decision (V-3a): holding unscanned content stores whatever padding hid, with its value in the event's item, and a memory write over 64K is unusual.

**Result.** Tested: a key after 65,536 padding characters is denied under `secrets: block` and under `pii: block`, held under `secrets: review`.

**Consequence.** A large legitimate write under a blocking guard is refused; `max_content_bytes` or a review policy is the way to admit it.
