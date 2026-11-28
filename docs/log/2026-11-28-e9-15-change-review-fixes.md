---
date: 2026-11-28
author: claude-agent
type: change
card: E9.15
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/audit/report.ts
  - packages/cli/src/audit.ts
  - make test-one T=packages/core/test/unit/audit/report.test.ts
  - make test-one T=packages/cli/test/audit.test.ts
supersedes: none
---

**What.** The review's other fixes: the export reads the chain check, head, checkpoint and events in one transaction (finding 5; SQLite's BEGIN IMMEDIATE and the Postgres writers' lock keep a writer out between them); `audit verify --checkpoint <file>` passes held checkpoints to the chain check (finding 6); the statement's notes state that the head carries no RFC 6962 root and what the policy's hash reveals; the content-free test adds a grant, a lineage and a policy whose rule ids embed a scope (finding 7); the TUI verify screen gains the level, declared and held fields (finding 11).

**Why.** Review of E9.15, approve after changes; the orchestrator's decisions (4).

**Result.** Core report test 26 passed with 3 Postgres runs skipped; CLI audit test 10 passed; frames regenerated after checking each diff.

**Consequence.** The root at the head stays out: core exposes no Merkle root at a prefix.
