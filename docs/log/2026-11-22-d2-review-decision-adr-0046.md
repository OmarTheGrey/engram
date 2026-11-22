---
date: 2026-11-22
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/decisions/0046-awm-prompt-adapted-to-tool-use.md
  - docs/tasks/lead-decisions.md
supersedes: docs/log/2026-11-22-d2-decision-adr-0046.md
---

**What.** ADR 0046 now lists eighteen changes, not fourteen. The four added: the request carries a seed, which upstream's call does not; upstream's `click('id')` and `select_option` lines are not appended to the reply; the recorded verdict replaces upstream's `gt` or `autoeval` success criterion; and the query is the first user message, not the task config's `intent`.

**Why.** Review finding D2-12: these four departures were made but not listed.

**Result.** Lead-decisions item 64 and PR.md say eighteen. Everything else in the superseded entry stands, the lead's answer of 2026-11-22 included.

**Consequence.** The lead accepts the full list.
