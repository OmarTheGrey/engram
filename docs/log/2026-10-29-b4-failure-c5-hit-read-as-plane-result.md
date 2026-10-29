---
date: 2026-10-29
author: claude-agent
type: failure
card: B4
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/mem-inv-probe.test.ts
  - docs/log/2026-10-29-b4-plane-gates-memory-not-action.md
supersedes: none
---

**What.** The first B4 write-up cited the probe's HIT under C5 as evidence that the plane does not stop the attack.

**Why.** With a scripted model the reply is fixed per case: it does not depend on what the plane admitted, so the verdict cannot reflect the plane.

**Result.** Review R6-1 showed it: with web's kind set to `model` the plane denied the poison and a recording run still printed C5 HIT. The finding now rests on the write decisions and on the C5 cassette carrying the poison inside the read's memory tag, which a test asserts.

**Consequence.** Pipeline configs with scripted models report plane decisions and what reached the model, never verdicts, as evidence about the plane.
