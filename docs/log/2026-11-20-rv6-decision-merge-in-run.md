---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/run.ts
  - packages/runner/src/shard.ts
supersedes: none
---

**What.** The merge is `make run CONFIG=<arm> MERGE=n` (with `MODEL=` and `REPLAY=1` for a live run), writing a normal run folder, not a step inside `h1-sessions.ts` as the review suggested.

**Why.** `make h1-table` reads a run folder's summary.json, usage.json and results.jsonl; a merged folder of the same shape keeps it unchanged, serves H2's LongMemEval runs and MEM-INV-Bench too, and lets REPLAY, RESUME and the fingerprint checks work on it as on any run. Recomputing the summary needs each benchmark's own summariser, which the runner pass already calls.

**Result.** A merge runs the runner over a sealed journal: no session runs and no call is recorded. MEM-INV-Bench's per-case agent notes are replayed from the cassettes in that pass, so the merge machine needs every shard's cassettes. `MERGE=` is refused with `LIVE=1`, `COUNT=1`, `RESUME=1` or `--record`.

**Consequence.** h1-sessions.ts is unchanged.
