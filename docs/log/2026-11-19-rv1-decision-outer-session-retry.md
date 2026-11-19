---
date: 2026-11-19
author: claude-agent
type: decision
card: RV1
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/model/retry.ts
  - packages/runner/scripts/run.ts
supersedes: docs/log/2026-11-19-rv1-decision-one-retry-layer.md
---

**What.** A live `make run` retries a whole session that stopped on a `TransientCallError`, up to six runs, waiting 30 s, 1, 2, 4 and 5 minutes; inside a session each call keeps the benchmark client's own retry, and pi's auto-retry stays off.

**Why.** Of the review's two options (an outer backoff, or documenting the resume) this one keeps a multi-day run going through an outage of about 12 minutes without a person. It is outside every cache key: the session's rerun replays its recorded calls and makes only the one that failed, so the call-level policy stays upstream's.

**Result.** The test runs three 503s through to a completed row after one outer wait. Replays and pipeline runs get no outer retry. `Retry-After` is not honoured, as neither upstream client honours it.

**Consequence.** A longer outage still stops the run; `RESUME=1` continues it.
