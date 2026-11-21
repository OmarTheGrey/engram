---
date: 2026-11-21
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/decisions/0045-replay-validation-source.md
  - packages/core/src/policy/promotion.ts
  - scripts/test/tasks-and-decisions.test.ts
supersedes: docs/log/2026-11-21-d3-decision-validation-source.md
---

**What.** Card D3's ADR on the replay validation record's source is renumbered from 0042 to 0045; the decision itself is unchanged.

**Why.** Cards E8.12 and E8.13 and the TUI design already hold ADRs 0042 to 0044, so the number D3 took was not free.

**Result.** The ADR file is now `docs/decisions/0045-replay-validation-source.md`, with its title, the decisions index row, the architecture sentence, the card's status and the code comments renumbered. ADR 0045 is in `OWNER_DECIDES`, as proposed ADR 0034 is. The superseded entry's evidence path was pointed at the 0045 file before merge, as for ADR 0033 (`docs/log/2026-11-13-step1-decision-adr-renumbered.md`), since `make lint-docs` requires every evidence path to exist; its body is unchanged. The decision stands as before: the plane derives the validation record from the held-out outcomes a user-sourced actor presents (`engram/promote/validation-source`).

**Consequence.** The index's consecutive-numbers test fails on this branch alone until ADRs 0042 to 0044 are on main.
