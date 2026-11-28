---
date: 2026-11-28
author: claude-agent
type: decision
card: L9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/model.ts
  - docs/decisions/0009-retrieval-explanations.md
supersedes: none
---

**What.** The contradiction lint asks for two quotes, `quote_a` of A and `quote_b` of B, both checked; the unsupported-claim lint asks for one, `quote`, of the claim only, never of the source.

**Why.** The source's design proves a contradiction only when both sides are quoted. For a claim, the source may be outside the linted scope, and ADR 0009's amendment keeps its text out of a finding's evidence: a quote of the claim is always text of an in-scope item, so it can be shown. A claim quoting its source is ungrounded unless the words are also in the claim.

**Result.** Tested: a claim quoting its out-of-scope source is ungrounded and no finding names "Linux".

**Consequence.** Grounding a claim's flag says the model named the unsupported words; it does not check them against the source, which card R-126 could.
