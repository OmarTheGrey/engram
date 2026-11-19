---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.5
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Over the files adapter, the re-adoption that follows a plane write raises an agent-written item's provenance from `model` to `import`, and the gate then accepts its owner's grant on it.

**Why.** Card E9.4 found that plane writes are re-adopted once as `import`; for model content that re-adoption also defeats ADR 0021's decision D4, which refuses a grant on model content by the item's current kind.

**Result.** Seen first as a test failure: a grant on the agent's item, a day after its write, was allowed. A probe on a scratch folder: written as model, grant refused (`engram/write/grant`), one adoption (provenance now `import`), the same grant allowed. A promotion would read it as `import` too.

**Consequence.** A backlog row: adoption should keep the kind of a record the plane wrote. Until then the procedure says never to grant an agent-written item, and the report counts it under `watch`.
