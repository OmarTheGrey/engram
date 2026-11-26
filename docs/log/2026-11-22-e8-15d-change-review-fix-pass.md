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
  - packages/cli/src/tui/screens/serve.ts
  - packages/cli/src/tui/screens/setup.ts
  - packages/cli/src/tui/overlays.ts
  - packages/cli/src/tui/app.ts
  - packages/cli/test/tui/flows-surfaces.test.ts
  - packages/cli/test/tui/parity-surfaces.test.ts
supersedes: none
---

**What.** The fix pass of E8.15d's review: eight important findings, five minor and the UX items.

**Why.** The review of 82d5a6b8 to 13e1c848.

**Result.** Try it counts a call blocked only on a deny, and an exit 1 is a failed hook; `q` quits after pi-tui has finished with the key, which ended an EPIPE that lost the summary; servers live in session state, so a reopened Serve attaches and stops one; snippets name a server from `ENGRAM_SERVER_URL` and say the token is set apart; Try it's children stop on quit; the typed confirmation takes enter once the id is right; parity of this part's commands moved to `parity-surfaces.test.ts`, through the router, with five commands against a server. Smaller: Doctor focuses Run, Host is a choice, MCP acts as `agent:claude-code`. Each fix's test came first.

**Consequence.** The coordinator merges with E8.15c.
