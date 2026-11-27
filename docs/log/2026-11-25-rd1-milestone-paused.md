---
date: 2026-11-25
author: claude-agent
type: milestone
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/RD1.md
  - packages/core/src/visible.ts
  - research/results/MANIFEST.md
supersedes: none
---

**What.** RD1 paused at the lead's request. Done: the core rule (`visible.ts`) on read, by-id read, explain, events, promote, export and the supersede route; tests in core, server, CLI and MCP, each mutation-checked; ADR 0034's amendment, backlog, architecture, eight log entries; `make lint`, `lint-docs`, `api-check` and `test-invariants` green.

**Why.** Paused cleanly, nothing in progress; no file is half-edited.

**Result.** Pre-registration: `make test-repro` proved 23 of 24 MANIFEST rows byte-identical. `h2-frontier-axes.json` is unchecked: its run was cut by my own 90-minute timeout (exit 143), then its rerun was stopped for this pause.

**Consequence.** Remaining: (1) rerun that row, (2) write `2026-11-25-rd1-finding-prereg-unmoved.md` citing the 24 rows, (3) fill PR.md's result line, (4) the final report. First command on resume: `ENGRAM_RESEARCH_WORKERS=4 uv run python research/scripts/frontier_axes.py --config research/configs/frontier-axes.json --out <tmp>/h2-frontier-axes.json`, then compare its sha256 with the MANIFEST row.
