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
  - packages/core/test/unit/lint/evidence.test.ts
  - docs/log/2026-11-28-l9-decision-quote-sources.md
supersedes: none
---

**What.** A contradiction flag whose every quote is found in its own item and also in the other item is `ungrounded`, each quote marked with `SHARED_QUOTE_REASON`; one quote the other item lacks keeps the flag.

**Why.** Review finding L9-1: pairs share text by construction (they are chosen by term overlap), so a model wrongly flagging a near-duplicate could quote the shared span ("The release freeze starts on", both sides) and pass.

**Result.** Tested: the review's probe and a pair of shared prefixes are ungrounded; "runs on port 80" against "runs on port 8080" stays a finding, since B's quote is not in A. Mutant (the rule disabled) killed. A claim's quote is still not checked against its source, whose text may be outside the scope.

**Consequence.** The check still cannot catch a wrong judgment about text that is really in one item and not the other.
