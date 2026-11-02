---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
  - docs/decisions/README.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** ADR 0031 is listed in the decisions index with status `proposed` and added to `OWNER_DECIDES` in `scripts/test/tasks-and-decisions.test.ts`, the set of ADRs left for the owner to decide.

**Why.** The brief requires a drafted ADR to be `proposed` until the lead accepts it, and the index lists every ADR with its status; the test's own mechanism for an undecided ADR is that set. Writing "accepted, pending lead review" would claim an acceptance that has not happened.

**Result.** `make test` passes with every other ADR still required to be decided and cited.

**Consequence.** Accepting ADR 0031 is a status change in its file and the index, a `decision` entry, and removing 0031 from the set, in one PR.
