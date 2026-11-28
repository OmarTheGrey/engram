---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.8
chapter: discussion
pillar: research
hypothesis: none
evidence:
  - specs/commit.qnt
  - packages/core/src/plane/commit.ts
  - packages/core/test/model/trace-replay.test.ts
supersedes: none
---

**What.** E18-F3: the model's own-bytes test compares content only; the code's (`ownBytes`, `recovery`) compares every field but provenance and grants.

**Why.** Found by the replay in a sampled batch (seed 11) and pinned by `e18OwnBytesEditedTest`, which diverges at step 7.

**Result.** A writer's bytes adopted with a hand-edited confidence are its own in the model, which commits, and a change in the code, which settles and refuses. The code is the stricter side.

**Consequence.** For card E1.7: compare the record, not the content, in `touchedSince`'s `ign` and in `settleRead`'s `owns`.
