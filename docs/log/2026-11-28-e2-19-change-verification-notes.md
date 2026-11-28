---
date: 2026-11-28
author: claude-agent
type: change
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/promote.ts
  - packages/core/src/plane/approvals.ts
  - packages/core/test/unit/plane/approvals-review.test.ts
  - packages/core/test/property/invariants.test.ts
  - docs/decisions/XXXX-approval-queue-as-a-projection.md
  - "make test-invariants"
supersedes: none
---

**What.** The verification notes before merge. N1: `may_decide` asks the promotion gate itself (`promotionDecision`, the function decideAndCommit now calls), so a confirmer or the owner of a guard-held candidate with a live grant is not offered a decision. N6: a refusal the gate refuses is a `promote` deny unless it would have retired. N7: the surface leak check also probes `approvals`, `refuse` and `expireRequests` under a policy with a block. N2, N5 in the ADR; N3 in the oracle's comment; N4 the closed-refusal floor raised to 5.

**Why.** The verifier's approval asked for them before merge.

**Result.** The fix-pass file: 19 passed (N1's test failed first); `make test-invariants`: 23 passed.

**Consequence.** The N7 probe is in the lead-owned invariants file: a second reviewer.
