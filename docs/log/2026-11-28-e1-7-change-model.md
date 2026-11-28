---
date: 2026-11-28
author: claude-agent
type: change
card: E1.7
chapter: design
pillar: research
hypothesis: none
evidence:
  - specs/commit.qnt
  - specs/replay.qnt
  - specs/README.md
  - Makefile
  - "npx --yes @informalsystems/quint@0.33.1 test specs/commit.qnt --main=threeOffboardings"
supersedes: none
---

**What.** The model changes with the code: `decide` refuses a removed (erased or swept) id, `obPutBackRead` takes `wanted`'s decision and `obPutBackWrite` deletes when it is nothing, `inFlightOn` counts the put-back, `knownGapThreeOffboardings` becomes `threeOffboardings`, and `make verify-spec` simulates it (seed 1, 5,000 traces).

**Why.** The card's step 4; a gap closed only in the code would leave the model describing the leak.

**Result.** `good`'s seven tests, `broken`'s two and `threeOffboardings`' one pass; `sweptIdPurgeRaceTest` and `putBackAcrossThirdErasureTest` now end in `safety`. Three offboardings, seed 1: "No violation found", `sawPutBack` in 4 of 5,000 traces.

**Consequence.** The replay's scenario runs restate both closed gaps; `forced` lost its dead put-back case in `replay.qnt` and `itf.ts` alike.
