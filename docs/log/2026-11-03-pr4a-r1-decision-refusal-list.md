---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_refusal_leaks.py
  - packages/runner/src/research/refusal-leaks.ts
  - research/results/h1-gatemem-reach.json
supersedes: none
---

**What.** The refusal-leak checkpoint ids are a new small rule-9 result, `research/results/h1-refusal-leaks.json`, not a new field of PR 2's reach result.

**Why.** Adding ids to `h1-gatemem-reach.json` would change PR 2's hash, rerun its plane walk for every checkpoint, and supersede its measurement for no new number; the list needs only GateMem's scorer.

**Result.** The scoring is the reach's own: `refusalLeaks` was moved out of `scoreReach` into an exported function both use, so the two cannot drift, and a test holds the new rows' counts equal to `reachRows`' on the fixture. The new script reads the refusals from the reach config and fails unless its counts equal the reach result's (29 and 12), whose sha256 it records. The reach hash is unchanged (`make test-repro`).

**Consequence.** If the reach config's refusals change, both results are regenerated together.
