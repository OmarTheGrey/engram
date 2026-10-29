---
date: 2026-10-25
author: claude-agent
type: failure
card: PX1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/plane.test.ts
  - "pnpm --filter pi-extension test"
supersedes: none
---

**What.** While mutation-checking the PX1 acceptance test, the restore step used `git checkout` on an uncommitted file, which put back the S0.5 extension and discarded the new one; a copy taken before the mutation restored it. The first `make lint` also failed on two type casts.

**Why.** A mutation check must restore the file it broke, and the committed version is not the working one.

**Result.** Removing the session mirror of write events failed 2 of 13 acceptance tests, as intended. The casts were fixed with explicit `unknown` conversions; lint then passed.

**Consequence.** Mutation checks restore from a copy, never from git, while work is uncommitted.
