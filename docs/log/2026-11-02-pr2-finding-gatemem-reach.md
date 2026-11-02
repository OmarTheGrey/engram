---
date: 2026-11-02
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-gatemem-reach.json
  - docs/log/2026-10-29-b3-forgetting-not-enforced.md
  - docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md
supersedes: none
---

**What.** Under ADR 0030's mapping, C5 can keep leak targets from the asker's memory on at most 25.8 percent of GateMem's forgetting checkpoints and 62.9 percent of its access ones.

**Why.** H1's primary test is C4 minus C5 over both kinds. Where a target is readable, C5 hands it to the model as an ungoverned store would, and the model alone decides.

**Result.** 74.0 percent of forgetting checkpoints have a readable target (63.0 percent every target), 35.8 percent of access ones (`research/results/h1-gatemem-reach.json`). On access, 165 reach a target through the asker's own turns and 123 through a grant. The three presets give identical rows.

**Consequence.** For PR 4's decision sheet, not decided here: forgetting checkpoints in the primary set dilute any C4 minus C5 difference by construction. Alternatives: keep them and report this bound, restrict the primary set to access checkpoints, or build a deletion mechanism first.
