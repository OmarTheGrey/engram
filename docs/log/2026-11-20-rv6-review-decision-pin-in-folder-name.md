---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/live.ts
supersedes: docs/log/2026-11-20-rv6-decision-upstream-not-keyed.md
---

**What.** The pin goes into the default live cassette folder's name, not into the cache key, and a cassette hit is not checked against the pin.

**Why.** Refusing a hit whose recorded upstream is outside `only` or `order` would leave cassettes with no upstream (every one recorded so far) unjudgeable, and would apply only with `allow_fallbacks: false`. A folder per pin keeps keys and old cassettes unchanged and needs no rule about what a hit may carry.

**Result.** Unpinned configs keep their folders, so every recorded run replays as before. Changing a pin means a new folder, and so new calls.

**Consequence.** Supersedes the consequence of the upstream-not-keyed decision: the default folder now names the pin.
