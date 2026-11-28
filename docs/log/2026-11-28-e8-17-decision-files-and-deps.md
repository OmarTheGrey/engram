---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/hook-install.ts
  - packages/cli/src/harness-settings.ts
  - docs/deps.md
supersedes: none
---

**What.** The installer is a new file, `packages/cli/src/hook-install.ts`, not `setup.ts`; the harness list and the Codex home moved to `harness-settings.ts`; `ajv` 8.20.0 (already core's) became a dev dependency of packages/mcp to validate against Codex's draft-07 schemas.

**Why.** `setup.ts` holds what a plane command assembles; the TUI's confirmation needs the installer's target without loading the MCP package; validating against the copied schemas needs a validator.

**Result.** No new package version enters the lockfile; deps.md's ajv row names the new use.

**Consequence.** None beyond the card's file list growing by one file.
