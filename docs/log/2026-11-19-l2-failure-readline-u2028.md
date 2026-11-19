---
date: 2026-11-19
author: claude-agent
type: failure
card: L2
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/bench/scripts/fault-set-check.ts
  - "node packages/bench/scripts/fault-set-check.ts --set .engram/faults/h3-fault-set"
supersedes: none
---

**What.** The first full-set run of the label check failed with `SyntaxError: Unterminated string in JSON` on `states.jsonl`.

**Why.** It read the file with `node:readline`, which ends a line at U+2028 as well as at a newline. LongMemEval's text holds U+2028 in 19 of the 500 states, and `JSON.stringify` leaves it raw, so readline cut those states in two. Python's line iteration splits on newlines only, so the generator's own join was right.

**Result.** The check now splits on newline bytes only (`jsonLines`) and passes on all 500 states.

**Consequence.** The fixture README warns any reader of the set's JSON Lines; card L4 should read them the same way.
