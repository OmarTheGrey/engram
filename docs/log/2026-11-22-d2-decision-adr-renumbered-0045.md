---
date: 2026-11-22
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/decisions/0045-awm-prompt-adapted-to-tool-use.md
  - docs/decisions/README.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: docs/log/2026-11-22-d2-review-decision-adr-0046.md
---

**What.** Card D2's ADR is renumbered from 0046 to 0045. It is the same text, retitled, at `docs/decisions/0045-awm-prompt-adapted-to-tool-use.md`. Card D3's ADR takes 0046.

**Why.** D2 merges before D3, since D3 is built on this branch, and the index on main must stay consecutive. Main holds 0042 to 0044.

**Result.** Every reference now names 0045: the index row, `OWNER_DECIDES`, lead-decisions item 64 (still item 64), ADR 0012's note, the litreview correction, `docs/absorbed.md`, NOTICE and `induce.ts`. Earlier entries' evidence paths point at the new file, as was done for ADR 0033's renumbering. Their text still says 0046 and is not edited. The merge-order finding's dependency is now on 0042 to 0044.

**Consequence.** None.
