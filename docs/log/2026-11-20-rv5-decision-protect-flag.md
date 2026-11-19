---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook.ts
  - docs/decisions/0022-other-harnesses-through-mcp.md
supersedes: none
---

**What.** The hook learns the server's log from a `--protect` flag, not from the server's `/health`.

**Why.** The review offered both. `/health` would tell any loopback caller, a browser page among them, where the log lives on disk, and the hook would depend on the server answering to know what to guard; a flag is checked before any call and holds when the server is down.

**Result.** One repeatable flag; the dogfood's members use the default log, which the hook already guards, so none of them needs it.

**Consequence.** A member serving another log must pass the path twice, to `serve --db` and to the hook. Cost if wrong: a forgotten flag leaves that log unguarded, as before this card.
