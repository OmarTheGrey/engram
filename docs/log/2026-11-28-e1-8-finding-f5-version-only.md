---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.8
chapter: discussion
pillar: research
hypothesis: none
evidence:
  - specs/replay.qnt
  - packages/core/test/model/trace-replay.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** E18-F5: a settle writes a withdrawal's put-back at a version above the projection's before it commits, and an adoption in between records that record as a change.

**Why.** Found in a sampled batch (seed 12, trace 210 of 800), pinned by `e18VersionOnlyTest` at step 43.

**Result.** The model has no versions and holds the record unchanged; the code appends an adoption that moves only the version, which sends the settle round again.

**Consequence.** For card E1.7: model versions, or have adoption ignore a version-only change.
