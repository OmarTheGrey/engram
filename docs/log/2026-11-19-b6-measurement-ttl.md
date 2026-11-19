---
date: 2026-11-19
author: claude-agent
type: measurement
card: B6
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-longmemeval-ttl.json
  - research/configs/h2-longmemeval-ttl.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h2_longmemeval_ttl.py --config research/configs/h2-longmemeval-ttl.json --out research/results/h2-longmemeval-ttl.json"
supersedes: none
---

**What.** What the plane's read filter hides of each LongMemEval S history, per question, preset and clock (MANIFEST sha256 `41294115...`).

**Why.** Card L2 found that preset medium's 90-day ttl hides part of the S histories at read time; H2's primary test is C2 minus C5 at medium on LongMemEval.

**Result.** Medium at B5's read time hides 11,122 of 246,750 turns in 54 of 500 questions (10.8 percent), all by the ttl; 38 questions (7.6 percent) lose an evidence turn, 5 lose all of them; 28 of the 38 are knowledge-update, 10 temporal-reasoning. At the last session: 6,938 turns, 42 questions, 28 losing evidence. At 2026-11-19: every turn, 479 questions losing all evidence. Strict: 34,688 turns, 148 questions, 77 losing evidence. Permissive: none. The oldest turn is 311.7 days old at read time.

**Consequence.** The options are in `docs/log/2026-11-19-b6-finding-clock-options.md`.
