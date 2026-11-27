---
date: 2026-11-27
author: claude-agent
type: change
card: RD1
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/view/src/view.ts
  - packages/cli/src/tui/screens/grants.ts
  - packages/cli/src/tui/screens/rich.ts
  - packages/ui/test/view.test.ts
  - packages/ui/test/twin.test.ts
supersedes: docs/log/2026-11-25-rd1-finding-tui-must-follow.md
---

**What.** The inspector and the TUI show an item's grants as core's answer gave them, and label them every grant only when core's rule gave them all (review finding 5).

**Why.** `shownGrants` filtered by owner id alone, while core also requires that the owner may read the scope. An owner reading its item through a grant was given only its own grants, yet told every grant was shown. The TUI shares it since main moved it to `@engram/view`.

**Result.** `shownGrants(item, viewerId, complete)` filters nothing (AGENTS.md rule 1). `complete` comes from core's answer: a read whose explanation names no grant (core admits by scope first), or another answer core returned to its caller whole. The new lanes test fails when `complete` is always true. The UI and TUI grant tests pass (ui 39, cli 160).

**Consequence.** The TUI follows core with this change; the 2026-11-25 finding said none was needed.
