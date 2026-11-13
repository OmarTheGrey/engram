---
date: 2026-11-13
author: claude-agent
type: change
card: E8.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - fixtures/workloads/e8-9-two-presets.json
  - docs/decisions/0032-simulator-replays-recorded-calls.md
  - sdk/openapi.json
  - "make api-check"
  - "make test-invariants"
supersedes: none
---

**What.** Main, now at schema version 1 (PR #29) and with cards E9.1, E9.2 and E9.7, was merged into the E8.9 simulator branch: the workload fixture's items moved to version 1, `make api` added `external` to the workload actor's source enum, and ADR 0032 gained a line that its fourth context point no longer holds.

**Why.** Schema version 1 puts the returned item ids on read events, so utility is decided from the log alone; the simulator's comment and ADR said otherwise. Three conflicts (architecture.md, plane/retention.ts, the interfaces test) took main's schema text and the branch's workload test.

**Result.** Core, CLI, server, MCP, pi-extension and scripts tests: 88 files, 1580 passed, 1 skipped. Biome and tsc clean.

**Consequence.** PR #28 is ready to merge on green CI; PR #32 (PX2) then rebases onto main.
