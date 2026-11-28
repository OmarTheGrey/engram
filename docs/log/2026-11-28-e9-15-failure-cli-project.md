---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.15
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/cli/test/commands.test.ts
  - packages/cli/test/parity.test.ts
  - pnpm exec vitest run --project @engram/cli
supersedes: none
---

**What.** The whole CLI project, run once after merging main through #164, failed 3 of 1,098: two help-text tests and the leak suite's coverage test.

**Why.** Main's #164 added a literal copy of HELP to `commands.test.ts`, and card E8.16's leak suite requires every command to have a probe or a listed exemption; neither named the two audit commands, and the per-file runs had not reached those files.

**Result.** The literal was regenerated from `engram --help` (the diff is the audit commands' two list lines and two sections only) and both commands were listed as exemptions with their reasons; the project then passed, 58 files, 1,097 passed, 1 skipped.

**Consequence.** A new command needs those two files as well as the registry's.
