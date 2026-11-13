---
date: 2026-11-13
author: claude-agent
type: finding
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/retention.ts
  - docs/decisions/0025-retention-semantics.md
  - "pnpm --filter core exec vitest run test/db/schema-v1.test.ts"
  - "make api-check"
  - "make test-invariants"
supersedes: none
---

**What.** Review of the schema version 1 PR (#29) against AGENTS.md rule 5.

**Why.** A schema PR may carry nothing but the schema, its version, its migration, `make api` and fixtures.

**Result.** The gate rules for `external` (untrusted, relearning, trust order) are required: without them the new kind would be trusted by default. Utility counting read events instead of explanation rows is a consumer change, behaviour preserving on an unrebuilt log, left in place for the lead to accept or split out. ADR 0025's amendment said reads are counted once per write meeting a utility budget; `decide` runs `retentionUsage` for any budget and every sweep, so the sentence was corrected. Migration 4 passes on SQLite and embedded Postgres; the newer-log refusal is unchanged. The 46 cassettes are `scripted/scripted-1`, zero cost.

**Consequence.** Nothing else changes in this PR.
