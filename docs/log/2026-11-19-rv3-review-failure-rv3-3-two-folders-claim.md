---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - docs/log/2026-11-19-rv3-review-decision-imported-id-folder-not-owner.md
supersedes: none
---

**What.** Review finding RV3-3 (minor): the decision entry on imported ids claimed folder-derived ids "also separate one person's two project folders".

**Why.** One log cannot hold two folders under the adapter name `files` (my own finding entry on one log and two folders), so the claim held for ids but not for any log a surface opens.

**Result.** The decision entry is superseded by one that drops the claim and states the move behaviour of RV3-1.

**Consequence.** Nothing else.
