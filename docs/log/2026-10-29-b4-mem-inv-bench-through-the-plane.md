---
date: 2026-10-29
author: claude-agent
type: change
card: B4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/src/mem-inv-bench/plane.ts
  - packages/runner/src/mem-inv-probe.ts
  - research/configs/b4-mem-inv-probe.json
  - fixtures/cassettes/b4-mem-inv-probe
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b4-mem-inv-probe.json"
  - "pnpm --filter bench test"
supersedes: none
---

**What.** Card B4 runs MEM-INV-Bench through the plane: 24 vendored cases, each memory entry written through `Plane.write` by its channel's actor and kind, the action-time read through `Plane.read`, the rule bucketer ported, and one attack (mib-13, Acme Corp, direct) as a pi SDK session under C5 and C2.

**Why.** ADR 0029 makes MEM-INV-Bench the poisoning arm.

**Result.** `make run` on the B4 config replays 4 calls from cassettes with 0 new, twice, byte-identical results; under C5 the poisoned web entry is allowed by `preset.medium/write/team` and the read by `preset.medium/read/person`, and the poison reaches the model in the read's memory tag; the HIT in both conditions is the scripted reply, not a plane result. The scorer matches upstream's on 24 cases and 42 of 44 crafted replies (two raise upstream) (`fixtures/bench/mem-inv-bench/upstream-golden.json`).

**Consequence.** The arm runs once the pre-registration registers it; the Gate B record can cite this config.
