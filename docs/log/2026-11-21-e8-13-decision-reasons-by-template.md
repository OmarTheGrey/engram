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
  - "make test-one T=packages/core/test/unit/export/otel.test.ts"
supersedes: none
---

**What.** A span's reason is exported clause by clause: a clause is kept only when its whole text matches a template whose slots admit only enums, numbers, UUIDs, scopes, times and rule names; any other becomes `[withheld]` and is counted in `engram.reason.withheld`.

**Why.** Reasons are free text. A bypass keeps the command attempted, the duplicate lint names a strict content hash, the orphan lint a provenance ref, a store failure its error message. Dropping the reason entirely loses the guards' and screen's kinds and lengths; exporting it whole sends content.

**Result.** Templates cover the write gate, the provenance note, the read's counts, the injection screen, the content guards (checked against the merged E2.9 guard), the bypass record's first clauses and retention. 29 kept reasons and 5 slot-smuggling cases are tested.

**Consequence.** A new reason producer is withheld until its template is added.
