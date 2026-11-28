---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/approvals.ts
  - docs/decisions/0053-approval-queue-as-a-projection.md
supersedes: none
---

**What.** A version whose request expired or was refused stays closed: every promotion of it is denied under that rule, and no ask reopens it. A rewrite is a new version and a new request with its own expiry.

**Why.** Otherwise a second approver could override a refusal, or an expiry be undone, by asking again on the same version: the stale-base rule of obsidian-wiki's staging.

**Result.** Unit tests pin it for an expired candidate and a refused widening.

**Consequence.** An owner can restart a request by rewriting, including by a grant change, which is a new version; that resets its expiry, and is recorded.
