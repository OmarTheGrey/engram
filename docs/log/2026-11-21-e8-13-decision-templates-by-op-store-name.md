---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0043-decision-export-egress.md
  - packages/core/src/export/otel.ts
  - packages/core/src/plane/bypass.ts
supersedes: 2026-11-21-e8-13-decision-templates-by-op.md
---

**What.** Each reason template family is kept only on the ops whose reasons it comes from: the write gate's on write, update, promote and gate; the read's counts on read; retention's on retire and evict; the bypass record's on bypass_blocked; none on lint. ADR 0043 decision 2 now lists the bypass record's store name among what leaves.

**Why.** The verification of the fix pass (review finding E8.13-6) showed the earlier Consequence line was not exact. The `/bypass` route takes the store name from its caller, and a crafted store name can fill more than one kept bypass clause, so it is not held to one token.

**Result.** It exposes nothing beyond the store field itself. A plain store name already leaves in the first bypass clause, and every kept slot admits only lowercase letters, digits and hyphens, like `engram.actor`. No code or test changed.

**Consequence.** The store name a bypass names is caller-chosen data that leaves the machine, stated in the ADR. An operator who must not send it does not turn the export on.
