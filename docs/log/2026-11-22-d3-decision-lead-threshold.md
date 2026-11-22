---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/validate.ts
  - research/configs/d3-validate-fixture.json
  - packages/core/test/unit/plane/promote-replay.test.ts
supersedes: docs/log/2026-11-21-d3-decision-threshold.md
---

**What.** The lead answered review finding D3-2 on 2026-11-22: "Fixed at 2/3". Core holds it as `REPLAY_THRESHOLD`, a replay naming another threshold is an `InvalidCallError`, and the config's `threshold` field is gone.

**Why.** The finding: a free threshold let a caller choose what passing means.

**Result.** An invalid call, not a deny event: the value is core's own constant, so a replay naming another contradicts the plane rather than a policy, like a reward outside 0 to 1 (`replayProblem`). The plane test asserts the throw and an unchanged log.

**Consequence.** If the lead wants such calls audited, a rule id is added and the refusal becomes an event.
