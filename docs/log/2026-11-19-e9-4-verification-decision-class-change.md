---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
supersedes: none
---

**What.** A rewrite that changes the class of an item carrying grants is a grant change: only the owner, user- or import-sourced, may make it, and every grant it keeps must name the new class (or none).

**Why.** Verification finding V-4. Kept grants are checked for their class only, not their expiry or the rest of `grantDefect`: the class is what the change alters about them, and an owner reclassifying an item with an old expired grant need not remove it first. A class change of an item carrying no grant is judged as before.

**Result.** Five tests in `packages/core/test/unit/plane/write-grants.test.ts`; invariant 5's grant walk checks class changes too, and catches the mutant that ignores them.

**Consequence.** ADR 0034, decision 6.
