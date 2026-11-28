---
date: 2026-11-28
author: claude-agent
type: finding
card: E0.6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/absorbed.md
  - "node scripts/check-absorbed.ts"
supersedes: none
---

**What.** The first run of the check on main's register failed one row: `docs/absorbed.md:29` (card L5's claude-mem port) split into 11 cells instead of 7.

**Why.** Its "what was taken" cell wrote `min(2, |A|, |B|)` with bare pipes, which Markdown reads as cell separators, so the row rendered with its landed path and card in the wrong columns.

**Result.** The four pipes are now escaped as `\|A\|` and `\|B\|`; the row reads seven cells and the check passes on all 24 rows (exit 0, no output). No other row failed: every landed path exists, every licence is allowed, every copy's NOTICE block names its source and a landed path.

**Consequence.** A cell that needs a pipe escapes it; the check reports an unescaped one by its cell count.
