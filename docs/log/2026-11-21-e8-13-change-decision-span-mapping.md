---
date: 2026-11-21
author: claude-agent
type: change
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/export/otel.ts
  - packages/core/test/unit/export/otel.test.ts
  - "make test-one T=packages/core/test/unit/export/otel.test.ts"
supersedes: none
---

**What.** Card E8.13 adds `decisionSpan` and `exportedReason` in `packages/core/src/export/otel.ts`: a pure mapping from a MemoryEvent to an OpenTelemetry span's name, ids, times, status and attributes, as plain data, and `eventsAfter` and `lastSeq` in `events.ts` for the export's cursor.

**Why.** Decisions should appear in an organisation's observability stack without any memory content leaving the machine (rule 12).

**Result.** The acceptance test runs over all nine ops, hand-built with a secret in every item field and in the reason, and over a real Plane log of every op with the secret in content, queries and a bypass command; no attribute holds the content, a sha256 run, a path or the secret. 38 tests pass. Mutation: exporting `event.reason` raw fails 3 of them. Core gains no dependency.

**Consequence.** The sinks build on it.
