---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/core/src/plane/read-reason.ts
  - packages/core/test/property/read-reason.test.ts
  - sdk/openapi.json
supersedes: none
---

**What.** A read by a plane with the core retrieval pipeline and a read limit records in its event's reason how many admitted items the limit cut: "returned 20 of 115 candidates; 0 filtered (...); 95 cut by the read limit; ...". Every other read's reason is unchanged. `ReadCounts` gains an optional `cut`, and `make api` regenerated the route contract and its clients.

**Why.** Under the pipeline the reason said "0 filtered" and lost the 95 items the limit dropped (review round 3, V-6).

**Result.** The property test round-trips counts with and without `cut`; a real capped read parses to its cut, an uncapped one to none. The event schema (`schema.ts`, `schema_version`, `sdk/schema`) is unchanged, so this is not a schema change under rule 5; the inspector still parses every reason, and does not show the cut yet.

**Consequence.** Audit data only, like `out_of_reach`; no surface answering a model passes it on.
