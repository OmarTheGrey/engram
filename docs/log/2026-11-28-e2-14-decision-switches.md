---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.14
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - docs/tasks/E2.21.md
  - docs/tasks/L9.md
supersedes: none
---

**What.** `lints.model.evidence` and `grants.expiry_cap` are `off` or `on` switches (a new `OptionSwitch` enum), and `erasure.mode` is `redact` or `shred`.

**Why.** The plan calls evidence and expiry_cap switches; E2.21 fixes the cap at 365 days, so no number is needed. `erasure.mode`'s values are the card's. The words follow ADR 0040's switches, so YAML 1.1's on and off get the same quoting hint, which the loader now gives for every option block.

**Result.** `OptionSwitch`, `ModelLintOptions`, `GrantOptions`, `ErasureOptions` in the schema; the quoting hint is tested for both switches.

**Consequence.** A configurable cap would be a second schema pull request.
