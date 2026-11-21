---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - docs/readings/litreview/2610.22959-safe-mem.md
  - docs/readings/litreview/2611.20144-heams.md
  - docs/readings/litreview/sota-2026.md
  - docs/readings/litreview/README.md
  - docs/research/absorb/16-frontier-sweep.md
  - docs/research/positioning.md
supersedes: docs/log/2026-11-21-r3-finding-litreview-corrections.md
---

**What.** The literature notes were corrected against the full texts, now in card R3's scope.

**Why.** The notes read parts of each paper; R3 read both, and the review brought the notes into scope.

**Result.** `2610.22959-safe-mem.md`: no-defence recall 75.9 and 79.5, not 41.1 (Table 1); "what Engram does differently"; the H2 risk names both baselines (Appendix G, Table 6); v2 date and Apache-2.0. `2611.20144-heams.md`: four new benchmarks, not three; governance evaluated only with MilaMem (Table 3); Tables 7 and 8 numbers; deterministic, LLM and hybrid policies, logging as run records, no delete or consolidate governance; the risk paragraph quotes the new claim; Apache-2.0. `sota-2026.md`, November section, and the same paragraph in `docs/research/absorb/16-frontier-sweep.md`: MilaMem only, Table 8, policy modes, recall 75.9, the claim. `README.md`, novelty line: pre-registered measurement.

**Consequence.** Supersedes the first version, which left the notes unedited.
