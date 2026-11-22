---
date: 2026-11-22
author: claude-agent
type: finding
card: E9.8
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/policies/medium.yaml
  - packages/core/test/unit/portable-import.test.ts
supersedes: none
---

**What.** The medium preset's comment, that no preset carries model content out of person scope by review, holds again after the E9.8-1 fix.

**Why.** The review noted that the import path had made it false: a model row landed in team scope as an `import` candidate a reviewer could promote.

**Result.** A model row is now refused in team scope, and a model candidate in person scope cannot be promoted out of it (source isolation, ADR 0026's amendment of card E2.5). The comment needs no change.

**Consequence.** None.
