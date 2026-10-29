---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/letta.test.ts
  - packages/server/src/workspace.ts
supersedes: none
---

**What.** `engram write --store letta --root <new folder> --db "postgres://u:p@[bad/db"` exited 2 for the bad `--db` but left a git-initialised folder behind (review finding I-1).

**Why.** `openWorkspace` built the store before it checked the log's flag, and `deferLettaAdapter` started `createLettaAdapter` when it was built, so the folder was created and initialised in the background while the usage error was printed.

**Result.** Both orders changed: `dbTarget` runs before `openStore`, and the deferred adapter opens on its first call. The CLI test now finds the `--root` folder still missing after the refused command, and an adapter test shows a deferred adapter creates nothing until it is called; making the open eager again fails that test.

**Consequence.** A surface's usage errors leave every store untouched.
