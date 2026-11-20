---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/journal.ts
  - packages/runner/test/rv6.test.ts
supersedes: none
---

**What.** A refused merge left a folder an unsharded `RESUME=1` accepted: the reviewer got 4 rows for 3 sessions, one of them twice (review P60-3).

**Why.** The merge wrote the concatenated files and `run.json`, under the unsharded identity, before reading them back and sealing them; a refusal removed only `summary.json` and `usage.json`.

**Result.** `run.json` is written only once `checkSealed` passes, and closing a merge that did not seal removes every merged file. Tested on an overlap refusal and on a shard that lost a session: no `run.json`, `results.jsonl`, events or usage files remain, and an unsharded resume starts with 0 sessions. Keeping the files on close fails the test.

**Consequence.** A failed merge can be rerun or the folder used afresh; it never stands for a run.
