---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.10
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - packages/core/src/policy/promotion.ts
supersedes: none
---

**What.** A hold returns `check: "review"`, status candidate, and the policy id `engram/write/injection-screen`, placed after every deny check and before the rule's own `requires_review`.

**Why.** ADR 0039 item 3 asks for the mechanism `requires_review` uses. The promotion gate reads `check === "review"` as a target that needs a reviewer, so a held candidate is promoted only by one, and the screen's reason, not the rule's, names why.

**Result.** No new `WriteCheck` value; the existing promotion, explain and simulator code read it as they read a review.

**Consequence.** If the lead wants holds told apart by `check`, a new value is one line plus the promotion gate's test; costs a review of every `check` reader.
