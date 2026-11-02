---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/vendor-mem-inv-bench.py
  - fixtures/bench/gatemem/manifest.json
supersedes: none
---

**What.** The first clones of GateMem and MEM-INV-Bench at their pins into `.engram/upstream/` checked text files out with CRLF line endings, so their bytes no longer matched the manifests' sha256.

**Why.** Git on this Windows machine has `core.autocrlf=true`; the manifests hash the committed bytes (LF). `bench/data/office/episodes.jsonl` and `bench/agents/base.py` hashed differently until the clones were checked out again with `core.autocrlf=false`.

**Result.** Caught before any hash was written: after the re-checkout, `base.py`, `scenarios.py`, `LICENSE` and the evidence zip match the manifests and `make bench BENCH=gatemem DRY=1` reports 8 of 8 data files pinned. The MEM-INV-Bench vendoring's `--fetch` now sets `core.autocrlf=false` before checking out.

**Consequence.** COUNT reports such data as not pinned instead of counting it.
