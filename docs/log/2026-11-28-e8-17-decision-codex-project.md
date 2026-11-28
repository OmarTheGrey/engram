---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook.ts
  - packages/cli/test/hook-codex.test.ts
supersedes: none
---

**What.** Codex's hook resolves `--root` and a relative `--db` against its own cwd, not the input's `cwd`.

**Why.** Codex starts a hook in the session's folder and exports no project variable; the input's `cwd` is the tool's, which may be a subfolder (`codex-rs/hooks/src/events/pre_tool_use.rs`, `command_input_cwd`).

**Result.** A tool running in `src/` still has `memory/` resolved as the project's (a test holds it). The installer writes absolute paths, so an installed entry does not depend on it.

**Consequence.** If Codex changes where it starts hooks, a relative root in a hand-written entry would point elsewhere; installed entries are unaffected.
