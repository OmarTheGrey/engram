---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/write.ts
  - packages/cli/src/tui/workspace.ts
supersedes: none
---

**What.** "A server with credentials" is a server named with `ENGRAM_TOKEN` set: there the reviewer handoff is not offered and the screen says why; the handoff's Acting as and Member of are session values the workspace never saves, tui.json keeping what they replaced.

**Why.** 8.8 names the case but not its test; the TUI cannot see a server's key file, and with a token the server takes the identity from it (E8.12).

**Result.** A flow test covers both a server with a token (not offered) and one without (offered), and that tui.json keeps the previous memberships. Mutations: offering it always, and saving the session value, each fail one test.

**Consequence.** A server that needs a credential but has no token set offers the handoff, and the call is refused 401, as any call there.
