---
date: 2026-11-25
author: claude-agent
type: finding
card: L8
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
  - packages/server/src/routes.ts
supersedes: docs/log/2026-11-25-l8-finding-tui-lint-screen.md
---

**What.** The full list of what the TUI's Lint screen on `cliupgrade` sees change. The screen calls POST /api/v1/lint, which takes the default reach.

**Why.** The review (L8-3) found the first list incomplete.

**Result.** The LintReport JSON shape is unchanged. What changes:
- A ref to a retired or candidate item, or one behind a lapsed grant, reads "names no active item you can reach", never "retired by".
- Such a source, or a dated one, raises no source-changed.
- Refused items are never a lint's subject.
- A lineage id naming an item of another scope retired by supersession is now an orphan.
- A ref to a dated item of the linted scope stays no orphan, as before.

That branch's Lint test (`duplicate.flag.json`) is unchanged under both reaches.

**Consequence.** The TUI need not follow.
