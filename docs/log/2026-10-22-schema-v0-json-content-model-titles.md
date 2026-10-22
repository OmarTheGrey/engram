---
date: 2026-10-22
author: claude-agent
type: change
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - sdk/schema/JsonValue.json
  - fixtures/schema/MemoryItem/valid/model-written.json
  - packages/core/test/unit/schema-content.test.ts
  - research/tests/test_engram_types.py
  - "make api-check"
supersedes: none
---

**What.** Schema v0 changed in three ways from the final step-0 review: structured content must be JSON (a shared `JsonValue` definition exported beside the contracts), `Provenance` gains the optional `model` that ADR 0004 lists, and every exported schema carries a title so the generated Python types are named after their contracts.

**Why.** A Date or NaN in content changed on storage; ADR 0004's accepted option named a field the schema lacked; two generated types were called `Model`.

**Result.** New tests failed first and pass: content values JSON cannot carry are rejected, a model-written fixture validates in Zod and JSON Schema, and each Python module defines its contract's name.

**Consequence.** `schema_version` stays 0: v0 was never released or persisted, so no migration exists to write. The next change after a release bumps it.
