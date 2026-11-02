---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/compare-c4-verdicts.ts
supersedes: none
---

**What.** C4 showed GateMem's RAG-Policy verdicts, a different policy from the one C5 enforces, so C4 minus C5 measured policy difference as well as mechanism.

**Why.** PR 3 ported the verdict faithfully without measuring its agreement with the plane.

**Result.** C4 now shows the plane's own decision by default; the RAG-Policy verdict is selectable.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
