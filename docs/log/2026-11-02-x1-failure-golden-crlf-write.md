---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/upstream-rag-policy-golden.py
  - fixtures/bench/gatemem/upstream-rag-policy-golden.json
supersedes: none
---

**What.** The first RAG-Policy golden file was written with CRLF line endings, and git warned on commit that it would replace them.

**Why.** The script used Python's `Path.write_text`, which on Windows translates `\n` to `\r\n`; the other golden scripts write bytes.

**Result.** The script now writes UTF-8 bytes with `\n`; rerun, it produced the same content git had stored, so the committed file did not change (commit `f9fbdd5`).

**Consequence.** None beyond the fix; a golden script writes bytes.
