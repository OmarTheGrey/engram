---
date: 2026-11-22
author: claude-agent
type: change
card: L7
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/runner/src/lint-faults.ts
  - packages/runner/src/lint-fault-set.ts
  - packages/runner/test/lint-nli.test.ts
  - "make test-one T=packages/runner/test/lint-nli.test.ts"
supersedes: none
---

**What.** Both lint runners take an optional `nli` block; run.ts takes `--record-nli` (`make nli-scores`); `make nli-determinism` and `make h3-lint-nli` are new.

**Why.** The fixture runs need the tier on without touching any committed policy or cassette.

**Result.** The block enables the tier in a copy of the fixture's policy with its id kept, so the band's model calls are cache hits on the model tier's committed cassettes. h3-lint-nli-fixture replays with 0 new model calls (214 cached) and 0 new scores (452 cached); l3-lint-nli-fixture with 0 and 0 (9 and 72 cached). A config without the block writes what it wrote before. 7 runner tests pass.

**Consequence.** The commands are in AGENTS.md and CLAUDE.md. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
