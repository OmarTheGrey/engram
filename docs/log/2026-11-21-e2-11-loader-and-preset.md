---
date: 2026-11-21
author: claude-agent
type: change
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/policies/medium-trust.yaml
  - packages/core/test/unit/policy/load.test.ts
  - "make test-one T=packages/core/test/unit/policy/trust-registered.test.ts"
supersedes: none
---

**What.** The loader admits `on` for both trust options, and a new bundled preset, `medium-trust`, is medium with both on.

**Why.** ADR 0040, decision 6: opt-in, off in the registered presets, on in a new one.

**Result.** The `trust` entries left `NOT_ENFORCED_YET` (the key stays, for the YAML 1.1 quoting hint). `medium-trust` is reached through `loadPreset` and a new `EXTRA_PRESETS` list, never `PRESETS`, which the runner's configs and the registered scripts take; a test asserts it differs from medium only in its id, its trust block and `external` in person scope.

**Consequence.** No config can name it as a condition. A card that wants it in `engram serve` or the runner adds it there.
