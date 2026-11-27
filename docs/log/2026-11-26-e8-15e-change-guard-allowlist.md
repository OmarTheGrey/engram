---
date: 2026-11-26
author: claude-agent
type: change
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/src/tui/screens/rich.ts
  - packages/view/src/view.ts
  - "ENGRAM_OFFLINE=1 ENGRAM_PG=skip pnpm exec vitest run packages/cli/test/tui packages/view packages/ui packages/cli/test/view-deps.test.ts packages/cli/test/who-can-read.test.ts"
supersedes: docs/log/2026-11-26-e8-15e-change-verification-n1.md
---

**What.** The no-policy guard is now an allowlist of uses of decision text, by the coordinator's decision. Before, it was a list of forbidden operations.

**Why.** A second verification bypassed it 20 times in 26 (N1 to N26). It also rejected four legitimate patterns.

**Result.** Decision text may only be drawn through helpers resolved by symbol, measured, re-laid, carried under its own name, compared with "", kept or returned. `findInReasons` and its one call are pinned by text. Views and screens got simpler: who-can-read carries its closed rule and dormant grants raw, the item page draws panes through `paneBox`, and Policy takes the check's answer. All 26 bypasses fail as probes; FP1 to FP4 pass. The inspector's reach line is singular for one (`reachText`), and `--work` takes only `.engram/tui-screens/` or an `engram-tui-screens-*` temp folder.

**Consequence.** The header lists the guard's known limits. Review remains the check.
