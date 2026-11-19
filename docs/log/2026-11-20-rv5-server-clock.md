---
date: 2026-11-20
author: claude-agent
type: change
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/contract.ts
  - packages/server/src/routes.ts
  - packages/core/src/plane/read.ts
  - packages/core/test/unit/plane/read-time.test.ts
  - docs/decisions/0027-http-contract-client-and-inspector.md
supersedes: none
---

**What.** The server stamps every event's ts from its own clock; only a read takes `at`, as a read-only `valid_at` that moves validity windows and nothing else (finding RV-SRF-2).

**Why.** A request's `at` was its event's ts, so a read backdated to before a grant's expiry returned the granted item and the dogfood report, judging the read at that ts, counted no violation.

**Result.** Eight non-read routes refuse a request naming `at` (400, no event). A read with `at` keeps ts at the server's clock and records the requested time in its reason. A backdated read after a grant expired returns nothing, and `dogfoodReport` counts 0 violations; an honest `valid_at` read inside an item's past validity window is 0 violations too, since the report now judges validity at the recorded time (`packages/core/test/unit/plane/read-time.test.ts`, 4 tests).

**Consequence.** ADR 0027 has a proposed amendment for the lead; `sdk/openapi.json` regenerated.
