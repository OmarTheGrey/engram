---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0044-cli-tui.md
  - docs/tasks/lead-decisions.md
supersedes: docs/log/2026-11-21-e8-15-decision-pi-tui.md
---

**What.** The TUI is built on `@earendil-works/pi-tui` 1.3.0 at the pi pin, imported only under `packages/cli/src/tui/`, and the design proceeds on it while ADR 0044 stays proposed.

**Why.** Decided on 2026-11-22 under the lead's delegation (item 62, call 1): no new package in the lockfile, the pi family's own library, an injectable terminal, Windows input handled, and a spike that passed under ConPTY and Git Bash. The exception is recorded as an amendment of AGENTS.md's "What not to do" line, which names where pi is imported; ADR 0033's accepted text, which holds no such list, is not edited, correcting the earlier entry.

**Result.** ADR 0044's context, decisions 2 and 3 and status say so; the biome rules name pi-tui as an exact path.

**Consequence.** If the lead chooses Ink when deciding the ADR, only the render layer changes.
