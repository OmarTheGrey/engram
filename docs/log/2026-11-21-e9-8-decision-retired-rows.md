---
date: 2026-11-21
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/import/bundle.ts
  - fixtures/bundles/synthetic-v1.jsonl
  - "make test-one T=packages/cli/test/import-export.test.ts"
supersedes: none
---

**What.** A retired row is imported as retired; every other row as a candidate.

**Why.** Decision item 55 makes every row a candidate, but a retired version imported as a candidate could be promoted beside its successor.

**Result.** Retired is below candidate, so nothing arrives more trusted than item 55 allows; the row keeps lineage resolvable and is never read or promoted. A row written retired is not counted by the retired-content rule (only event retirements are), so it blocks no later write.

**Consequence.** Nothing for the registered conditions: no preset or config imports.
