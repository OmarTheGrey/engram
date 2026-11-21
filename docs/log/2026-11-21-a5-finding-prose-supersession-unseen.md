---
date: 2026-11-21
author: claude-agent
type: finding
card: A5
chapter: limitations
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
  - docs/readings/litreview/2609.08258-revoked-but-authoritative.md
supersedes: none
---

**What.** A replacement that states the supersession in prose only, with no lineage, status or window on the old item, leaves the old item admitted on every store.

**Why.** This is the paper's "indirect insertion", where the system must infer supersession from text; the plane reads supersession only from recorded fields and events.

**Result.** Pinned in the grid's "prose only" row: all nine revoked policies are admitted beside their replacements on all six stores. This is the unkeyed-item wall the literature note on 2609.08258 names, expected rather than new.

**Consequence.** H3 must keep keyed and unkeyed items apart; a model-based contradiction lint (card L3) is the only check that can see this case.
