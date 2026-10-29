---
date: 2026-10-29
author: claude-agent
type: finding
card: B3
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md
  - docs/research/preregistration.md
  - docs/readings/litreview/2606.18829-gatemem.md
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b3-gatemem-plane.json"
supersedes: none
---

**What.** Under ADR 0030's mapping, C5 enforces no deletion, so GateMem's forgetting score measures the model, not the plane.

**Why.** H1's primary test is GateMem on the primary model, C4 minus C5, over the 727 access-control and 763 active-forgetting checkpoints (`docs/research/preregistration.md`). The literature note says "A and F should be zero by construction for a correct plane" (line 31). No agent-visible field carries a deletion, so the plane never retires a deleted value.

**Result.** In the B3 forgetting probe (`ckpt_20`), the deleted staging token reaches the asker's context on fake and Mem0 (`context leak true`). The note's claim fails for F under this mapping. For A it holds only outside what the mapping's relationships reach.

**Consequence.** A deletion mechanism (a retire tool with model-driven ingestion, or a deletion lint) is backlogged for the lead to decide before the pre-registration leaves the backlog. ADR 0030 cites it.
