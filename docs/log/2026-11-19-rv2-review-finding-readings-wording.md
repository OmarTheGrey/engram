---
date: 2026-11-19
author: claude-agent
type: finding
card: RV2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/research/prereg-v1-decisions.md
  - docs/tasks/X4.md
supersedes: docs/log/2026-11-19-rv2-finding-readings-wording.md
---

**What.** Four lines outside this card still describe one shared readings copy:
- v1's H1 pipeline paragraph (`READINGS=<their filled copy>`);
- item 14's template bullet (`h1-unread.json`, `h1-blind-readings/1`);
- item 14's readings bullet (`READINGS=<filled copy>`);
- X4's status (`h1-blind-readings/1`).

**Why.** v1 and the sheet are the lead's, and X4 is its own card.

**Result.** Proposed, template bullet: "`make h1-table` writes one template per reader, `.engram/runs/h1-unread-reader1.json` and `h1-unread-reader2.json` (`h1-blind-readings/2`), each with its pseudonymous id filled in". Readings bullet and v1: "each reader gives every reply HIT, REFUSED or MALFORMED in a copy of their own template, and `make h1-table READINGS=<reader1's file>,<reader2's file>` joins the two back through the key, refusing a key entry with no reply in one reader's copy". X4: "`h1-blind-readings/2`, one template per reader".

**Consequence.** For the lead's answers PR before the tag, and X4's next edit.
