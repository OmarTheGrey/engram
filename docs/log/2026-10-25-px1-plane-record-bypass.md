---
date: 2026-10-25
author: claude-agent
type: change
card: PX1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane.ts
  - packages/core/test/unit/plane/bypass.test.ts
  - "pnpm --filter core test"
supersedes: none
---

**What.** The Plane gained `recordBypass(actor, { command, store }, at)`, which appends one `bypass_blocked` deny event with policy_id `engram/bypass/store-command` and a reason naming the store command.

**Why.** The first PX1 commit appended bypass events from the extension with core's appendEvent, outside the Plane; AGENTS.md rules 1 to 3 want every decision decided and logged by the Plane.

**Result.** Two unit tests, written first and failing on the missing method, now pass: one event per call, the fields above, no adapter write and no projected item.

**Consequence.** The extension calls Plane.recordBypass; the store-command list stays extension configuration, as ADR 0014 calls it a configured list.
