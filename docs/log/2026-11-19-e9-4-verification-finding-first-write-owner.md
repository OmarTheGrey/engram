---
date: 2026-11-19
author: claude-agent
type: finding
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - docs/decisions/0006-scope-owner-grants-typed-policy.md
supersedes: none
---

**What.** A first write may name another principal as its owner, so a member of a shared scope can create an item that names another person as its owner and carries grants, which then read as that person's consent.

**Why.** ADR 0006's amendments keep the owner of a new item as written, not compared with the actor's id; the owner rule of ADR 0034 applies to changes of an existing item only. Found while correcting the sentence the verification of PR #44 asked to make true or correct.

**Result.** Not reproduced as a test; it follows from the write gate's documented rule. In the twin's person scopes only the owner is a member, so it concerns role, team and org scopes.

**Consequence.** A backlog row; `docs/architecture.md` and ADR 0034 now state it.
