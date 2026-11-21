---
date: 2026-11-21
author: claude-agent
type: change
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint.ts
  - packages/core/src/lint/det.ts
  - packages/core/scripts/faults.ts
  - fixtures/faults/injection-signature.flag.json
  - fixtures/faults/injection-signature.near-miss.json
  - "make test-one T=packages/core/test/unit/lint/det.test.ts"
supersedes: none
---

**What.** The deterministic lint `injection-signature` joins `DETERMINISTIC_LINT_IDS`; it runs the screen over each active item of the linted scope under the item's own kind, with the policy's profile when the gate stage is on, else default, and its evidence names rule, signal, weight and length.

**Why.** Content stored before the screen was turned on, or under a policy without it, can still be found (card E2.10, step 3).

**Result.** Its flag fixture (a tool's standing directive, a user's instruction reset) and near-miss (a user's own preference, a one-signal tool note, a hash) pass; making the lint never flag fails the flag fixture. All other fault fixtures regenerate byte for byte. No preset or profile lists the id.

**Consequence.** A lint-running condition runs it only if a policy's `lints.enabled` names it.
