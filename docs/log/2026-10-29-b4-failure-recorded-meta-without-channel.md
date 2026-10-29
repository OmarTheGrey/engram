---
date: 2026-10-29
author: claude-agent
type: failure
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/vendor-mem-inv-bench.py
supersedes: none
---

**What.** The first run of the MEM-INV-Bench vendoring script stopped with a KeyError on `channel` while reading the recorded study's transcripts.

**Why.** The script assumed every `propose` record of the reference model in the `exp1*` transcripts carries a laundering channel; some records of that model in those files have meta without one.

**Result.** Records without a channel are now skipped before the cell lookup; the rerun found a usable record for all 24 cases and every rebuilt memory matched the recorded one.

**Consequence.** Nothing further; the script still refuses to write a case it cannot match to a recorded request.
