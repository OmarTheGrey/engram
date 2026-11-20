---
date: 2026-11-20
author: claude-orchestrator
type: change
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/dogfood.md
supersedes: none
---

**What.** `docs/dogfood.md` now carries the two follow-ups from the verification of RV5's fix pass, F1 and F2. A `--test-clock` write at a future time pins every later read to that time permanently. Inside pi, `ls ~`, `cd ~` and `find ~` are refused and counted as `bypass_blocked`.

**Why.** The verifier reproduced both. Neither is a hole the report misses, but each would mislead a member reading their own counts.

**Result.** Docs only. The third follow-up, F3 (MCP expiry runs only when a request arrives), stays as stated in the PR.

**Consequence.** Flagging a log whose head is ahead of the report's run time is a backlog candidate, not done here.
