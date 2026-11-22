---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/src/time.ts
supersedes: docs/log/2026-11-21-e2-12-decision-instant-encoding.md
---

**What.** The instant stays two Longs, epoch seconds and nanoseconds, not Cedar's `datetime`. The encoder now also refuses an instant no calendar has, such as `2026-13-01T00:00:00Z`, which it had encoded with `s: NaN` (review finding E2.12-5).

**Why.** The decision stands: `datetime` keeps milliseconds, and the evaluator compares at full precision. The superseded entry's "seven failing tests" for dropped nanoseconds came from a run of uncommitted code.

**Result.** On the code after the fix pass, dropping the nanoseconds fails 7 tests and truncating to microseconds fails 5. The review measured 4 for the microsecond mutant on the earlier code. Either count comes from a scratch mutation script; neither is a committed result.

**Consequence.** Calendar checks reuse the schema's `Timestamp`, so the encoder and the plane refuse the same strings.
