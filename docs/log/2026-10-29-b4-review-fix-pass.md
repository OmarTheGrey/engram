---
date: 2026-10-29
author: claude-agent
type: change
card: B4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0029-poisoning-arm-mem-inv-bench.md
  - packages/bench/src/mem-inv-bench/plane.ts
  - packages/runner/test/mem-inv-probe.test.ts
  - packages/cli/src/doctor.ts
  - fixtures/bench/mem-inv-bench/manifest.json
  - "pnpm --filter bench test"
supersedes: none
---

**What.** The fix pass of PR 6's B4 review (R6-1 to R6-10).

**Why.** The review found claims resting on the scripted reply, misstatements of ADR 0026, a derived kind without inheritance, label tests blind to `family` and `case_id`, unscored stop reasons, attribution gaps, and unhashed fixtures.

**Result.** Derived entries take their least trusted input's kind; refs name entries, not cases, and ids are drawn by a seeded shuffle; stop reasons reach the scorer; doctor hashes four files and checks `selection` beside `files`; the golden script checks the pin and records two rows on which upstream raises. New tests: family twin, canary id, `length` stop, derived kinds, doctor files. The two rewritten entries were unmerged when rewritten. Cassettes re-recorded by `make fixtures`.

**Consequence.** The B4 config now runs mib-13; the ADR 0029 amendments carry the corrected claims.
