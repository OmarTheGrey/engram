---
date: 2026-11-19
author: claude-agent
type: failure
card: L4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/adapters/test/letta/race.test.ts
  - packages/adapters/test/letta/commits.test.ts
  - "make test"
supersedes: none
---

**What.** The first full `make test` on branch l4 failed two Letta adapter tests: `commits.test.ts` timed out at 30 s, and `race.test.ts` found a lock its child process still held and could not remove its temporary folder (EPERM).

**Why.** The machine was loaded: the full-set rebuild for `make test-repro` had just run and other agents share the machine. The tests spawn git and node child processes, and nothing in this card touches the adapters.

**Result.** Rerun alone, both pass (3 of 3 tests). Every other vitest file passed (176 of 178 files, 2,948 tests), and pytest passed with 247 tests.

**Consequence.** None for L4. These two tests are load-sensitive on Windows.
