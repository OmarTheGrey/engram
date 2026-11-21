---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/secrets.ts
supersedes: none
---

**What.** An email address on a git trailer line (`Signed-off-by:`, `Co-authored-by:`, `Reviewed-by:`, `Author:` and the like) is not personal data for the guard.

**Why.** A trailer is the author's signature on a commit, quoted with the commit, not a fact about a person (E2.9-8).

**Result.** `Signed-off-by: Dana <dana@example.org>` and `Co-Authored-By: ...` are not held.

**Consequence.** An address written after such a word anywhere on its line also passes.
