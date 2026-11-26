---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15a
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/registry.ts
  - packages/cli/test/registry.test.ts
supersedes: none
---

**What.** HOME and USERPROFILE join the `env` of every command whose log defaults to `<home>/.engram/engram.db`: the plane commands, serve, hook, doctor and both log commands (review finding E8.15a-13).

**Why.** main.ts finds the home with `os.homedir()`, which reads HOME, else USERPROFILE on Windows, so those commands read both for their default log; the TUI's workspace screen shows each variable a command reads.

**Result.** The registry test now asserts that every entry whose `--db` default names `<home>` lists both: 45 passed. Mutation: serve without them fails it. Key lists none, since it opens no log.

**Consequence.** None.
