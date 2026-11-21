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
  - https://arxiv.org/abs/2611.20144
  - https://arxiv.org/abs/2610.22959
supersedes: none
---

**What.** "With a measured governance tax" was narrowed to "with a pre-registered measurement of its governance tax".

**Why.** Both neighbours measure a governance trade-off: HEAMS's recall governance costs 4.80 points of helpfulness (Table 5) and its retention governance drops permitted recall from 100.00 to 84.47 percent (Table 7); SAFE-Mem's admission costs 3.6 and 3.8 LoCoMo points against its own graph without it (Appendix G). Engram's tax is not measured yet: H1 and H2 are registered (`docs/research/preregistration.md`) and the live runs start on 2026-12-01.

**Result.** The distinguishing part is the registration: H2 at three presets against C1 and C2, H1 against instruction (C3, C4), on three models with seeded, cached calls. Neither neighbour registers its analysis; HEAMS reports one run per configuration (Appendix C).

**Consequence.** Once H2 reports, the claim may say "measured" with the result's path.
