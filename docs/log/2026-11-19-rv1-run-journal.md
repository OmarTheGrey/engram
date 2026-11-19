---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/journal.ts
  - packages/runner/scripts/run.ts
  - packages/runner/test/rv1.test.ts
  - "make run CONFIG=<file> ... RESUME=1"
supersedes: none
---

**What.** Every session run of `make run` (GateMem, MEM-INV-Bench, LongMemEval) is journaled: each row is appended to results.jsonl as its session ends and each call's usage to usage.jsonl as it returns, and `RESUME=1` continues the run in the output folder (review findings RV-EXP-1 and RV-EXP-2).

**Why.** results.jsonl was written only at the end, so a crash lost every finished session, and a restart replayed every recorded call.

**Result.** In `packages/runner/test/rv1.test.ts`, a run that crashes after its second of three sessions keeps two rows; after a half-written line is appended, the resume cuts it, runs only the third session (two cached calls), and writes results.jsonl, events.jsonl and summary.json byte for byte as the uninterrupted run. A resume refuses a folder another config wrote (`run.json` holds a fingerprint without paths and the spend ceiling).

**Consequence.** A live H1 run that dies loses at most the session in flight.
