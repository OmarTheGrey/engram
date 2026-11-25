---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: distill
hypothesis: none
evidence:
  - docs/decisions/0045-awm-prompt-adapted-to-tool-use.md
  - docs/decisions/0012-induction-awm-over-pi-sessions.md
  - docs/tasks/lead-decisions.md
  - packages/core/src/distill/induce.ts
  - packages/core/test/unit/distill/induce.test.ts
supersedes: none
---

**What.** ADR 0045 (the AWM induction prompt adapted to tool use) is accepted by the lead, item 64 (a), as written.

**Why.** The lead wrote "accept the adrs" on 2026-11-25: his own answer, not one under the delegation, option (a) of each item.

**Result.** The text matches option (a): the adapted prompt is pinned as `AWM_INSTRUCTION` and `AWM_ONE_SHOT` in `packages/core/src/distill/induce.ts`, with its eighteen changes listed, and ADR 0012's verbatim clause is superseded. The assembly is tested by "is AWM's assembly: instruction, one-shot, the examples between its two headers" in `packages/core/test/unit/distill/induce.test.ts`.

**Consequence.** ADR 0012's status line, its index row, the `docs/absorbed.md` row and the AWM reading note now say the supersession is accepted.
