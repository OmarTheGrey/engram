---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/consent.ts
  - packages/core/test/unit/policy/consent.test.ts
supersedes: none
---

**What.** Consent judges every write that puts content into the scope or makes it live: a first write in any status, a move into the scope, new content (a retire carrying it too), and the same content made more live (an un-retire; candidate to active, in place or by ADR 0049's acceptance). A same-content rewrite in place that makes it no more live passes.

**Why.** A person must always be able to retire old content; exempting every retired write let covered content in (failure entry). Candidate to active counts, as the orchestrator decided: it makes content live.

**Result.** Limits: a window is judged when a write reaches the plane, so what Incognito produces and a later adoption or distillation writes is judged then; the pi session tree is not under the gate.

**Consequence.** An owner cannot accept a covered candidate while its opt-out holds.
