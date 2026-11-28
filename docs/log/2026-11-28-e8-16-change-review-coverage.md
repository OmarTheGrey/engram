---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage.test.ts
  - packages/mcp/test/leakage.test.ts
  - packages/cli/test/parity.test.ts
supersedes: none
---

**What.** Every probed route must make a call and answer at least once with something other than 400; every MCP tool at least once with something other than an invalid-arguments refusal; every probed command must run; the CLI's runnable exemptions (log verify, log checkpoint, key list, and E9.10's new discover) are run on the canary workspace and must show no canary.

**Why.** Review finding 7, and E9.10's `discover`, which the coverage check caught as unprobed after the merge.

**Result.** All hold; discover counts a CLAUDE.md holding a canary's content without printing it.

**Consequence.** A malformed probe, or an exemption whose reason stopped holding, fails the suite.
