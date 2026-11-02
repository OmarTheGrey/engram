---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-02-x1r-tag-attributes.md
supersedes: none
---

**What.** PR 3 changed `packages/pi-extension/src/tag.ts`, outside the plan's file list, without a decision entry.

**Why.** The change was listed as a shared file in the report but not logged.

**Result.** The decision entry `2026-11-02-x1r-tag-attributes.md` records it.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
