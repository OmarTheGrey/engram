---
date: 2026-11-28
author: claude-agent
type: change
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook-install.ts
  - packages/cli/test/hook-install.test.ts
supersedes: none
---

**What.** The installed entry carries `--protect` with the absolute path of the file it is installed into, and for Codex the `config.toml` beside it; the installer refuses a linked or non-folder `.codex`, `.claude` or Codex home, refuses a linked backup path, never rewrites a backup, and writes through a temporary file renamed over the target.

**Why.** The review: Codex loads a `.codex/` layer from each folder up to the project root, so a session started in a subfolder left the project's files unguarded; and a linked folder or backup let a write leave the named files.

**Result.** 16 tests pass, 1 skipped (sh quoting on Windows); the junction-based refusals run on Windows. A second run still writes nothing.

**Consequence.** ADR 0022's amendment says so.
