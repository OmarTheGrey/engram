---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-03-pr4a-h1-pipeline.md
  - "make lint-docs"
supersedes: none
---

**What.** The commit that added the H1 pipeline's log entries holds one of 153 words, over the 150-word limit, so `make lint-docs` fails on it.

**Why.** The lint and the commit ran as `make lint-docs | tail -4 && git commit`: the pipe returned `tail`'s exit status, so the commit went ahead after the lint had failed. The same kind of failure as PR #25's commit `2b075e4` (its own failure entry in this PR).

**Result.** The next commit shortens the entry's Why sentence, and `make lint-docs` passes. Gates are run without a pipe before a commit from here on.

**Consequence.** Only the intermediate commit fails the lint; the branch's head passes it.
