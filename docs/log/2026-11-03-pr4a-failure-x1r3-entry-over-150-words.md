---
date: 2026-11-03
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-02-x1r3-read-reason-cut.md
  - scripts/check-log.ts
  - "git show 2b075e4:docs/log/2026-11-02-x1r3-read-reason-cut.md"
supersedes: none
---

**What.** PR #25's commit `2b075e4` added `docs/log/2026-11-02-x1r3-read-reason-cut.md` with a body of 152 words, so `make lint-docs` failed on that commit; the next commit, `55ff7fd`, shortened it.

**Why.** The entry was committed with its code before the docs lint ran; nothing stops a commit that fails `make lint-docs`, only the PR gate does. The PR 3 verifier's N-2 asked for this record; the PR logged no failure for it.

**Result.** Counted as `scripts/check-log.ts` counts (the body split on white space): 152 words at `2b075e4`, within 150 at `55ff7fd` and on main (`33cc387`). Both commits are reachable only through PR #25's branch after its squash merge. This PR met the same failure (`2026-11-03-pr4a-failure-commit-past-lint-docs`).

**Consequence.** Run `make lint-docs` on its own, without a pipe, before committing a log entry.
