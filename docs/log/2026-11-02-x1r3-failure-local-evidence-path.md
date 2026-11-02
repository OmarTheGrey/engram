---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-02-x1r2-b3-reads.md
  - scripts/check-log.ts
  - "make lint-docs"
supersedes: none
---

**What.** CI failed `make lint-docs` and `make thesis` on PR #25 (runs 41502477591 and 41502495431): the B3 reads finding cited `.engram/runs/b3-gatemem-plane/results.jsonl` as evidence, a run output under the ignored `.engram/` directory.

**Why.** The log check requires every evidence path to exist; the file existed in this worktree, so both checks passed locally, and nothing ran them on a clean checkout.

**Result.** The finding now cites the committed cassettes, the config and the command that replays them. `make lint-docs` and `make thesis` were run again from a clean clone of the branch, where only committed files exist.

**Consequence.** Found by the third review of PR #25. Evidence names committed files or a command, never a run output.
