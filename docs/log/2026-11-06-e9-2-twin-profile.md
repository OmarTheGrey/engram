---
date: 2026-11-06
author: claude-agent
type: change
card: E9.2
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/pi-package/profiles/twin.yaml
  - fixtures/profiles/twin-reads.json
  - packages/core/test/unit/profiles/twin.test.ts
  - "pnpm --filter core exec vitest run test/unit/profiles"
supersedes: none
---

**What.** Card E9.2 added Twin's profile (ADR 0021): a person scope that takes everything the person and their agent remember, a role scope that takes only work knowledge and procedures from first-hand and tool sources, a role context that reads no person scope, and no default grants.

**Why.** Roadmap epic E9: Twin needs its scope split as a policy before its screens (E9.4), dogfood (E9.5) and offboarding (E9.7).

**Result.** The profile loads; in the fixture a teammate reads only the item a live, class-scoped grant gives them, nothing after it expires; a role context reads the role and not its holder's person scope; a grant without class or expiry, a model write to a role and an episodic role record are denied; an agent cannot widen person memory into a role. 8 tests pass.

**Consequence.** E9.7 hands role scopes over and erases person scopes under this profile.
