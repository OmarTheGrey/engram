---
date: 2026-10-25
author: claude-agent
type: milestone
card: RN1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/run.test.ts
  - packages/runner/src/model/cassette.ts
  - packages/runner/src/conditions.ts
  - research/configs/rn1-gatemem-probe.json
  - fixtures/cassettes/rn1-gatemem-probe
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/rn1-gatemem-probe.json"
supersedes: none
---

**What.** Card RN1 runs GateMem checkpoints as pi SDK sessions under C2 (tools over the store, no plane), C3 (the same tools, the preset's text in the system prompt) and C5 (the Engram extension on the Plane, preset medium).

**Why.** Every experiment needs conditions that differ only in mechanism, with every model call seeded and cached (AGENTS.md rules 6 and 7).

**Result.** The session's model is a faux provider that keys each call on its normalised transcript and answers through `cached()`. The probe makes 6 calls, then 0 on the rerun and offline. On the scripted probe the clerk's memory_read showed the viral load under C2 and C3, but not under C5. The runner tests pass, 46 in total.

**Consequence.** X1 can build on this queue. C1, C4, C6 and C7 are not built yet.
