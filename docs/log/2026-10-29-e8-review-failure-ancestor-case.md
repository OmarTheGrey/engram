---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass/paths.ts
  - docs/decisions/0022-other-harnesses-through-mcp.md
supersedes: none
---

**What.** The R3-2 fix guarded the protected files but not the folders that hold them, so deleting or moving a whole folder (`rm -rf ~/.engram`, `rm -rf .claude`, `mv .claude x`) removed the audit log or the hook unchecked.

**Why.** The path check asks whether a path is inside a root; for a file root, only the file itself and its sidecars matched, and the tests named only files, never their folders.

**Result.** Found by the verification of the fix pass. `ancestorOfRoot` in core now treats a folder holding a protected file as a hit, below the project and home folders only, with tests for the three commands.

**Consequence.** A guard over a file is tested against its folder as well as the file.
