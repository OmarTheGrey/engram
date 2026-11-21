---
date: 2026-11-21
author: claude-agent
type: change
card: E2.8
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - sdk/schema/Policy.json
  - research/engram_types/Policy.py
  - packages/core/test/unit/policy/presets.test.ts
  - fixtures/schema/Policy/valid/content-guards-and-trust.json
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/x1-h1-probe.json"
supersedes: none
---

**What.** The Policy schema gains the optional `content_guards` block (ADR 0039) and `trust` block (ADR 0040); `make api` regenerated the JSON Schema, OpenAPI, both TypeScript clients and the Python types. Nothing reads the blocks yet.

**Why.** Cards E2.9, E2.10 and E2.11 each need one of these options, and rule 5 puts the schema change in a PR of its own.

**Result.** Each preset parses to the sha256 it had on main (strict `dda81773...`, medium `d6da16ae...`, permissive `d2349a54...`); a mutation giving `trust` a default failed all three. The X1 suite replays offline with "model calls in all: 0 new, 109 from cassettes", so no committed cassette key moved. Four schema fixtures (one valid, three invalid) pass in Zod and JSON Schema alike. The lint id `injection-signature` needs no schema change: lint ids are free strings in every generated file.

**Consequence.** Card E2.10 adds its lint id in `packages/core/src/lint.ts` alone.
