---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/write.ts
  - packages/cli/test/tui/flows.test.ts
supersedes: none
---

**What.** The reviewer handoff asks for the reviewer's memberships in an editable Member of field, prefilled with the promotion's target scope and the item's own scope; the confirmation names both, for this session only.

**Why.** Review finding 3: Member of set to the target alone is denied by the plane for the handoff's own case. The lead's decision: the item's scope is data from the item, not a rule.

**Result.** The flow test runs the design's case, a team item widened to org: dana is denied, the handoff to sam with `org, team:core` is allowed (exit 0). Mutation: the target alone fails it. Under ConPTY the reviewer's s3 lands the same promotion.

**Consequence.** 8.8's "Member of to the target scope" now reads as "prefilled with"; the design text is the lead's to update.
