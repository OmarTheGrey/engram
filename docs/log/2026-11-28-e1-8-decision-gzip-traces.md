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

**Result.** The packer writes level 9 with no name, time 0 and the OS byte set to 255, so the header is the same on every platform (Node writes 0x0a on Windows, 0x03 elsewhere). The result's `traces_sha256` is over the decompressed JSON, so another zlib's deflate stream leaves it as it is.

**Consequence.** Cost if wrong: the files are not readable in a diff; `zcat` reads them.
