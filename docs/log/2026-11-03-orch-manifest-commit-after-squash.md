---
date: 2026-11-03
author: claude-orchestrator
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - docs/conventions/documentation.md
supersedes: none
---

**What.** A row's commit in `research/results/MANIFEST.md` names the commit on main that holds the code which produced the result; after a squash merge that is the merge commit, and the rows are rewritten to it.

**Why.** PRs merge by squash. PR 2's rows named commits of its branch (`fce3b10`, `2c244c7`, `7883ed4`), which the squash leaves off main, reachable only through GitHub's pull request ref. `make test-repro` does not read the column, so nothing failed; a reader checking out the named commit would.

**Result.** PR 2's reach and H4 power rows now name its squash commit, `b688cb0`. Its admission row was regenerated in PR 4 on all 38 cases, so it names a PR 4 commit, as PR 4's new rows do, until PR 4's squash commit replaces them.

**Consequence.** Every results PR rewrites its rows' commit after its squash merge, in the next PR.
