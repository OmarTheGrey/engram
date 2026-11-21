---
date: 2026-11-21
author: claude-orchestrator
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/absorb-plan.md
  - docs/research/absorb/long-list.md
  - docs/roadmap.md
supersedes: none
---

**What.** The 166 candidate plans were cut to thirty pull requests, in three stages: five before the `prereg-v1` tag (documents and tests only), eighteen on the research spine to Gate D, seven on the product lane.

**Why.** The lead asked for at most thirty, the most important work and absorptions, each with why and how.

**Result.** Selection tests, in order: it cannot endanger Gate C; it serves a hypothesis or closes a gap found in our own code; it absorbs something we would write worse; it can be shown. Twenty-six cards are new and B7, D1, D2 and D3 are rewritten. Left out, with reasons in the plan's section 7: crypto-shredded erasure, dense retrieval, derived-from edges, the approval workflow, ingestion, more adapters.

**Consequence.** Stage 1 starts in W8. Every behaviour change is behind a policy option that is off in the H1 to H4 presets.
