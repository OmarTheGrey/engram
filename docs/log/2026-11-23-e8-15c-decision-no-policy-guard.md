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
supersedes: docs/log/2026-11-23-e8-15c-decision-no-policy-gaps.md
---

**What.** The no-policy guard follows a local one level: a `const` or `let` set from a decision field, or from a display helper or template over one, carries the taint, and any member access, call, comparison or branch on it fails. The exemption markers are removed, and regular expressions are checked for rule ids and presets like strings.

**Why.** Re-verification findings 1 to 3: a local let drawn text be searched, no source used a marker, a regular expression's rule id passed.

**Result.** Seventeen probes, among them `const why = oneLine(p!.reason); if (why.includes("episodic"))` and the reviewer's marker mutant, fail it. Recorded limits: one level of assignment (a copy of a copy is not followed); a real non-answer read whole would get a pinned (file, line) allow-list, not a marker; a rule rebuilt from form values alone cannot be caught by syntax and stays a review duty.

**Consequence.** None.
