---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/export/otel.ts
  - docs/decisions/0043-decision-export-egress.md
  - "make test-one T=packages/core/test/unit/export/otel.test.ts"
supersedes: docs/log/2026-11-21-e8-13-decision-reasons-by-template.md
---

**What.** A span's reason keeps its clauses in order while each whole clause matches a template of its op; from the first clause that does not, that clause and every clause after it are one `[withheld]` marker, all counted in `engram.reason.withheld`.

**Why.** Finding E8.13-1: fragments of free text shaped like a template passed. The rule is the lead's; every producer puts its free text at the tail, so nothing kept before is lost.

**Result.** The kept-reason table held 28 reasons, not the 29 the superseded entry said. Since finding E8.13-2 moved the expiry reason to its own test, 27 are kept whole and one is kept with its time and ttl as tokens. The one unit expectation that kept a template after a withheld clause now expects `[withheld]`, counted 3.

**Consequence.** ADR 0043's decision 4 is amended to state the rule.
