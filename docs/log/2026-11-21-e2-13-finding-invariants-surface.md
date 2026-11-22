---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - make test-invariants
supersedes: none
---

**What.** The lead-owned invariants file was changed: invariant 1's Plane surface check lists `whoCanRead` and `whoCanReadItem`, and has the outsider ask both about the secret.

**Why.** The check fails on any unclassified Plane method ("a new Plane method must be classified here"), as card E9.4 met with `changeGrants`.

**Result.** The outsider's item answer equals the unknown id's answer but for the id, carries neither the secret nor its scope, the scope answer is refused, and no event is appended. Nothing was weakened. `make test-invariants`: 17 of 17 pass.

**Consequence.** For the lead's review of the invariants file.
