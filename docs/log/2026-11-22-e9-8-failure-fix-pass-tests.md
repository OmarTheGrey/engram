---
date: 2026-11-22
author: claude-agent
type: failure
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/test/import-export.test.ts
  - packages/core/test/unit/portable.test.ts
supersedes: none
---

**What.** Three first runs of the fix pass failed: `--policy medium-trust` is refused by the CLI, which names only the registered presets, an expected event count was miscounted (4 for 5), and two shell heredocs holding backticks broke edits again.

**Why.** The tests were written before the commands ran once; the brief warns about heredocs.

**Result.** The trust test names `packages/core/policies/medium-trust.yaml` as a file, the count is 5, and the edits were redone with the Edit tool and script files.

**Consequence.** None for the code.
