---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/log/chain.ts
  - docs/decisions/0038-tamper-evident-log-that-keeps-erasure.md
supersedes: none
---

**What.** A chain begun under version 1 is moved up by one `version` entry before the next event a keeping handle appends, inside that append's transaction; a new chain starts at version 2.

**Why.** Leaving old chains at version 1 forever would leave every existing log's attestations uncovered; rewriting old entries would break their links.

**Result.** Old entries verify as they were; only events after the entry are covered, and rows before it are counted as uncovered. The writer reads the version under the log's lock until it sees version 2, then caches it, so another process's upgrade is seen. Cost if wrong: one extra chain entry per old log.

**Consequence.** The amendment in ADR 0038 records it for the lead's acceptance.
