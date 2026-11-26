---
date: 2026-11-26
author: claude-agent
type: decision
card: X21
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - packages/runner/src/research/h1-sessions.ts
supersedes: none
---

**What.** The session field is `capped`, a boolean on utility rows only, written by the converter only when true, and it is an optional field of `h1-sessions/2`, not a new `h1-sessions/3`.

**Why.** The card left both open. Version 2 already grew `exclusion` as an optional field, and a file without `capped` must keep parsing, as every committed test file and any earlier conversion does. A new version would move `sessions_schema` in every table, beyond the one key the card sanctions. `capped` is not an `exclusion` because the schema forbids an exclusion on a utility row and U already reads a null `utility_ok` as out. The schema refuses `capped` on any other row and refuses `capped: true` with a non-null `utility_ok`, so a capped session can never enter U. The converter sets it from the probe's `excluded: "turn limit"` exactly, not from any exclusion.

**Result.** A version-2 file without the field parses as before.

**Consequence.** If wrong, a version bump is one constant and the tests' `sessions_schema` assertions.
