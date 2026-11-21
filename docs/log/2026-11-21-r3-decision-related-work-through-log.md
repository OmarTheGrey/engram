---
date: 2026-11-21
author: claude-agent
type: decision
card: R3
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - research/thesis/drafts/related-work.md
  - docs/conventions/documentation.md
  - "make thesis"
  - docs/log/2026-11-21-r3-failure-make-thesis-on-main.md
supersedes: none
---

**What.** HEAMS and SAFE-Mem reach the thesis's related-work notes through `finding` log entries with `chapter: related-work`, not through a hand edit of `research/thesis/drafts/related-work.md`, and the drafts were not regenerated in this branch.

**Why.** The drafts are written by `research/scripts/consolidate_log.py`, and `related-work.md` says "Edit the entries, not this file." The committed drafts hold about sixty dated paragraphs against about 1,560 entries on main, so regenerating them here would rewrite every draft and collide with ten parallel branches.

**Result.** Ten of this card's entries have `chapter: related-work`, led by `2026-11-21-r3-finding-heams.md` and `2026-11-21-r3-finding-safe-mem.md`. The consolidator's own `validate` passes all eighteen, and its `render_chapter` puts both papers in a related-work draft rendered from them; a full `make thesis` fails on main for another reason (`docs/log/2026-11-21-r3-failure-make-thesis-on-main.md`).

**Consequence.** The next `make thesis` on main puts them in the committed draft.
