---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/E9.4.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** Verification finding V-8 of PR #44: the documents lagged the code.

**Why.** The PR body still said the invariants' oracles were unchanged and did not mark the decision that left `Plane.write` open as superseded; the card's status named the worktree branch, not `e9-4-twin-screens` and PR #44.

**Result.** The PR body, the card's status line and ADR 0034's list of invariants changes are corrected.

**Consequence.** None.
