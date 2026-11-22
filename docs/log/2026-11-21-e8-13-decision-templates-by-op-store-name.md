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
supersedes: docs/log/2026-11-21-e8-13-decision-templates-by-op.md
---

**What.** Reason templates stay scoped per op, as before. ADR 0043 decision 2 now lists the bypass record's store name among what leaves.

**Why.** The fix pass's verification (finding E8.13-6) showed the earlier Consequence line was not exact. The `/bypass` route takes the store name from its caller, and a crafted name can fill more than one kept bypass clause, so it is not held to one token.

**Result.** It exposes nothing beyond the store field itself: a plain store name already leaves in the first bypass clause, and every kept slot admits only lowercase letters, digits and hyphens, like `engram.actor`. No code or test changed.

**Consequence.** The bypass store name is caller-chosen data that leaves the machine, as the ADR now states. An operator who must not send it leaves the export off.
