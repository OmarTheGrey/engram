---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/pi-package/profiles/twin.yaml
  - docs/decisions/0049-owner-accepts-in-own-person-scope.md
supersedes: none
---

**What.** Opt-outs are declared in the policy document, which for Twin is the person's own profile file on their own machine; the plane records which policy and version decided, not who wrote the opt-out, and no command declares one.

**Why.** E2.14's gap (c). The card names no command and no ADR; the twin dogfood runs one person's policy on one machine, the trust boundary ADR 0049 states for the CLI.

**Result.** Every refusal names the policy id and the opt-out's index, so a refusal can be traced to the file line. Who edited the file is outside the plane, as for every other policy field.

**Consequence.** On a shared server a person cannot yet declare their own opt-outs; a later card would need a per-person consent record with its own events (a finding).
