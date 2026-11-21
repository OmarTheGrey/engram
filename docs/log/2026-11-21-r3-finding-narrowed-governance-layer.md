---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: related-work
pillar: plane
hypothesis: none
evidence:
  - docs/research/positioning.md
  - https://arxiv.org/abs/2611.20144
supersedes: none
---

**What.** The claim "the first governance layer over existing memory stores" is withdrawn.

**Why.** HEAMS ships one: `PrivacyMemoryWrapper` (`memory_plugins/heams_memory_privacy_wrapper/src/heams_memory_privacy_wrapper/wrapper.py`, repository at dec2874) applies retention and recall policies around any memory system behind its common interface (Sec. 4.2).

**Result.** What remains is narrower and still Engram's: the layer is deterministic only, its log is the source of truth and replays state, it covers several principals with scopes and grants, and its tax is measured under a pre-registration. HEAMS evaluates its layer on MilaMem only (Table 3, caption), so neither project has measured one policy across stores.

**Consequence.** The README and `docs/architecture.md` state the narrowed claim (`docs/research/positioning.md`).
