---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/labels.ts
  - docs/readings/litreview/sota-2026.md
  - docs/decisions/0005-bi-temporal-validity.md
supersedes: none
---

**What.** A fault is keyed when what makes it faulty is in a field the plane records (valid_to, class against the scope's rule, provenance model, a cited item's hash or status), and unkeyed when it is only in the text of items.

**Why.** H3 reports keyed and unkeyed items apart, and ADR 0005's amendment and the 2026 literature note say the expired-validity lint fires reliably only on keyed items: a keyed ledger supersedes deterministically, a supersession in prose needs extraction. The schema has no entity or attribute key, so the plane's own fields are the only keys there are.

**Result.** Keyed: expired-validity, source-changed, forbidden-class, missing-provenance, orphan. Unkeyed: superseded, conflict, wrong-scope, unsupported-claim. No contradiction is keyed, so that cell is reported, and zero.

**Consequence.** If wrong: a richer key (an attribute field) would make some unkeyed subtypes keyed; that is a schema change and its own PR.
