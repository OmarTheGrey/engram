---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: related-work
pillar: research
hypothesis: none
evidence:
  - docs/readings/litreview/2611.20144-heams.md
  - docs/readings/litreview/2610.22959-safe-mem.md
  - docs/readings/litreview/sota-2026.md
  - docs/research/positioning.md
supersedes: none
---

**What.** The full texts contradict four statements in the HEAMS and SAFE-Mem notes and in the November section of `sota-2026.md`.

**Why.** The notes of PR #67 read parts of each paper; card R3 read both in full.

**Result.** (1) SAFE-Mem's recall without defence is 75.9 percent on GPT-5.6-terra and 79.5 on GPT-4o-mini (Table 1); the notes give 41.1, Qwen3.8-Flash's attack success in the same row. (2) HEAMS evaluates its governance layer on MilaMem only (Table 3, caption), not on Mem0, Letta or HippoRAG 2. (3) HEAMS has deterministic and hybrid policies (Sec. 4.2) and logs each decision with a reason and a policy id (`wrapper.py`). (4) HEAMS's unread numbers are Table 7 (15.63 and 84.47 percent) and Table 8 (40.00 to 88.61 percent); both repositories are Apache-2.0.

**Consequence.** The notes are outside card R3's files and were not edited. The lead decides whether a small card corrects them.
