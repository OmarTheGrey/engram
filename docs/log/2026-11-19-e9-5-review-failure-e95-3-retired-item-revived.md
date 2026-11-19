---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Review finding E95-3 (critical): a grant change on a retired item, carrying `status: active`, revived it in the replay, and a later grantee read counted as clean.

**Why.** Nothing checked the item a grant change was made on.

**Result.** A grant change must now be on an active item and change only its grants and version; the planted revival is `grant_change` 1, and a grant change that also rewrites the content is too. Dropping either check fails its test.

**Consequence.** The replay still applies the planted event, so the read after it is judged on the revived item; the violation is the grant change.
