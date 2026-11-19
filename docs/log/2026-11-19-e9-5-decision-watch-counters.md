---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - docs/log/2026-11-19-e9-5-finding-readoption-raises-model-content.md
supersedes: none
---

**What.** The report counts, under `watch` and not as violations, events that raised an item's provenance from model, compaction or external to a trusted kind, and grants added to such an item.

**Why.** The finding of this card: re-adoption raises an agent-written item to `import`, after which its owner may grant it. Neither report kind covers it (the owner granted, under the item's current kind), but ADR 0021's "model content carries no grants" is meant to.

**Result.** The realistic synthetic log shows `provenance_raised` 2 and `granted_after_raise` 1 with zero violations.

**Consequence.** The lead decides whether `granted_after_raise` counts as a violation for Gate D; the procedure tells members not to grant agent-written items.
