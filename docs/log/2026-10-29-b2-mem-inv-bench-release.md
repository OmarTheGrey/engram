---
date: 2026-10-29
author: claude-agent
type: finding
card: B2
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/PINS.md
  - https://github.com/yedidel/mem-inv-bench
  - https://huggingface.co/datasets/anonymos-2321135/MEM-INV-Bench
  - "gh api repos/yedidel/mem-inv-bench"
supersedes: none
---

**What.** MEM-INV-Bench (arXiv 2606.24322), the poisoning arm's named fallback, has code and data: yedidel/mem-inv-bench at cf3c9a4 (MIT, artifact 2.1.0, no tag) and Hugging Face anonymos-2321135/MEM-INV-Bench at 59e5bcd (MIT, five Parquet tables, 4,384 records).

**Why.** Plan decision 6 asks whether the fallback is usable if MPBench stays unreleased; the literature-review note had not checked.

**Result.** The release replays the authors' recorded runs offline (`verify.py --quick`); live runs use OpenRouter. It measures poisoned memory driving consequential actions past an authorization monitor, not MPBench's store-then-retrieve protocol, and documents no plug-in point for a new defence.

**Consequence.** The PINS.md row is filled; the arm is chosen at Gate B. The MPBench request is the lead's to send.
