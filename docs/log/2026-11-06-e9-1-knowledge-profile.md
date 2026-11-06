---
date: 2026-11-06
author: claude-agent
type: change
card: E9.1
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/pi-package/profiles/knowledge.yaml
  - fixtures/profiles/knowledge-writes.json
  - packages/core/test/unit/profiles/knowledge.test.ts
  - "pnpm --filter core exec vitest run test/unit/profiles"
supersedes: none
---

**What.** Card E9.1 added Govern's knowledge profile: org takes only user and document sources at a 0.8 floor, team and org require review, shared scopes hold no episodic records, and the conflict and validity lints are listed.

**Why.** Roadmap epic E9: Govern needs a policy for trusted organisational memory before its screens (E9.3) and dogfood (E9.5).

**Result.** The profile loads; 13 fixture writes get the decision, status and rule the fixture names; an org candidate is read only after a reviewer promotes it; a model-written note cannot be promoted into org; an item past its window is excluded. 18 tests pass.

**Consequence.** `engram --policy packages/pi-package/profiles/knowledge.yaml` governs with it; card PX3 ships the folder in the pi package.
