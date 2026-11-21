---
date: 2026-11-21
author: claude-agent
type: decision
card: R4
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/scripts/crosswalk.py
  - research/tests/test_crosswalk.py
  - packages/core/test/db/backends.ts
supersedes: docs/log/2026-11-21-r4-decision-nesting-by-indentation.md
---

**What.** Nesting is read from brackets, not indentation; a test inside any block that is not a describe call or the function body passed to one is enclosed, and counts only when its config entry names the block and why it runs (`enclosed`).

**Why.** The review showed `if (false) { it(...) }` and an uncalled helper counted as evidence. Whether code around a test runs it cannot be decided by text, so the script refuses by default and a person states the reason. Skip-like markers (`.skip`, `.todo`, `.fails`, `.skipIf`, `.runIf`, options, a context skip) are never overridden.

**Result.** Six named tests are enclosed by `forEachBackend`, which runs its block once per backend in a describe whose SQLite case has no skip condition; their entries say so.

**Consequence.** A wrapper of this kind added around a named test fails the crosswalk until its row says why the test runs.
