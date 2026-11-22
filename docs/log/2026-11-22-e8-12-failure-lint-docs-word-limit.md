---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/log/2026-11-21-e8-12-decision-adr-0042-proposed.md
  - scripts/check-log.ts
supersedes: none
---

**What.** `make lint-docs` failed on the card's first log entry. Commit daf36d12 fixed it.

**Why.** The ADR's decision entry was written before the gate ran, and its body went over the convention's limit.

**Result.** `scripts/check-log.ts` reported "docs/log/2026-11-21-e8-12-decision-adr-0042-proposed.md: body has 156 words, at most 150 allowed" and exited 2. Shortening the Consequence line brought the body under 150 words, and `make lint-docs` passed.

**Consequence.** Run `make lint-docs` after each log entry, not only at the end.
