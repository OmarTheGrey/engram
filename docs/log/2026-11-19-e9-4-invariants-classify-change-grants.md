---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The invariants file's Plane surface check now classifies `changeGrants`: an outsider asking for a grant on the secret item gets a refusal with no item and no scope, in the same words as for an id that names nothing.

**Why.** The check fails on any Plane method it does not classify, which `make test` showed once `Plane.changeGrants` landed; the testing convention makes any change to the file need a second reviewer and a decision entry, as card E8.9 did for `simulate`.

**Result.** The five invariants pass under `make test-invariants`, in 20.0 s. The file's oracles are unchanged; only the surface check gained the method.

**Consequence.** The PR asks the lead for the second review of this file.
