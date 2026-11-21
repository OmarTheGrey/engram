---
date: 2026-11-21
author: claude-orchestrator
type: change
card: E2.9
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h1-secret-guard.json
  - docs/tasks/L2.md
  - docs/tasks/L3.md
  - docs/tasks/L4.md
supersedes: none
---

**What.** The MANIFEST row of `research/results/h1-secret-guard.json` now names its squash commit on main, `322b2ab1` (PR #88), and the status lines of cards L2, L3 and L4 name their merged PRs instead of "awaiting review".

**Why.** A squash merge rewrites commits, so the branch commit `97afa30` is not in main's history and the MANIFEST ancestry test fails until the cell names a commit on main. The three status lines were stale since 2026-11-19 (backlog row "Stale status lines").

**Result.** The MANIFEST row's other cells are unchanged; L2 is #46, L3 is #45 (its live pilot still waits for a key), L4 is #49.

**Consequence.** Main's research tests pass again; the backlog row on stale status lines covers L2 to L4.
