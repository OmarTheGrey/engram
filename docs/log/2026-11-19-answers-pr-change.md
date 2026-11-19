---
date: 2026-11-19
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
  - docs/decisions/README.md
  - research/results/MANIFEST.md
  - "uv run pytest research/tests/test_prereg.py"
supersedes: none
---

**What.** The lead's answers of 2026-11-19 are written into the repository on branch `prereg-v1-answers`: the sheet, v1, the ADRs, the MANIFEST, section 7 of the v1 plan, cards R1, X2, X3, E9.5, B8 and X10, the backlog and PINS.md's candidates.

**Why.** Step 3 of section 7 of `docs/tasks/prereg-v1-plan.md`, minus the label audit's part.

**Result.** 24 answer lines accepted, item 16 changed to three members, items 1 and 20 open; v1 keeps only those two items' marks, stays untagged, and holds a marked placeholder for the audit. ADRs 0031 to 0033 and the pending amendments are accepted; `OWNER_DECIDES` is empty. HaluMem is a checked, unregistered candidate. The specification's first form had items 1, 16 and 20 accepted; the lead's later answers changed that before any of it was committed.

**Consequence.** Before the tag: items 1 and 20, the audit, and a short PR writing the audit into v1.
