---
date: 2026-11-06
author: claude-agent
type: failure
card: PX2
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/retention.test.ts
  - fixtures/sessions/e2-4-eviction.expected.json
supersedes: none
---

**What.** The first replay design loaded the bundled preset a session's policy id named, and the E2.4 session failed to replay: three events differed.

**Why.** That session ran a one-slot variant of medium (a semantic budget of 1) under the id `preset.medium`; the bundled medium allows 2000, so the eviction and the retired-content denial after it were not made again.

**Result.** A policy id and version do not pin a policy's rules. The session now records the whole policy once (`engram.policy`), and the replay uses it.

**Consequence.** Anything that names a policy by id alone (event `policy_id`s, run labels) identifies a rule, not its numbers; comparisons across runs need the policy itself.
