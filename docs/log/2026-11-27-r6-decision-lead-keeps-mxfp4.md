---
date: 2026-11-27
author: claude-agent
type: decision
card: R6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/lead-decisions.md
  - docs/research/preregistration.md
  - research/configs/openrouter-endpoints.json
  - docs/log/2026-11-26-r6-finding-m1-endpoint-quantised.md
supersedes: none
---

**What.** The lead answered review finding 1 directly on 2026-11-27, not under the delegation. M1 stays on Wafer's `wafer/us`, an mxfp4 build, a 4-bit quantisation as OpenRouter lists it. That costs about 92 dollars at H1's token mix. The quantisation is disclosed. The Models sentence of the pre-registration now names the mxfp4 build and says that M1's results are reported as served by it. `docs/tasks/lead-decisions.md` records the answer under "The lead's answers, 2026-11-27".

**Why.** The seed-first rule picks `wafer/us`. The nearest seeded endpoint not quantised to 4 bits costs several times more. A reader, or a replication on another endpoint, has to know which build served the results.

**Result.** No pin changes. The only registered text that changes is the Models sentence that names the endpoints, which the card sanctions.

**Consequence.** The thesis reports H1 as served by the 4-bit build of M1.
