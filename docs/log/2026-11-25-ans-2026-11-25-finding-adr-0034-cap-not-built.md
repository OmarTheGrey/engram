---
date: 2026-11-25
author: claude-agent
type: finding
card: ANS-2026-11-25
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
  - docs/tasks/backlog.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** ADR 0034's one-year expiry cap and first-write rule (item 34) are accepted, not built.

**Why.** The acceptance asks for the code to be checked.

**Result.** `grantDefect` (`packages/core/src/policy/evaluate.ts`) has no upper bound on `expires`, and `evaluateWrite` skips it for every first write (`if (!changesGrants || kept) continue;`). Two tests in `write-grants.test.ts` pin this: "a rewrite adding an expired grant is refused; a first write carrying one still lands" and, at lines 135 to 153, "a grant naming another class than the item's is refused by a rewrite adding it and by a grant change".

**Consequence.** Card E2.21 builds it; part 1 is on branch `e2-14-grant-cap`. Part 2 (the cap and first-write rule) lands, under the delegation, after H1's MERGE, behind a policy option `grants.expiry_cap` no registered preset sets: the cap would refuse 1,633 of 2,490 GateMem fixture writes. Part 2 must change both tests and the loop comment on `twin-reads.json`.
