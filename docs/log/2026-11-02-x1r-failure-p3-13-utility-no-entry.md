---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-02-x1r-utility-checkpoints.md
supersedes: none
---

**What.** `h1-gatemem` includes the utility checkpoints, beyond H1's stopping rule, without a decision entry.

**Why.** The plan asked for GateMem's full access, forgetting and utility checkpoints, and the choice was not logged.

**Result.** The decision entry `2026-11-02-x1r-utility-checkpoints.md` records why they stay.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
