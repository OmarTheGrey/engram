---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** For I-5, the kinds of the items this adoption retires because the store no longer lists them are gathered before the listing loop, keyed by merging content hash, and lower only records new to the plane.

**Why.** A record under a held id already takes the plane's kind of that id. Gathering first is needed because the retirement of unlisted items runs after the loop. Merging hashes match the erased refusal's notion of the same content.

**Result.** P4: the re-filed record is `model`, and the grant on it is refused.

**Consequence.** An unlisted item left deferred (changed on another handle) still lowers the new record's kind, the safe direction.
