---
date: 2026-11-13
author: claude-agent
type: decision
card: none
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** An item whose store delete fails during erasure is kept, not erased, until a rerun deletes it; ADR 0010 records this, and the redaction of lint evidence, in a post-merge amendment.

**Why.** Erasing the log while the bytes stay in the store is the worst state: the store still holds the memory and the plane no longer knows it. Keeping the item with a deny event leaves an auditable reason and a projected item the next offboarding finds.

**Result.** The other items are erased in the same run, so a failing ref holds back only the items holding it. The report's `store_failures` entries name those items, and its summary reason counts them as kept after a store failure.

**Consequence.** A store failure during handover still stops offboarding before any erasure, as before.
