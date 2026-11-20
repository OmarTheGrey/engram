---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
supersedes: none
---

**What.** The first in-flight counter for stdio wrapped the transport's `onmessage` after `server.connect`, and missed every request.

**Why.** `connect` starts reading, and input already waiting is read before `connect` returns, through the handler `connect` installed; the wrapper saw no request and the replies drove the counter to -1, so the server closed at once.

**Result.** The counter is now a property accessor installed before `connect`, so it wraps whatever handler `connect` sets; the RV-SRF-7 test passes.

**Consequence.** None beyond the fix.
