---
date: 2026-11-02
author: claude-orchestrator
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/prereg-v1-plan.md
  - docs/log/2026-11-02-pr2-r3-change-rebase-onto-pr3.md
  - research/results/MANIFEST.md
supersedes: none
---

**What.** PR 3 (#25) merged first, as `33cc387`, after its third verification round found it ready; PR 2 (#26) rebased onto it.

**Why.** The plan runs PRs 2 and 3 in parallel and names no order. PR 3 changed core's read path (the opt-in retrieval pipeline, the read limit's cut count) and shared files (AGENTS.md, the Makefile), so the PR whose verification closed first merged and the other rebased onto it, keeping each merged head close to what its verifier saw.

**Result.** The rebase applied PR 2's 29 commits without a conflict, and `make test-repro` reproduced the reach and admission results with their earlier hashes: both read through the default `Plane.read`, which PR 3 left unchanged.

**Consequence.** PR 2's final verification ran on the rebased head.
