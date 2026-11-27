---
date: 2026-11-25
author: claude-agent
type: decision
card: X23
chapter: design
pillar: plane
hypothesis: H4
evidence:
  - docs/tasks/X23.md
  - docs/tasks/A6.md
  - docs/decisions/0035-store-independence-is-a-design-property.md
supersedes: none
---

**What.** Card X23, the request-identity check, is placed in W11, the week before card A6's fourth store (W12).

**Why.** It adds a MANIFEST row and a runner store, which wait for H1's `MERGE=4`; A6's goal names "ADR 0035's request-identity check", which does not exist yet, so the check must come first for A6 to join it. Gate D (24 January) needs it on files, Mem0 and Letta only.

**Result.** A6 keeps "Depends on: none"; X23's last step leaves A6 a finding to add `mcp-memory` to the check's stores once both have merged.

**Consequence.** If X23 slips past W12, A6 runs the conformance suite alone and the check takes its store later.
