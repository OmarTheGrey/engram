---
date: 2026-11-21
author: claude-agent
type: change
card: E8.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - test/e2e/item-page.e2e.test.ts
  - packages/ui/test/provenance.test.ts
  - packages/ui/src/provenance.ts
  - docs/log/2026-11-21-e8-11-decision-leak-rule-promotion.md
  - docs/log/2026-11-21-e8-11-finding-ancestor-ids-in-payload.md
  - docs/log/2026-11-21-e8-11-long-log-timings-single-run.md
supersedes: none
---

**What.** The seven minor findings of the independent review are fixed.

**Why.** The review found nothing critical or important.

**Result.** E8.11-1: the leak check reads the whole page's HTML, its URL and its title. E8.11-2: as sam, every graph node, every row of the item's event table and every pair of versions is activated, and the check repeats after each. E8.11-3: Enter on an item node and Space on an event node are tested. E8.11-4, -5, -6: superseding entries, a corrected comment and a unit test for a promotion into a scope the viewer cannot read. E8.11-7: each test sets its viewer and opens its item; all nine pass alone under `-t`. Mutations: a dead key handler fails the keyboard test; lineage printed in the event detail fails the leak test. `make test-e2e`: 45 passed.

**Consequence.** Ready for review again.
