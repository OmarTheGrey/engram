---
date: 2026-11-21
author: claude-agent
type: change
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/episode.ts
  - packages/core/src/distill/scrub.ts
  - packages/runner/src/recorder.ts
  - packages/runner/test/session-shapes.test.ts
  - "make test-one T=packages/runner/test/session-shapes.test.ts"
supersedes: none
---

**What.** The review fix pass of card D1 addresses four important findings and five minor ones. The parser now handles nested branches and pi's `context_edit` entries and reads every version of 3 or more. The scrub redacts more forms. Items are valid from the recording time. pi's SessionManager now writes eight tree shapes that are compared against the parser. The fixtures carry pi's recovery from a length cut.

**Why.** The independent review of the branch reproduced each finding with a probe.

**Result.** Tests pass: episode 25, scrub 27, bypass 24, recorder 7, fixtures 53, shapes 26. `bypassAttempt` and `redactSecrets` give byte-identical output on a 23-case corpus before and after the change. Mutations of the nested claim, the edit reading and the valid time each fail their tests.

**Consequence.** Card D2 reads `left_from`, `context`, `omitted`, `started_at` and `ended_at` in the episode.
