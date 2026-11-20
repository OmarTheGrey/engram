---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
  - docs/decisions/0013-adapter-contract-and-conformance.md
supersedes: none
---

**What.** Review finding I-6 of PR #58: two copies of a folder adopted alternately into one scope made adoption churn (probe P3: 4 retired and 4 adopted, 8 events, on every pass), and no document said so.

**Why.** Each copy lists the same refs under ids its own path derives; each adoption takes the other copy's holders as vacated and re-keys them, as card RV4 designed for a move.

**Result.** Documented beside "two folders need two adapter names" in ADR 0013 and in the dogfood procedure, with the same remedy. No code change (decision entry).

**Consequence.** A member who keeps a second copy under the same adapter name sees the churn named, not unexplained.
