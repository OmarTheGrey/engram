---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/snippets.ts
  - packages/cli/test/tui/snippets.test.ts
  - "make test-one T=packages/cli/test/tui/snippets.test.ts"
supersedes: docs/log/2026-11-22-e8-15d-change-snippets.md
---

**What.** `snippets.ts` after the review: the hook entry sets `"onFailure": "block"`; Try it counts a sample blocked only when the hook printed `permissionDecision` `deny` on exit 0; an exit other than 0, 2 or 127 is "the hook failed (exit N)"; a snippet names a server that came from `ENGRAM_SERVER_URL`; Try it's children are stopped when the TUI quits.

**Why.** Review findings E8.15d-1, -4 and -11, and the hooks reference: `allow` skips Claude Code's own prompt and `ask` and `defer` hand the decision on, so neither blocks; the earlier entry said any decision did.

**Result.** 22 tests pass: fake hooks printing allow, ask and defer each fail, one exiting 1 fails, the decision export's removal is listed, and a child is stopped by what the screen registers on quit. The entry equals the fixture's with that one field added.

**Consequence.** Nothing further.
