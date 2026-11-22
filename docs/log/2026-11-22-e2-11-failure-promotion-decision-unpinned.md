---
date: 2026-11-22
author: claude-agent
type: failure
card: E2.11
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/promote.ts
  - packages/core/test/counterexamples/trust.test.ts
  - "make test-one T=packages/core/test/counterexamples/trust.test.ts"
supersedes: none
---

**What.** No test pinned the promotion's decision-time budget refusal, although the fix pass's report and the `invariant-8-races` entry said one did (review E2.11-9).

**Why.** Once the commit recheck existed, it refused the same promotion later with the same rule id, so every outcome a test checked was unchanged; the claim was carried over from the write path, whose test checks the reason and the store writes, without being checked for the promotion.

**Result.** The promotion's twin of the write's case now asserts the reason names no commit and `adapter.writes` is unchanged. With the decision-time refusal removed it fails (1 failed, 395 passed); restored, 396 passed.

**Consequence.** A mutation claim is made only after the mutation was run against the named test.
