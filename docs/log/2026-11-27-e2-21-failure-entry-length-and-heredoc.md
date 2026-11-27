---
date: 2026-11-27
author: claude-agent
type: failure
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - make lint-docs
  - docs/log/2026-11-27-e2-21-decision-split-opt-in.md
  - docs/log/2026-11-27-e2-21-change-card-part-2-opt-in.md
supersedes: none
---

**What.** Two failures on the way to finishing part 1's review fixes.

**Why.** Logged like successes (AGENTS.md rule 14).

**Result.** `make lint-docs` refused the first drafts of two entries: "body has 162 words, at most 150 allowed", for both, then 156 and 152 after the first cuts, since the check counts words differently from `wc -w`. Both were cut until it passed. Also, the card edit was first sent as a Python script in a Bash heredoc, which broke on its quotes ("unexpected EOF while looking for matching"). The brief warns of this. The script was written with the Write tool and run with `python -I`, and it applied every replacement once.

**Consequence.** Draft entries short, and check them with `make lint-docs`, not `wc`.
