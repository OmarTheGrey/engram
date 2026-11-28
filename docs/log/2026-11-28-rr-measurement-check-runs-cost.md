---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-check-runs-cost.json
  - research/configs/h1-check-runs-cost.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h1_check_runs_cost.py --config research/configs/h1-check-runs-cost.json --out research/results/h1-check-runs-cost.json"
supersedes: docs/log/2026-11-20-rv6-measurement-check-runs-cost.md
---

**What.** The cost estimate of H1's two pre-tag check runs, MANIFEST row `research/results/h1-check-runs-cost.json`, restated with its config `research/configs/h1-check-runs-cost.json` as evidence.

**Why.** The earlier entry named the config only inside its command, which the thesis consolidator rejects; its numbers still match the file.

**Result.** A cost estimate in US dollars at pi-ai 1.3.0 list prices; no run was made. Smoke GateMem on openrouter/openai/gpt-5.6-terra: `runs[0].total` 0.443526 to 3.012784. Smoke MEM-INV-Bench: `runs[1].total` 0.084943 to 1.250165. B1 on openrouter/openai/gpt-5.4: `runs[2].total` 2.056639 to 6.039012, its 150 C1 calls 636,381.75 input tokens low (`runs[2].tokens.low.input`). In all, `total` 2.585109 to 10.301961.

**Consequence.** The file still prices the smoke runs on gpt-5.6-terra, while the pre-registration's Models section names `openrouter/deepseek/deepseek-v4-pro-0813` as M1; a rerun on that model would move this row.
