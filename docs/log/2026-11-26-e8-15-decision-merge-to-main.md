---
date: 2026-11-26
author: claude-agent
type: decision
card: E8.15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/E8.15.md
  - docs/decisions/0044-cli-tui.md
  - docs/tasks/lead-decisions.md
  - docs/deps.md
supersedes: none
---

**What.** On 2026-11-26 the lead decided to merge branch `cliupgrade`, the terminal interface `engram tui` (E8.15a to E8.15e), into main as one pull request.

**Why.** All five parts are verified. ADR 0044 was accepted on 2026-11-25, and its rule could reach main only through this merge.

**Result.** Only card E8.15 said the TUI stays off main. Its status line now says it merges, and no longer calls ADR 0044 proposed. ADR 0044 gains a dated amendment line, with its decision text unchanged. Lead-decisions item 62 has one added sentence. The new dependencies are pi-tui 1.3.0, @xterm/headless 5.5.0 and @lydell/node-pty 1.1.0, and the typescript 5.9.3 line is widened. Each has an exact pin and a licence line in `docs/deps.md`. No code was copied or ported, so `docs/absorbed.md` and `NOTICE` need no row.

**Consequence.** pi-tui only under `packages/cli/src/tui` now holds on main.
