---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/errors.test.ts
supersedes: none
---

**What.** Tooling failures on the way: inline Python and heredoc edits broke on quoting or were refused by the worktree guard, the mutation script crashed printing test output on the Windows console encoding, and the first no-store test used the fake store and so wrote successfully.

**Why.** Shell quoting of multi-line edits with apostrophes is fragile on this machine (the brief warns of it); Python's default stdout encoding is cp1252 there; the test helper always built a fake adapter.

**Result.** Edits moved to the Edit tool and script files, the mutation script reconfigures stdout to UTF-8, and the no-store test builds its workspace with `NO_STORE`.

**Consequence.** Mutation checks were rerun with the fixed script; each verdict in the PR is from that rerun.
