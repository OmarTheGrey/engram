---
date: 2026-11-21
author: claude-agent
type: failure
card: R3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/consolidate_log.py
  - docs/log/2026-11-20-rv8-measurement-frontier-axes.md
  - docs/log/2026-11-21-rv8-review-measurement-cost-table-reasoning-off.md
  - "uv run python research/scripts/consolidate_log.py --root . --out <scratch folder>"
supersedes: none
---

**What.** Consolidating the log into a scratch folder, to check that this card's entries reach the related-work draft, failed and wrote no draft.

**Why.** The consolidator stops on any invalid entry, and eight entries already on main fail its rule that a measurement names a config under `research/configs/`: one RV6 and five RV8 measurement entries of 2026-11-20 and two RV8 review entries of 2026-11-21, such as `2026-11-20-rv8-measurement-frontier-axes.md`. None of the problems it reported is in an R3 entry.

**Result.** Exit 1, eight problems. The check was done instead with the consolidator's own functions: `validate` passes all eighteen R3 entries, and `render_chapter` renders HEAMS and SAFE-Mem into a related-work draft built from them. So `make thesis` fails on main today, independent of this card.

**Consequence.** The lead or the RV6 and RV8 owners fix those eight entries' evidence before the next `make thesis`; this card does not touch them.
