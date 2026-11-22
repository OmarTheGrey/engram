---
date: 2026-11-21
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - research/configs/d3-validate-fixture.json
  - packages/core/src/distill/validate.ts
supersedes: none
---

**What.** The per-task threshold comes from the replay config (`threshold`, 1 in the fixture), not the policy.

**Why.** The card says k, n and the threshold come from the policy's promotion rule, but the schema's rule holds only replay_k and replay_n, only card E2.8 changes `schema.ts`, and a new preset key would change C3's rendered policy and so every registered C3 cache key.

**Result.** k and n come from the policy (`validationMeets`); the threshold is stated by the caller and carried in the record and the event's reason.

**Consequence.** A later schema card may move the threshold into the policy; if wrong, a run could be judged at a threshold the policy author never set, which the reason makes visible.
