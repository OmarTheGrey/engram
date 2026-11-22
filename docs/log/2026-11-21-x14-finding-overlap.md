---
date: 2026-11-21
author: claude-agent
type: finding
card: X14
chapter: discussion
pillar: research
hypothesis: none
evidence:
  - research/results/h1-redteam.json
  - packages/bench/src/redteam/overlap.ts
supersedes: none
---

**What.** The write route shares MEM-INV-Bench's write paths in three cells: document with direct and corroborate (16 cases), tool with tool_echo (8), model with summarize (8); user, external, unattested and every read-route cell share none.

**Why.** The card maps the overlap so nothing is counted twice.

**Result.** The mapping is computed from the vendored cases, structurally (an entry from an untrusted feed or derived from one), with no hidden label.

**Consequence.** Neither arm's cases are in the other's corpus, and MEM-INV-Bench scores an action, not survival, so the two arms are reported apart.
