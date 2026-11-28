---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.11
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0051-crypto-shredded-erasure.md
supersedes: none
---

**What.** `data_keys` is outside ADR 0038's chain, a shred keeps a content-free tombstone row, and the table stores no key-derivation parameters.

**Why.** Chained rows would have to tolerate their own deletion; authenticated wrapping with the scope and version as associated data already detects an edit, and the report event names the versions shredded, so a key gone with no report is visible. No stored parameters means Compartment's edited-header attack has nothing to edit.

**Result.** ADR 0051 decisions 3 and 7.

**Consequence.** If wrong, a deleted key row is found by E9.13's check, not by `engram log verify`.
