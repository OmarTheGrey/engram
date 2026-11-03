---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-03-pr4a-failure-commit-past-lint-docs.md
  - "make lint-docs"
supersedes: none
---

**What.** In the review fix pass, the commit that added the cost entries (message "wip: cost review entries before mutation checks") holds five entries over 150 words, so `make lint-docs` fails on it.

**Why.** The entries were committed in a hurry so the mutation checks could run on committed work, and the docs lint was skipped, against the rule this PR's earlier failure entry set ("run `make lint-docs` on its own before committing a log entry").

**Result.** The next commit shortens the five entries and adds this one; `make lint-docs` passes on it. Two commits on this branch now fail the docs lint on their own; the branch's head does not.

**Consequence.** Committing work before a mutation check does not excuse skipping the docs lint: lint, then commit, then mutate.
