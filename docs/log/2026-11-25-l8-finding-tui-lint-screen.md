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
supersedes: none
---

**What.** The TUI's Lint screen on `cliupgrade` (`LintScreen`, packages/cli/src/tui/screens/policy.ts on that branch) calls POST /api/v1/lint, so it gets the filtered reach with no change.

**Why.** The addendum asks for a finding whenever a change alters what a TUI screen shows.

**Result.** The LintReport JSON shape is unchanged. Some findings differ: a ref to a retired item reads "names no active item you can reach", not "names an item retired by <rule>"; a retired or candidate source raises no source-changed; refused items are never a subject. That branch's Lint test lints `duplicate.flag.json` under its own policy, and its findings are the same under both reaches.

**Consequence.** The TUI need not follow. Enter on an expired-validity finding still opens an item that read refuses, as before.
