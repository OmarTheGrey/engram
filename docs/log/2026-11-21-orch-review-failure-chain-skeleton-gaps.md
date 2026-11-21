---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: E1.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0038-tamper-evident-log-that-keeps-erasure.md
  - docs/tasks/E1.6.md
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** ADR 0038's first draft left two ways to defeat the chain (review finding AP-3).

**Why.** The skeleton was listed from memory of the event's fields, and the erasure case was designed only for the honest path.

**Result.** First, the skeleton omitted the reason, so a rewritten reason was undetected, though rule 3 makes it the audit trail. Second, a link with its salt deleted verified as erased, so anyone with database access could redact a field, delete its salt and hide an edit. Now every field is covered, and a redaction counts only when the chain holds the offboarding's own erase event for that item.

**Consequence.** Card E1.6's tamper matrix adds both cases: a rewritten reason, and a forged redaction with no erase event.
