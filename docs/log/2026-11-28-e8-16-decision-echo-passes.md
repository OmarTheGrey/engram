---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage.test.ts
  - packages/mcp/test/leakage.test.ts
  - packages/cli/test/parity.test.ts
supersedes: none
---

**What.** Each actor's probes run in three passes: calls naming no id first, with no id allowed in any answer; then each call naming ids, which may echo only its own; then the first calls again, which may echo the ids the actor's own events named, never a nonce.

**Why.** A probe that names a canary id makes the actor's own events name it; exempting every id asked so far hid a real leak (failure `2026-11-28-e8-16-failure-asked-ids-hid-a-leak.md`).

**Result.** The mutation that showed team:x events to every actor now fails 12 tests across HTTP, the CLI and the TUI.

**Consequence.** Probes take three times as long; the four files run in about 40 seconds.
