---
date: 2026-10-29
author: claude-agent
type: failure
card: B1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/gatemem/py.ts
  - packages/bench/scripts/upstream-judge-golden.py
  - fixtures/bench/gatemem/upstream-judge-golden.json
supersedes: none
---

**What.** Two mutants of the judge's fallback parser survived the first golden file: letting `^` or `$` under MULTILINE also break lines at `\r` and U+2028, as JavaScript's `m` flag does, changed no golden case, and a judge prompt filled with `JSON.stringify` in place of Python's `json.dumps` passed too.

**Why.** Every crafted reply that split fields with `\r` or U+2028 failed under both rules, since one mutated anchor alone never reached three fields; and the fixture's answers have an empty structured part, which both serialisers print as `{}`.

**Result.** Three replies with two fields on `\n` lines and two more split by `\r`, U+2028 or U+2029, and seven crafted agent outputs (floats, non-ASCII, falsy values) whose prompt hashes upstream recorded, now kill all three mutants.

**Consequence.** None beyond the added cases.
