---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: related-work
pillar: research
hypothesis: H2
evidence:
  - docs/research/positioning.md
  - docs/research/preregistration.md
  - docs/decisions/0023-preregistration-in-repo.md
  - https://arxiv.org/abs/2611.20144
  - https://arxiv.org/abs/2610.22959
supersedes: docs/log/2026-11-21-r3-finding-narrowed-measured-tax.md
---

**What.** "With a measured governance tax" was narrowed to "with a pre-registered measurement of its governance tax".

**Why.** Both neighbours measure a trade-off: HEAMS's governance costs 4.80 points of helpfulness (Table 5) and permitted recall falls to 84.47 percent (Table 7); SAFE-Mem's admission costs 3.6 and 3.8 LoCoMo points against its own graph (Appendix G). Engram's tax is not measured yet; the live runs start on 2026-12-01.

**Result.** The distinguishing part is the registration: H2 at three presets against C1 and C2, H1 against instruction (C3, C4), with seeded, cached calls, H2 on three models (M2, M3 on fixed subsets), H1 on M1. It is to be tagged as `prereg-v1` before the first run (ADR 0023); only `prereg-v0` is tagged today.

**Consequence.** Once H2 reports, the claim may say "measured" with the result's path. Supersedes the first version, which said "on three models" for H1 too (review finding R3-6).
