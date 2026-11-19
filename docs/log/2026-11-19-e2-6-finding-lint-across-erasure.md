---
date: 2026-11-19
author: claude-agent
type: finding
card: E2.6
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** `Plane.lint` decides on a snapshot, awaits the model lints, then appends its findings, so a finding about an item an offboarding on another handle erases in between lands after the erasure's redaction.

**Why.** Lint is not a store write, so it is outside card E2.6's operations, though its evidence is what ADR 0010's lint redaction removes.

**Result.** Not reproduced as a test; read from the code.

**Consequence.** A backlog row: checking the log's head under the lock before appending findings, as plane/commit.ts does, would close it.
