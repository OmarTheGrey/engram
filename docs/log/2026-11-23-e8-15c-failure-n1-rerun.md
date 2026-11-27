---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/forms.ts
  - packages/cli/test/tui/rerun.test.ts
supersedes: none
---

**What.** The review fix pass made r on a generated result run on another log and store than the command line chose: with no log in the workspace it created `<home>/.engram/engram.db`, the user's real default log, while the command row still showed the chosen one.

**Why.** To rerun as the actor now, `rebuildArgv` rebuilt the whole line from the workspace, dropping every workspace flag of the line that ran, `--db` and `--root` among them, not only the actor's. No test ran r on a line whose flags differed from the workspace's.

**Result.** Fixed by N1 (decision-rerun-and-actor): `rerunArgv` keeps the line and replaces only `--owner`, `--as`, `--level` and `--member`, and only when another actor made the answer. `rerun.test.ts` holds it; mutations swapping always, or swapping `--db` and `--root` too, fail it.

**Consequence.** A rerun is tested on a line whose log and store are not the workspace's.
