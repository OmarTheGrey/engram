---
date: 2026-10-29
author: claude-agent
type: decision
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - packages/cli/test/doctor.test.ts
  - "make engram ARGS=doctor"
supersedes: none
---

**What.** `engram doctor`'s benchmark pins check now verifies a candidate benchmark's vendored fixture against the commit in PINS.md's candidates table, and reads a manifest's `files` map of line hashes beside GateMem's `selection`.

**Why.** The card asked doctor to cover the MEM-INV-Bench fixture while keeping the rule that only the registered table holds pins; MEM-INV-Bench stays a candidate until the pre-registration registers it.

**Result.** Doctor reports "6 benchmarks, 5 pinned" as before and "mem-inv-bench 24 lines at cf3c9a4 (candidate, not registered)"; an edited line and a moved candidate commit each fail, and disabling the files check fails three tests.

**Consequence.** When the pre-registration registers the benchmark, its row moves to the pinned table and the same fixture is checked as a pin.
