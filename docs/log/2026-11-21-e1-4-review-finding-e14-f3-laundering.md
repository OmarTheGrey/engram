---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - docs/log/2026-11-19-e9-5-review-decision-raised-grant-is-violation.md
  - docs/decisions/0021-twin-scopes-and-grants.md
  - docs/dogfood.md
  - docs/tasks/backlog.md
supersedes: docs/log/2026-11-21-e1-4-finding-e14-f3-oracle-plane-disagree.md
---

**What.** Finding E14-F3, restated: the plane launders agent content into grantable content.

**Why.** Review finding E1.4-4. Dana saving her agent's identical text again as a user-sourced write makes the item `user`; `changeGrants` to Sam is allowed and Sam reads the agent's words verbatim, around ADR 0021's decision D4. A rewrite in her own words, or a promotion's new version of either, does the same.

**Result.** By the record the oracle is right: the E9.5 decision that a raised grant is a violation, ADR 0021's RV4 amendment, `docs/dogfood.md`; ADR 0034's decision 6 does not authorise it. Any such rewrite also makes `watch.provenance_raised` non-zero, which `docs/dogfood.md` says should stay 0. Pinned in four cases of the E14-F3 test; the relaxation filters only the owner's own raise.

**Consequence.** A core card, in the backlog: refuse adding or widening a grant on an item any allowed version of which held untrusted content.
