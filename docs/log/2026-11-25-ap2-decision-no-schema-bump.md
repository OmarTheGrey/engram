---
date: 2026-11-25
author: claude-agent
type: decision
card: none
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/absorb-plan-2.md
  - docs/decisions/0002-schema-and-generated-contracts.md
  - docs/log/2026-11-21-e2-8-version-bump-moves-cassette-keys.md
supersedes: none
---

**What.** No card of the second plan bumps `schema_version`: policy options go into one schema pull request under ADR 0002's decision D2 (card E2.14), and plane-owned metadata into side tables.

**Why.** A bump moves H1's cassette keys after H1 has run and H3's pinned fault-set hashes before H3 runs.

**Result.** Crypto-shredding keeps its keys in a side table, as the hash chain did; the approval queue is a projection with no new event field. Plans that need a bump were left out (section 7).

**Consequence.** Derived-from edges, outcome events and the policy hash on events wait for an ADR that separates the policy's version from the item's.
