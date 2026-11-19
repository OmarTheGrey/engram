---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/grants.ts
  - packages/core/test/unit/plane/grants.test.ts
supersedes: none
---

**What.** A grant change on a retired item is refused (`engram/grant/status`), and so is an added grant whose expiry is at or before the change's time (`engram/grant/expired`).

**Why.** The retired-content rule (ADR 0025, `retiredContent` in `packages/core/src/plane/write.ts`) judges an item by the event that last changed it; an `update` after the retire would hide that a retire event retired it, so its content could be restated by a model. An expired grant would never admit a read, so accepting it would only record a mistake as consent.

**Result.** Both are one deny event with nothing changed, tested on the real Plane.

**Consequence.** A grant on an item retired later stays on it, harmless, since only active items are read.
