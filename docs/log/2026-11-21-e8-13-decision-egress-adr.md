---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0043-decision-export-egress.md
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** ADR 0043, proposed: decisions may leave the machine as spans, opt-in, carrying no memory content; item 61 of the decision sheet, option (a) recommended.

**Why.** Card E8.13, step 4, asks for an ADR on egress: what leaves, that it is opt-in, and how rule 12 is kept.

**Result.** The ADR lists what a span carries (decision, rule, actor, scopes, ids, counts, usage, a filtered reason) and what never leaves (content, provenance ref and hash, store key, grant principals, query, returned ids), with no content mode. It is in `OWNER_DECIDES` of `scripts/test/tasks-and-decisions.test.ts`. Number 0042 is card E8.12's on its branch, so this takes 0043, and item 61 after E8.12's item 60.

**Consequence.** If E8.12 merges with another number, this ADR and item are renumbered at the merge.
