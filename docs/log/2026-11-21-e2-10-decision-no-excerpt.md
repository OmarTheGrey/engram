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
  - packages/core/src/lint/det.ts
supersedes: none
---

**What.** Neither the hold's reason nor the lint's evidence carries any character of the content: each hit is named as rule/signal with its weight and match length.

**Why.** Remnic attaches a 180-character excerpt. ADR 0039 item 4 forbids a value in a reason for secrets, and the event log is permanent and readable by every member of the scope; the same rule keeps the two guards consistent.

**Result.** A test asserts the reason holds none of the attack's words.

**Consequence.** A reviewer reads the candidate itself to see what matched.
