---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/test/offline-guard.ts
  - scripts/test/offline-guard.test.ts
supersedes: none
---

**What.** A socket connection given its own `lookup` function is refused outright, rather than wrapped so that its answer is checked against the loopback.

**Why.** The coordinator asked for a refusal, and no test or library the suite loads passes one: every project passed with it refused. A wrapped lookup would need the guard to rebuild Node's address selection to know where the socket ends up.

**Result.** `net.connect({ host: "localhost", port, lookup })` throws, recorded as `socket connect localhost:80 with its own lookup`.

**Consequence.** If a future test needs a custom lookup to the loopback, the guard can wrap it then.
