---
date: 2026-10-29
author: claude-agent
type: decision
card: B4
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0029-poisoning-arm-mem-inv-bench.md
  - packages/bench/src/mem-inv-bench/plane.ts
  - packages/bench/test/mem-inv-bench/plane.test.ts
supersedes: none
---

**What.** MEM-INV-Bench's origin channels map to Engram writers: user to `user`; the trusted registries erp and bank and the trusted lookup tool to `tool` (actors `agent:erp`, `agent:bank`, `agent:lookup`); the untrusted feeds web and inbox to `document` (`agent:web`, `agent:inbox`) in `team:operations`; the agent's own note to `model` in `person:operator`.

**Why.** ADR 0029 left the mapping open; ADR 0004 sets kind from the channel at write time, and the paper's assumption A1 is that origin labels are correct, so `model` for web content was rejected.

**Result.** Recorded in ADR 0029's amendments with the deployment, the constant confidence 0.9 and the empty action-time query. A test asserts the table and each event's kind and actor; changing web's kind to `tool` fails three tests.

**Consequence.** The lead reviews the mapping with ADR 0029; a `derived_from` schema PR would change tool_echo's label.
