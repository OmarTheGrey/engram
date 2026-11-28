---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - packages/cli/src/run.ts
supersedes: none
---

**What.** Doctor gains a fourth status, `warn`, padded to the same five columns, with `warned` in its JSON and `, N warning(s)` after its summary; doctor's walk is the current folder and the home, with `--root` as the only store root.

**Why.** Doctor had ok, fail and skip; the card says a warning, never a failure, and skip or ok would hide it.

**Result.** The existing doctor tests pass with the check's name added to the `--json` order (`packages/cli/test/doctor.test.ts`); "all checks passed" still begins every passing summary, so the TUI's Home strip and first-run flow read it unchanged.

**Consequence.** If wrong: a consumer that parses doctor's lines by the three old statuses skips the warning line. Cost: none found in the repository.
