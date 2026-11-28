---
date: 2026-11-28
author: claude-agent
type: measurement
card: E1.7
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - "python research/scripts/<script>.py --config <config> --out <temporary file>, one MANIFEST row at a time, as research/scripts/reproduce.py runs each"
supersedes: none
---

**What.** The guard: every MANIFEST row whose script runs the plane (write.ts, adopt.ts, offboard.ts reachable) rerun alone on the fixed code, and its sha256 compared with the row's.

**Why.** No registered byte may move. No registered condition offboards, so no swept id, erasing refusal or put-back arises there, but the write path is shared.

**Result.** 19 rows identical: h1-gatemem-reach, h1-mem-inv-admission, h1-c4-verdict-agreement, h1-c4-walk, h1-cost, h1-refusal-leaks, h3-fault-set, h3-lint-floor, h2-longmemeval-ttl, h2-longmemeval-cost, h1-check-runs-cost, h2-cost-table, h1-injection-screen, h1-secret-guard, h2-perf-budget, h1-redteam, h3-near-duplicate, h3-lint-nli, h1-leakage. Not rerun: h4-power, h4-holm-levels, the two label audits and h1-crosswalk (no plane code). h2-frontier-axes was started and stopped on the orchestrator's instruction (machine overloaded): it is left to the orchestrator's full `make test-repro` before the tag. The mutation audit has its own entry.

**Consequence.** No fixture, cassette or registered result moved.
