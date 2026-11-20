---
date: 2026-11-20
author: claude-agent
type: change
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook.ts
  - packages/cli/test/hook.test.ts
  - packages/mcp/test/hook.test.ts
supersedes: none
---

**What.** `engram hook claude-code --protect <file>` guards a log the hook cannot infer, with its SQLite companions, and a test holds the hook's `source: "model"` override (findings RV-SRF-9 and RV-SRF-8).

**Why.** With `--server` the hook takes no `--db`, so it guarded the default log rather than the one `engram serve --db` names; and the review's mutant removing the override survived.

**Result.** With `--server` and `--protect`, a Write to the named log or its `-wal`, `-shm` or `-journal` file is denied (the block unrecorded while the server is down, still a deny); without the flag the same Write goes on, as before. The source test fails with the override removed.

**Consequence.** `docs/dogfood.md` tells a member serving another log to pass `--protect`.
