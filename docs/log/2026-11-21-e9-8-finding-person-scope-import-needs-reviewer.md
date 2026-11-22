---
date: 2026-11-21
author: claude-agent
type: finding
card: E9.8
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/cli/test/import-export.test.ts
  - packages/core/src/policy/promotion.ts
  - "make test-one T=packages/cli/test/import-export.test.ts"
supersedes: none
---

**What.** A person alone cannot make their own imported memories readable in their person scope: a candidate there is promoted only by a reviewer who is a member of the scope and not its owner.

**Why.** The import test asks the owner to promote, and the plane refuses (`engram/promote/reviewer`, cannot approve its own item).

**Result.** The round trip promotes through a second user-sourced member, as the CLI's promotion tests do. The person can instead restate a memory as a user write, which person scope admits active. Items held by the injection screen in a person scope (card E2.10) meet the same rule.

**Consequence.** For the lead: whether an owner may accept candidates in their own person scope is an ADR 0026 question, recorded in no card yet.
