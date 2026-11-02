---
date: 2026-11-02
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - AGENTS.md
  - Makefile
  - "make test-repro"
supersedes: none
---

**What.** PR 2's branch rebased onto main after PR 3 (#25, `33cc387`) merged.

**Why.** The coordinator asked for it once round three's fixes were committed.

**Result.** Git applied all 29 commits without a conflict: AGENTS.md and CLAUDE.md stay identical with both PRs' command lines, and the Makefile keeps PR 3's `run` and this PR's `test-repro`. After it, `make test`, `make lint`, `make api-check` and `make lint-docs` pass, as do PR 3's read-reason and retrieval tests. `make test-repro` reproduces all three results with their earlier hashes, in 17 minutes: the reach and admission entry points read through the default `Plane.read`, which PR 3 left unchanged. The MANIFEST's commit column now names the rebased commits.

**Consequence.** None.
