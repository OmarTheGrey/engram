---
date: 2026-11-28
author: claude-agent
type: failure
card: X16
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/gate_mutation_audit.py
supersedes: none
---

**What.** The exploration run ended with "tree unchanged: False": the working tree's status differed from its status at the start.

**Why.** Card X16's own edits (a commit and a register row) were made in the worktree while the exploration ran; nothing the run did touched the tree. The real script compares the status after every mutant, so it would have stopped at the first mutant after the edit.

**Result.** The guard works as meant. The committed result was produced by a run during which the worktree was left alone.

**Consequence.** Nothing may be edited in the checkout while the audit runs, `make test-repro` included; the guard stops a run that sees an edit rather than vouching for it.
