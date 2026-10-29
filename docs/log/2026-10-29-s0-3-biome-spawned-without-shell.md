---
date: 2026-10-29
author: claude-agent
type: change
card: S0.3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/pi-import-rule.test.ts
  - scripts/test/fixtures-ci.test.ts
  - "pnpm exec vitest run scripts/test/pi-import-rule.test.ts"
supersedes: docs/log/2026-10-29-s0-3-pi-import-rule-spawn-timeout.md
---

**What.** pi-import-rule.test.ts now spawns the native Biome binary directly, with no shell and no wrapper, so its 30 s timeout kills Biome itself.

**Why.** The superseded entry left a limit: on Windows `pnpm exec biome` ran through a shell, and a timeout killed only the shell. Spawning `process.execPath` on @biomejs/biome's bin/biome would not close it either, since that Node script spawns the native binary in turn.

**Result.** The binary is resolved from the platform package that bin/biome uses. The timeout test now asserts that the killed process's path is that binary. It fails when the call goes through `pnpm` and a shell, through the Node wrapper, or has no timeout. The five tests pass.

**Consequence.** fixtures-ci.test.ts already spawns make without a shell, so its timeout kills make. The node that make's recipe starts may outlive make, and only bypassing make, the thing the test checks, would avoid that.
