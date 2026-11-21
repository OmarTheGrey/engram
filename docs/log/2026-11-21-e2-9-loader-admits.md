---
date: 2026-11-21
author: claude-agent
type: change
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/policy/load.test.ts
supersedes: none
---

**What.** The loader's `NOT_ENFORCED_YET` table loses `secrets`, `pii` and `max_content_bytes`; its test now asserts every value of those three loads.

**Why.** Card E2.8 had the loader refuse any value but `off` until the card enforcing an option lands, and asked this card to lift its own three.

**Result.** `load.test.ts`, `load-edges.test.ts` and `presets.test.ts` pass (129 tests). `injection_screen` (E2.10) and both trust options (E2.11) are still refused.

**Consequence.** A policy may turn the guards on from YAML.
