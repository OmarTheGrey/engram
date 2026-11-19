---
date: 2026-11-19
author: claude-agent
type: decision
card: L4
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/runner/src/lint-fault-set.ts
  - research/configs/h3-lint-model.json
supersedes: none
---

**What.** A fault-set experiment config must name the sha256 of the set's policy.json and states.jsonl, and the runner checks them before it runs or counts.

**Why.** The set lives under .engram/ and is rebuilt locally; a live run on a stale or hand-edited set would spend the key on the wrong states.

**Result.** The live config carries L2's committed hashes; a test refuses a set whose file differs, and a missing one.

**Consequence.** When L2's set changes, this config's hashes change with it.
