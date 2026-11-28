---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.15
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/audit/report.ts
supersedes: none
---

**What.** Verify recomputes the whole statement from the log to the report's own head (entries, hash, last seq), with the window and issuing time it states, and compares it field by field; the checkpoint it names is looked up by number, not as the latest.

**Why.** A log grows after an export; reading only to the stated head keeps an old report verifying, and the head's hash ties it to one history. The RFC 6962 root is left out of the head, since core exposes no root at a prefix; the checkpoint carries its own root, which `verifyChain` checks.

**Result.** A later write leaves the report OK; a head beyond the chain or a rewritten chain fails at head.

**Consequence.** A change to a note's wording or the predicate's fields makes older reports fail at counts; the format string (`engram-audit-report/1`) is bumped with such a change.
