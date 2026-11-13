---
date: 2026-11-13
author: claude-agent
type: decision
card: PX2
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/decisions/0032-simulator-replays-recorded-calls.md
  - packages/pi-extension/src/replay.ts
  - packages/pi-extension/test/replay.test.ts
  - "pnpm --filter pi-extension exec vitest run test/replay.test.ts"
supersedes: none
---

**What.** Review of PR #32: each `engram.call` now names its policy's content hash, `sessionPolicy` accepts repeated identical `engram.policy` entries, and `replaySession` reports `policyDifference`.

**Why.** Two confirmed findings. pi recreates the extension's runtime on a resume or a fork (`AgentSessionRuntime.switchSession`, `fork`), so a resumed session held two `engram.policy` entries and `sessionPolicy` refused it ("holds 2 engram.policy entries; expected one"). And a call named its policy by id and version only, which the PX2 failure entry showed does not pin the rules: an `engram.policy` entry edited without changing a decision replayed clean.

**Result.** Six new tests in `test/replay.test.ts`; five failed before the fix, and breaking the hash lookup fails two. The acceptance file passes 17 of 17, pi-extension 230 of 230. The session fixtures were regenerated (`ENGRAM_UPDATE_FIXTURES=1`, the `make fixtures` pi-extension step); the `.expected.json` files did not change.

**Consequence.** ADR 0032 amended.
