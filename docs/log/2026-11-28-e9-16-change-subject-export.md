---
date: 2026-11-28
author: claude-agent
type: change
card: E9.16
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - packages/core/test/unit/subject-access.test.ts
  - packages/cli/src/commands.ts
  - packages/cli/test/subject-export.test.ts
  - "make test-one T=packages/cli/test/subject-export.test.ts"
supersedes: none
---

**What.** `engram export --subject person:<id> --out <file>` writes the person's own bundle (card E9.8's, unchanged, so it imports again) and prints core's subject access report: counts by status, class and level, the decisions on the bundle by operation, and the closure of items derived from it through lineage, named by ADR 0047's by-id rule (`idShownTo`), counted otherwise.

**Why.** GDPR Articles 15 and 20 in the crosswalk; the card's steps 1 and 2.

**Result.** The acceptance file passes 6 of 6: the bundle round-trips through import into an empty workspace with the same content, the report is the same for the same log and clock, and another person, an agent, a missing --out and --server are refused. Mutating the refusal or the by-id check fails the tests.

**Consequence.** Claim C52 points at these tests.
