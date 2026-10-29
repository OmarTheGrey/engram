---
date: 2026-10-29
author: claude-agent
type: finding
card: B4
chapter: limitations
pillar: plane
hypothesis: H1
evidence:
  - docs/decisions/0029-poisoning-arm-mem-inv-bench.md
  - packages/bench/test/mem-inv-bench/plane.test.ts
  - packages/runner/test/mem-inv-probe.test.ts
  - packages/core/src/policy/evaluate.ts
supersedes: none
---

**What.** On MEM-INV-Bench's channels the plane admits every entry under `medium` and does not gate the consequential action, so it cannot by itself stop the benchmark's attacks.

**Why.** H1's poisoning claim must be stated in what the plane enforces.

**Result.** Under `medium` every write of the five channel kinds is allowed (`plane.test.ts`); the B4 probe's reply is HIT under C5 as under C2. Three gaps: Engram's kinds have no untrusted-external value, so `document` feeds count as ADR 0026 confirmations (L-c); a trusted tool's echo of attacker text is `tool`, since no `derived_from` carries the input's trust (L-b); there is no action gate like TMA-NM. Under `strict` the shared entries wait for review and the read admits only the person scope.

**Consequence.** The thesis states the arm as memory admission and audit, not action authorisation; an untrusted kind and `derived_from` are candidates for the next schema PR.
