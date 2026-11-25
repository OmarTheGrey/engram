---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0044-cli-tui.md
  - docs/tasks/lead-decisions.md
  - docs/design/tui.md
supersedes: none
---

**What.** ADR 0044 (the CLI's terminal interface on pi-tui) is accepted by the lead, item 62 (a), keeping the six calls of item 62's table.

**Why.** The lead wrote "accept the adrs" on 2026-11-25: his own answer, not one under the delegation, option (a) of each item.

**Result.** The text matches option (a): pi-tui at the pi pin, imported only under `packages/cli/src/tui/`. Its status line now says the acceptance keeps the six delegated calls. The rule is enforced only on branch `cliupgrade`, where the TUI lives (finding of the same date).

**Consequence.** `docs/design/tui.md` and card E8.15 no longer say the ADR is proposed. The TUI work continues on `cliupgrade` on an accepted ADR.
