---
date: 2026-11-28
author: claude-agent
type: change
card: X18
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/governance-faults/inject.ts
  - packages/bench/scripts/governance-faults.ts
  - packages/bench/test/governance-faults/inject.test.ts
  - make test-one T=packages/bench/test/governance-faults/inject.test.ts
supersedes: none
---

**What.** The paired fault-injection check of proposal U6: `checkBase` builds one LongMemEval base as card B5 writes it (preset medium, the fake store, the hash chain kept), reads it as C5 reads it, then runs an unedited control copy and six fault copies (deletion, temporal supersession, missing metadata, each at the projection and in the log) through the corrupted read, the deterministic lints, verifyChain and the enforced read.

**Why.** Card X18: U6's state-recovery number, paired and model-free, beside H3 (whose recovery is utility, C6 minus C5), after Governance-State Corruption (2610.30698, idea only, nothing copied).

**Result.** Ten tests on the vendored subset pass (`Tests  10 passed (10)`). Two mutants were killed: dropping the projection's rebuild fails the replay-property test, and a deletion log fault that edits nothing fails the verification and change tests.

**Consequence.** The entry script feeds `research/scripts/h3_fault_injection.py`. New files only: no B5 fixture, cassette or registered config is touched.
