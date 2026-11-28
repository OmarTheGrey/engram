---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook-install.ts
supersedes: none
---

**What.** The installer knows its own entries by their command strings (`engram` or a `main.ts`, then `hook <harness>`), replaces them in place and leaves the other harness's entry alone.

**Why.** The idea taken from obsidian-second-brain: track one's own command strings rather than a marker key the harness would reject (Codex's hooks file denies unknown fields).

**Result.** A hand-written `engram hook codex` entry is replaced by the installed one, never duplicated.

**Consequence.** A user's deliberately different engram hook entry is replaced; the backup keeps it.
