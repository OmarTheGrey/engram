---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/log/2026-11-19-rv3-review-files-id-tied-to-name.md
  - docs/decisions/0013-adapter-contract-and-conformance.md
supersedes: none
---

**What.** Review finding RV3-5 (minor): the RV-ADP-1 entry and the PR body read as if tying an id to its file name stopped forged Engram files, which it does not.

**Why.** A file written by hand under the name of its own new id, with Engram metadata and a grant, is consistent with its name, so the adapter reads it and adoption takes it with its grants (the reviewer's probe `forge.mts`, part 2). That is RV-ADP-4, deferred to card RV4.

**Result.** The RV-ADP-1 entry is superseded by one that says plainly it stops copies and mismatched names only; ADR 0013's amendment and the PR body say the same.

**Consequence.** Forgery stays on the backlog row for RV-ADP-4.
