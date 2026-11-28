---
date: 2026-11-28
author: claude-agent
type: decision
card: none
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/gate-b-plan.md
  - docs/log/2026-10-29-gate-b-engineering-done.md
  - docs/log/2026-11-21-readme-finding-gate-b-undeclared.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** The roadmap's state section places the project between Gate B and Gate C, with Gate B undeclared, and reads both of Gate B's exceptions as met by pre-tag condition 4's live checks.

**Why.** Exception (a) is B1's reference numbers, which is the B1 check itself. Exception (c) is criterion 4's live half, GateMem probes through the plane on the primary model; the smoke run sends six GateMem checkpoints through the plane on M1 at preset medium (`research/configs/smoke-h1.json`). Another reader could hold that (c) needs the command the Gate B plan named, `b3-gatemem-plane.json` run live.

**Result.** The roadmap says so with its sources and leaves the declaration to the lead.

**Consequence.** If the lead disagrees, a short live run of `b3-gatemem-plane.json` on M1 closes (c); nothing else changes.
