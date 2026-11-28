---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.21
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/E2.21.md
  - research/results/MANIFEST.md
  - docs/log/2026-11-28-e2-21-measurement-mutation-audit.md
supersedes: none
---

**What.** The card's part 2 acceptance gains a dated note: the unregistered gate mutation audit row may move in its counterexample texts only, with every verdict unchanged and a measurement entry recording it.

**Why.** The review of the branch (finding 1) found the acceptance's "no sha256 changed" not literally met: invariant 2's new draw changes the first counterexample fast-check finds for four I2 mutants, so `h1-gate-mutation-audit.json` moves. The orchestrator decided to amend the line rather than drop the draw.

**Result.** The note is in `docs/tasks/E2.21.md`. Every registered row keeps its sha256; the audit row is rerun once more on the tree merged with E1.9, which also rewrites it.

**Consequence.** The final `make test-repro` on main checks the regenerated audit row against its new hash.
