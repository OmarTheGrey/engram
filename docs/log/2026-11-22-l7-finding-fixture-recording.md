---
date: 2026-11-22
author: claude-agent
type: finding
card: L7
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - Makefile
  - fixtures/cassettes/l7-nli-scores
supersedes: none
---

**What.** `make fixtures` re-records the model cassettes of l3-lint-fixture and h3-lint-model-fixture but not the NLI scores.

**Why.** The next card that regenerates fixtures needs to know what keeps the tiered replays working.

**Result.** The NLI score cassettes are keyed on pair text only, so they survive a re-recording of the model cassettes; the band's model calls stay hits while the fault fixtures' text is unchanged. If that text changes, `make nli-scores CONFIG=` must record the new pairs, which needs the network once to fetch the 568 MB model.

**Consequence.** Nothing now. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
