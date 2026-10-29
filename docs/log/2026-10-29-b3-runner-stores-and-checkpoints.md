---
date: 2026-10-29
author: claude-agent
type: decision
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/config.ts
  - packages/runner/src/stores.ts
  - research/configs/b3-gatemem-plane.json
supersedes: none
---

**What.** Three choices the plan left open: a config's `store` takes one store or a list, with summary keys `<condition>@<store>` when there are several; each results row carries the plane's log without the items (whose store_ref names the store); and the three checkpoints come from the one vendored office episode (`ckpt_08` utility, `ckpt_11` access control, `ckpt_20` forgetting).

**Why.** A list kept RN1's config valid unchanged. One episode lets a reader compare the three probes over the same principals: a Moonstone contractor, a Monsoon product manager and a Monsoon security engineer.

**Result.** RN1's summary keys are unchanged; B3's are `C5@fake` and `C5@mem0`.

**Consequence.** PR 6's MEM-INV-Bench runner can reuse the store list; the Letta store is one entry in `stores.ts`.
