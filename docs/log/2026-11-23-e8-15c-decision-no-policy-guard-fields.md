---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/no-policy.test.ts
supersedes: docs/log/2026-11-23-e8-15c-decision-no-policy-guard.md
---

**What.** The no-policy guard follows a decision field's text one level, into a local (`const` or `let`) or into a field of the same class (`this.why = oneLine(p.reason)`, or a field declared with it): a member access, call, comparison or branch on it then fails, in any method of the class. It has no exemption markers, and checks regular expressions like strings.

**Why.** The verification's last minor finding: a class field let drawn text be searched in another method. Following `this.<field>` within its class was cheap, so it is followed rather than named.

**Result.** Its probes fail, the two field cases among them; dropping the field taint fails one. Recorded limits: one level (a copy of a copy, or a field of another object, is not followed); a non-answer read whole would get a pinned (file, line) allow-list; a rule rebuilt from form values alone stays a review duty.

**Consequence.** None.
