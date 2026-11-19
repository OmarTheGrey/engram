---
date: 2026-11-19
author: claude-agent
type: change
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/ui/src/App.tsx
  - packages/ui/src/view.ts
  - packages/ui/test/twin.test.ts
  - fixtures/workspaces/twin/workload.json
  - test/e2e/twin.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** The inspector gained the twin screens: lanes grouped into the viewer's person scope, its role scopes, team and org, and what it reached through a grant; each item's grants; and, in member scopes, a grants editor over `POST /grants` showing the plane's decision.

**Why.** Card E9.4: the twin dogfood (card E9.5) needs a member to see the person and role split and to give and take back consent.

**Result.** On the twin fixture workspace, under the twin profile, Chromium works the editor: a grant added and one removed are each one update event in the log and a timeline row; three refusals (no expiry, model content, another member's role item) are deny events shown with their rule; the grantee's view follows. Seven Chromium tests pass beside the nine earlier ones; without the re-read after a change, three fail.

**Consequence.** E9.5 can start.
