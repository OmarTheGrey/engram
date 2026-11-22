---
date: 2026-11-21
author: claude-agent
type: change
card: E9.8
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/portable.ts
  - packages/core/test/unit/portable.test.ts
  - packages/server/src/routes.ts
  - packages/server/test/contract.test.ts
  - docs/bundle.md
  - "make test-one T=packages/core/test/unit/portable.test.ts"
supersedes: none
---

**What.** `engram export` writes the actor's memory bundle: JSONL, a header line then one row per item with its decision events, chosen by core's new `bundleRows` and served by a new route, `POST /api/v1/export`.

**Why.** Card E9.8, step 1: a person's memory should not be locked into Engram, and the selection is a read-matrix rule, so it belongs in core (AGENTS.md rule 1).

**Result.** The portable unit test passes 5 of 5; the contract test 28 of 28 with the export route hit. Removing the person-scope clause fails 2 of the 5 (mutation check). The format is versioned and documented in docs/bundle.md, linked from `engram --help`. `make api` regenerated sdk/ and packages/ui/src/api.

**Consequence.** Cards E2.13, E8.12 and E8.14 also add routes; whoever merges last reruns `make api`.
