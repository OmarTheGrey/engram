---
date: 2026-10-29
author: claude-agent
type: decision
card: RN1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/conditions.ts
  - packages/runner/test/conditions.test.ts
  - docs/decisions/0015-evaluation-protocol.md
  - fixtures/cassettes/rn1-gatemem-probe
supersedes: none
---

**What.** C3's system prompt now carries the loaded policy, the object C5 enforces, as JSON with sorted keys, instead of the preset's YAML file with its comments.

**Why.** PR 4 found that rewording a preset comment changed C3's prompt and therefore its cassette keys: a comment is not policy, and C3 should differ from C2 only by the policy's content.

**Result.** New tests (failing first) assert that a preset differing only in comments, or only in key order, gives a byte-identical C3 prompt, and that a content change does not; dropping the key sort fails the key-order test. The RN1 cassettes were re-recorded once with the tag change.

**Consequence.** Branch pr-e2-4-retention re-recorded cassettes for comment edits; after both merge, one more `make fixtures` settles them.
