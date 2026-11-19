---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: docs/log/2026-11-19-e2-6-review-decision-withdraw-own-adoption.md
---

**What.** A stale writer withdraws an adoption of its bytes only while it is the item's last allowed change; otherwise the plane removes the grants that adoption reintroduced (`engram/adopt/narrowed`) and the writer's deny names them, never putting an older version back.

**Why.** The design rule: recovery never undoes an owner's committed decision, and when it cannot tell whose bytes are whose it narrows. A hand edit and a stale write look alike, so only the grants the version before lacked are taken away.

**Result.** V2, V3 and V9 pass; disabling the narrowing or withdrawing over a later change each fails them.

**Consequence.** An edit the stale bytes carried, built on since, stays; only its grants go.
