---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_gatemem_reach.py
  - docs/log/2026-11-02-pr2-r2-failure-claim-bracket.md
supersedes: none
---

**What.** Review finding R2-6: the reach script's docstring still said the shares with every and with any pattern in reach bracket the share whose secret is in reach.

**Why.** Round two withdrew that claim in the log and in a later paragraph of the same docstring, which says neither share brackets it; the earlier paragraph was not updated, so the docstring contradicted itself.

**Result.** The paragraph now says neither share is, or bounds, the share whose secret is in reach, and points to the audit sample. The script's output is unchanged; its MANIFEST hash does not move.

**Consequence.** None.
