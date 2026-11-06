---
date: 2026-11-06
author: claude-agent
type: decision
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/model/cached.ts
  - scripts/check-log.ts
  - "make lint-docs"
supersedes: none
---

**What.** `packages/runner/src/model/cached.ts` stays as a one-line re-export of `@engram/model`, and `packages/runner/test/model/cached.test.ts` stays in the runner, after the cache moved to `@engram/model` (ADR 0032).

**Why.** Three entries of 2026-10-22 cite both paths as evidence (`2026-10-22-s0-10-model-call-layer.md`, `2026-10-22-runner-usage-offline-assistant.md`, `2026-10-22-step-0-review-fixes.md`). Entries are immutable, and `scripts/check-log.ts` checks the evidence of every entry, superseded or not, so a superseding entry would not clear the failure. After the move, `make lint-docs` failed with five missing evidence paths.

**Result.** With both paths kept, `make lint-docs` passes.

**Consequence.** Moving a file that a log entry cites keeps a re-export or the file at the old path. This holds for any later move.
