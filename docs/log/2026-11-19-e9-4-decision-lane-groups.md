---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/ui/src/view.ts
  - packages/ui/test/twin.test.ts
supersedes: none
---

**What.** The person versus role lanes are four groups of the lanes one read returned: the viewer's person scope and its role scopes, always shown even when empty, then team and org and then scopes reached through a grant, each only when it holds a lane; the editor appears on items in member scopes only.

**Why.** The split is the twin profile's point (ADR 0021), so a viewer holding no role sees that it holds none. The group is read from the scope's name, not from a policy, so the view decides nothing (rule 1); which change is allowed stays the plane's decision, which the editor shows.

**Result.** The earlier inspector's Chromium tests pass unchanged; the lanes keep their order within a group.

**Consequence.** A member of a role who does not own an item still sees the editor on it, and the plane refuses with `engram/grant/owner`.
