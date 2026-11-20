---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/live.ts
  - packages/runner/test/rv6-upstream.test.ts
supersedes: none
---

**What.** A pinned and an unpinned live run of one config and model shared the default live cassette folder, so a fresh `LIVE=1` under a new pin replayed answers another upstream gave (review P60-4).

**Why.** The routing is outside the cache key by decision, and the default folder named the model only; the earlier decision entry named the risk and left it to the operator.

**Result.** The default folder of a pinned config is `cassettes-upstream-<12 hex>`, a hash of the pin in canonical JSON; an unpinned run keeps `cassettes`. Tested: unpinned, two pins and a reordered pin give three folders, and a replay reads the pinned run's. Always naming `cassettes` fails it.

**Consequence.** A pinned run never replays another upstream's answers from the default folder; an explicit `--cassettes` is the caller's.
