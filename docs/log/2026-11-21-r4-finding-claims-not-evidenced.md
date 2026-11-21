---
date: 2026-11-21
author: claude-agent
type: finding
card: R4
chapter: limitations
pillar: govern
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Four of the fifty governance claims have no test: C30, a retired item can be reinstated by event (ADR 0010, ADR 0025 decision 6); C44, packages/core reads no clock and draws no randomness; C48, active procedures retire on drift and a human rejection narrows the trigger (ADR 0011); C50, Gate D's dogfood with zero recorded violations.

**Why.** The crosswalk never lends an unproven claim a nearby test.

**Result.** C30 and C44 are backlog rows (`docs/tasks/backlog.md`, "Follow-ups from card R4"), since a test can be written for each. C48 waits on card D3 and the smoothed success rate's schema change; C50 on the dogfood's start. Several evidenced rows carry limits instead, such as no tamper evidence (C03) and self-asserted identity (C18, C25, C45).

**Consequence.** The thesis states these four claims as design intent, not as evidenced properties, until each has a test.
