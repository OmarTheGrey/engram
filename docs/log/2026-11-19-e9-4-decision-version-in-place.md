---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - packages/core/src/plane/grants.ts
supersedes: none
---

**What.** An allowed grant change is a new version in place (same id, version plus one, only the grants changed), rewritten to the store, recorded by one `update` event carrying the stored item.

**Why.** ADR 0005, decision D1 keeps fresh ids for content that should keep history; a grant is not content. A promotion's status change and an offboarding's handover already update in place with an `update` or `promote` event, and `update` is an existing op, so no schema change. Writing to the store keeps adoption from reverting the grant on the next read.

**Result.** The projection rebuilt from the log equals the incremental one after grant changes (`packages/core/test/unit/plane/grants.test.ts`), and over the files adapter re-adoption appends nothing after a change (`packages/adapters/test/plane/grants-files.test.ts`).

**Consequence.** A grant change counts as the item's last change for recency eviction (ADR 0025).
