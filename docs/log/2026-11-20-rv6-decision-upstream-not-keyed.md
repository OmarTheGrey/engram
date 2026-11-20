---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/model/src/cached.ts
  - packages/runner/src/model/upstream.ts
  - packages/runner/test/rv6-upstream.test.ts
supersedes: none
---

**What.** Neither the pinned routing nor the serving upstream is part of a cache key; the routing is part of the run's fingerprint, and the upstream is stored beside the response.

**Why.** Rule 7's key is the item, condition, preset, store, model, seed and prompt hash. Keying on the routing would re-pay every recorded call when a pin is added; the upstream is known only after the call. The fingerprint holds every config field, so a resume or merge under another routing is refused.

**Result.** Old cassettes, with no `upstream`, replay with the same keys and ledger lines: every committed fixture replays with zero new calls (RV1's table).

**Consequence.** Two runs of one config under two pins share cassettes only if the lead keeps their cassette folders apart; the default folder names the model, not the pin.
