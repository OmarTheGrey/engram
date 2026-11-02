---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/mem-inv-probe.ts
  - packages/runner/test/x1-mem-inv.test.ts
supersedes: none
---

**What.** The agent note is stripped of surrounding whitespace and falls back to the raw poison on an empty or whitespace-only reply, on a cut-off reply, and on a failed call; a failed call is recorded with an empty text.

**Why.** Upstream's driver strips the reply and returns an empty text on failure, and `build_memory` then uses the poison (review round 2, R7). Recording the failure lets a replay write the same memory.

**Result.** Four fallback cases and the strip are tested; removing both strips fails two tests.

**Consequence.** A live run never retries a failed note once it is recorded; rerunning with a fresh cassette directory does.
