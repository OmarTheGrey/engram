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

**What.** MEM-INV-Bench's channels map to Engram writers: user to `user`; erp and bank to `tool` (`agent:erp`, `agent:bank`); web and inbox to `document` (`agent:web`, `agent:inbox`) in `team:operations`; the lookup tool as `agent:lookup` and the agent's note as `person:operator`, each with the least trusted kind of its channel and its inputs.

**Why.** ADR 0029 left the mapping open; ADR 0004 sets kind from the channel and makes a derived item inherit its least trusted input, and the paper's assumption A1 rules out labelling web content `model`.

**Result.** In ADR 0026's order the echo of a web document stays `tool` and the self-summary `model`; a tool fed model content becomes `model` and the team scope refuses it. Tests assert the table, the inheritance and each event's kind; changing web's kind fails three tests.

**Consequence.** The lead reviews the mapping and the trust order's effect on L-b with ADR 0029.
