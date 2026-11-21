---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/pi-extension/test/replay.test.ts
  - fixtures/sessions/d1/index.json
supersedes: none
---

**What.** The fifty sessions go in a subfolder, `fixtures/sessions/d1/`, with an `index.json`. They do not sit at the top level of `fixtures/sessions/` beside a `.expected.json` each.

**Why.** Card PX2's replay test reads every top-level `fixtures/sessions/*.jsonl` and expects its `engram.policy` and `engram.call` entries. A recorder fixture has neither, so fifty top-level files would break that test.

**Result.** PX2's two fixtures are unchanged, and `git status` shows nothing else in `fixtures/` changed. `make fixtures` empties and rewrites only `fixtures/sessions/d1`.

**Consequence.** A later card that globs `fixtures/sessions/` recursively must skip `d1/`, or read its index.
