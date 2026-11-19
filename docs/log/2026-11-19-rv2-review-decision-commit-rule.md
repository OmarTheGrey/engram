---
date: 2026-11-19
author: claude-agent
type: decision
card: RV2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/scripts/reproduce.py
supersedes: docs/log/2026-11-19-rv2-decision-fault-set-commit.md
---

**What.** A cell names the latest squash commit on main that changed one of the row's inputs: its script, its config, the research modules it imports, or a function its run calls after module load.

**Why.** RV2-2 asked for one rule for every row. File-level was too coarse: it moved a row for a function another path changed, or for a file whose only code that ran built constants at load (h1-refusal-leaks, `lint/model.ts`).

**Result.** The called functions come from V8 coverage (`NODE_V8_COVERAGE`) of each row's `reproduce.check_row` run. A function counts when it ran and is not a module's top level. Changed functions come from main's diffs. The H4 rows are pure Python, so their cells come from git history alone.

**Consequence.** If wrong, a cell names an older commit whose code still produces the same bytes. Every row reproduces at main.
