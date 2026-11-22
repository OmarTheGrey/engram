---
date: 2026-11-22
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The lead-owned invariants file gains `export` in its list of Plane methods, with a check that an outsider's export carries nothing of a scope it cannot read.

**Why.** A new Plane method must be classified there, or the surface test fails; the convention asks a second reviewer and a `decision` entry for any change to the file.

**Result.** Two additions, no assertion weakened. `make test-invariants`: 18 of 18 pass.

**Consequence.** A second reviewer reads the change before merge.
