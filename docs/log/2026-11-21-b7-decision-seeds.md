---
date: 2026-11-21
author: claude-agent
type: decision
card: B7
chapter: design
pillar: research
hypothesis: H2
evidence:
  - research/configs/b7-merit-fixture.json
supersedes: none
---

**What.** MERIT's world seeds (`world_seeds`, run_pilot's `--seeds`, 0 to n-1) are separate from the model seed (`seeds`, in the key, ADR 0017).

**Why.** MERIT's seeds generate worlds and arcs; the pre-registration's seeds 1 to 3 are the model's.

**Result.** The slice runs world seed 0 and model seed 1.

**Consequence.** Card X7 decides how H2's 50 MERIT tasks map onto both.
