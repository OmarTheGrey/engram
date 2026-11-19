---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/test/files/rv3.test.ts
supersedes: none
---

**What.** Review finding RV3-6 (minor, unverified): the adapter cached the folder's identity at first use, which would be the resolved path, not the real one, if the folder did not exist yet.

**Why.** The cache did not distinguish the two. Checked against the code: no adapter call computes an imported id before the folder exists (an empty or missing folder lists nothing, and a write creates the folder first), so the case was not reachable through the adapter; the reviewer marked it unverified.

**Result.** Hardened anyway: the instance keeps only an identity taken from the real path, and falls back to the resolved path without keeping it. A test opens an adapter through a junction on a folder that does not exist yet, writes, then lists a Claude Code file and expects the id of the real folder; it fails when the cache takes the resolved path.

**Consequence.** Nothing else.
