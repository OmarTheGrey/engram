---
date: 2026-11-03
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-c4-verdict-agreement.json
  - research/configs/h1-c4-verdict-agreement.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h1_c4_verdict_agreement.py --config research/configs/h1-c4-verdict-agreement.json --out research/results/h1-c4-verdict-agreement.json"
supersedes: none
---

**What.** Agreement of C4's two verdict sources, the plane's read decision and GateMem's RAG-Policy gate, on every turn item of the pinned full set (MANIFEST sha256 `9335a677...`).

**Why.** ADR 0031 chose the plane's verdict because the two disagree; the share was a development count until now.

**Result.** Under medium, 235,384 of 325,530 turn items agree (0.7231); the gate allows what the plane denies on 60,305 (0.1853), the reverse on 29,841 (0.0917). On the 10,726 turn items holding a leak target: 7,425 agree (0.6922), 2,099 and 1,202 the two ways. Access control: 67,243 of 96,386 agree; on its 5,259 leak-target items the gate allows 1,528, the plane 722. Forgetting: 103,580 of 142,659; on 5,467 leak-target items, 2,389 and 2,298. Strict and permissive give the same counts.

**Consequence.** PR 3's development numbers are reproduced exactly.
