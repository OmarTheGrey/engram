---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15d
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/no-policy.test.ts
  - packages/cli/src/tui/screens/policy.ts
supersedes: none
---

**What.** On the merged tree, E8.15c's syntax-tree guard failed three lines of `screens/policy.ts`: a lint finding's rule kept in a variable and compared, and two simulate reasons passed through `clean`.

**Why.** The guard allows a reason, a policy id or an admitting rule only as text drawn (a template, `oneLine`, `safe` and the layout's cutters); `clean` is not among them, and a variable that is compared is a use.

**Result.** The rule is drawn straight in its template; the reasons and rules through `oneLine`. The guard passes, and `clean` was not added to its list.

**Consequence.** The stricter guard E8.15c is adding is met by the same lines.
