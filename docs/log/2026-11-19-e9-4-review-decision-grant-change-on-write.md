---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/property/grants.test.ts
supersedes: docs/log/2026-11-19-e9-4-decision-plane-write-grants-left-open.md
---

**What.** A rewrite through `Plane.write` is a grant change exactly when its grants differ from the projected item's as multisets (every field equal, the expiry as an instant); then only the owner may make it, and every grant it adds passes `grantDefect` at the write's time.

**Why.** Review finding I1 asked for this; the earlier entry left it open because it touches the lead-owned invariants file. A rewrite that only reorders or keeps the grants is no grant change, so an owner's or a member's ordinary content rewrite is judged as before.

**Result.** Every existing test passes unchanged (`make test`); the new property over rewrites saw rewrites that change grants and land, refusals by both rules, and rewrites keeping the grants.

**Consequence.** Supersedes the decision that left `Plane.write` open. ADR 0034, decision 6.
