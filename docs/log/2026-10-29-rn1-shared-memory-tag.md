---
date: 2026-10-29
author: claude-agent
type: decision
card: RN1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/pi-extension/src/tag.ts
  - packages/runner/src/conditions.ts
  - packages/runner/test/conditions.test.ts
  - docs/decisions/0015-evaluation-protocol.md
  - fixtures/cassettes/rn1-gatemem-probe
supersedes: none
---

**What.** C2 and C3 now show a read in C5's memory-tag shape; only C5's tag carries the read id and the admitting rules, and the score left the tag in all three.

**Why.** ADR 0015 left open whether the tag is mechanism or presentation; the plan decided presentation (2610.11188), so a tag only C5 wore was a confound. C2 and C3 have no score, so keeping it in C5 alone would have been a second difference.

**Result.** A runner test asserts the three conditions' rendered reads of the same items differ only in `read_id` and `policy_id` (item ids aside); adding an attribute to C5's items fails it. The RN1 cassettes were re-recorded once; `make run` replays byte-identically.

**Consequence.** ADR 0015 and 0009 are amended; the lead confirms or reverses before any H1 or H2 run.
