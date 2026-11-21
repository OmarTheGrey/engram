---
date: 2026-11-21
author: claude-agent
type: change
card: E1.5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - specs/commit.qnt
  - specs/README.md
supersedes: none
---

**What.** specs/commit.qnt models the commit and erasure protocol of card E2.6: three handles over one log and one store, gated writes deciding at the head and appending conditionally, the stale writer's settle with its withdrawal, offboarding's mark, erasure, sweep, put-back, report and stop, adoption, writes after erasure, and outside edits.

**Why.** Tests sample interleavings; a model checked over many more of them is stronger evidence for the thesis's hardest guarantee, that no writer on another handle undoes an erasure.

**Result.** Four safety properties (noStaleAppend, erasureHolds, noWriteWhileErasing, adoptionNeverRaisesTrust) and ten witnesses. Each transition names the function and file it models. Seven scenario tests pass (`quint test`, six on good, one on broken).

**Consequence.** A later change to plane/commit.ts, offboard.ts or adopt.ts should update the matching transition.
