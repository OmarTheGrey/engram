---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/pack-traces.ts
  - specs/traces
supersedes: none
---

**What.** Traces are committed gzipped (`.itf.json.gz`), one ITF document each.

**Why.** Each ITF state repeats the whole log: 200 traces of 60 steps are about 36 MB as JSON and 0.8 MB gzipped.

**Result.** The reader decompresses by extension; the packer writes level 9 with no name or time in the header, so the bytes depend on the trace alone.

**Consequence.** Cost if wrong: the files are not readable in a diff; `zcat` reads them.
