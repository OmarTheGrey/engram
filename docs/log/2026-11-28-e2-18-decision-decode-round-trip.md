---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.18
chapter: design
pillar: plane
hypothesis: none
evidence:
  - tools/symcc/properties.ts
  - scripts/test/symcc-properties.test.ts
supersedes: none
---

**What.** A counterexample counts as reproduced only when its decoding into Engram encodes back to the solver's request.

**Why.** The solver names entities with opaque strings and may keep two org scopes apart, which Engram's single `org` merges; a decode that changes the request would replay another request.

**Result.** The decoder renames scopes by level and actors by order of sight, rebuilds grants from the flattened flags, keys the retired map by the content hash, and compares what decides (levels, memberships, attributes, context) after encoding the decoded request. Two org scopes, an invalid MemoryItem or any difference mark the decode unfaithful, and an unfaithful decode is never reported as reproduced; tests cover each.

**Consequence.** If wrong, a real counterexample could be reported as unfaithful; the result then says so, with the Cedar form beside it.
