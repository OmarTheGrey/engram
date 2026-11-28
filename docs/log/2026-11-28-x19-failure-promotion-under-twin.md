---
date: 2026-11-28
author: claude-agent
type: failure
card: X19
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/residue.test.ts
supersedes: none
---

**What.** The first two ways of building the promoted tier in the core test were refused by the plane.

**Why.** A grantee reviewing the promotion was denied (`person:lee is not a member of person:dana; a grant lets others read an item, never move or retire it`), and the owner promoting into her own role got `widening person:dana to role:lead needs a reviewer's approval`.

**Result.** Under twin a widening out of a person scope needs a reviewer who is a member of the person scope and not its owner; the test and the check use one (decision promotion-reviewer).

**Consequence.** None for the plane.
