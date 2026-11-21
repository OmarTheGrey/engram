---
date: 2026-11-21
author: claude-agent
type: decision
card: B7
chapter: design
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/launch.ts
  - packages/bench/PINS.md
supersedes: none
---

**What.** One proxy per run cell, its harness, item, condition, preset, store and seed fixed at start; the item is `<domain>-<difficulty>` (keyed `merit/d1-easy`), with arcs and episodes fixed by the config.

**Why.** MERIT's runner sends no headers and no seed, so `x-engram-*` headers would need a patch; the prompt hash still separates every call.

**Result.** 175 keys, no collision: 175 cassette files for 175 calls.

**Consequence.** Cost per arc or task comes from MERIT's rows, not the ledger. A per-task item needs a header MERIT does not send.
