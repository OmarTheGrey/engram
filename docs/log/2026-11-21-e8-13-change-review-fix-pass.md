---
date: 2026-11-21
author: claude-agent
type: change
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/export/otel.test.ts
  - docs/decisions/0043-decision-export-egress.md
  - docs/readings/litreview/repo-otel-genai-semconv.md
  - "make test-one T=packages/core/test/unit/export/otel.test.ts"
supersedes: none
---

**What.** The review fix pass of card E8.13, findings E8.13-1 to E8.13-5.

**Why.** One critical finding (reason fragments leaked) and four minor ones.

**Result.** E8.13-1: withhold from the first unmatched clause to the end, and templates by op. Seven new or changed tests failed first. Mutation: letting the loop continue past a withheld clause fails 7 tests. The review's hook reproduction now gives `grep -c zebra` 0, and the span's reason is `mem0 is a memory store command; use the Engram memory tools; [withheld]`. E8.13-2: the expiry template exports `[time]` and `[ttl]`; two tests failed first. E8.13-3: ADR 0043's Consequences say spans already sent keep `person:<leaver>` and scope ids at the collector. E8.13-4: the count is corrected in the superseding decision entry. E8.13-5: the literature note is corrected. The core mapping test passes 44 of 44.

**Consequence.** PR.md's evidence names the new reproduction.
