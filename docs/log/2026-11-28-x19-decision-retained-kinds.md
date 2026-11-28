---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/residue.ts
  - packages/core/test/unit/residue.test.ts
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** The review of X19 dropped the scan's `outside-person-scope` kind. Retained by decision is now only what ADR 0010 and U7 name: promoted, shared-store-ref (a ref an item of the person scope also held), erased-content-hash (only the hashes an erase or sweep event names after its clause), and surviving-hash.

**Why.** A copy outside the person scope that no promotion made and that shares no ref, such as a derived write left after a crash or a fresh-id copy, is a gap in ADR 0010, not a decision. E9.14 inherits the rule.

**Result.** A core test pins it: a team copy with lineage to an erased fact is residue, and the hash it holds is surviving-hash. Removing the shared-ref condition fails that test. The check's numbers are unchanged: its fixture team item is now shared-store-ref.

**Consequence.** None for the plane.
