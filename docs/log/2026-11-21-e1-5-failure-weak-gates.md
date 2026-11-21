---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.5
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - Makefile
  - specs/commit.qnt
supersedes: none
---

**What.** Review findings E1.5-3 to E1.5-5: the broken gates refuted only `noStaleAppend`, which restates the removed check; `noWriteWhileErasing` used the guard's own `openMarks`; and the simulation gate could pass on a stale counterexample file.

**Why.** A gate that refutes a restatement of the removed line shows only that the line was removed; a property computed with the guard's function cannot catch a bug in that function; and an old ITF file satisfied the status check after a crash.

**Result.** With a wrapper that crashes the broken simulation and a stale trace file in place, `make verify-spec` exits 2 (`the broken run on erasureHolds failed without a counterexample`); with one that crashes Apalache on the broken model and a stale counterexample text in place, it exits 2 too. The mark-closing mutant now fails noWriteWhileErasing.

**Consequence.** Each gate now fails when its check is broken, and each was shown to fail.
