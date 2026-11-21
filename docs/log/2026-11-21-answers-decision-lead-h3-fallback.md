---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H3
evidence:
  - docs/tasks/lead-decisions.md
  - docs/research/preregistration.md
  - docs/roadmap.md
supersedes: none
---

**What.** If card L3's pilot shows a standard deviation across seeds above 0.05 on precision or recall for any lint, the deterministic tier becomes H3's primary test and the model tier is reported as secondary (lead-decisions item 58, the lead's own answer of 2026-11-21).

**Why.** Item 23 made the model tier primary and item 43 set the bound, with nothing saying what a pilot above it does (review finding ANS-6).

**Result.** v1's H3 Analysis registers the rule before any pilot data exist, and the roadmap's risk row agrees.

**Consequence.** The pilot's result decides H3's primary tier mechanically.
