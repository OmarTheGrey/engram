---
date: 2026-11-21
author: claude-agent
type: failure
card: B11
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/tau2_memory.py
supersedes: none
---

**What.** The first mutation check of the shim reverted it with `git checkout`, which restored the committed version and dropped the uncommitted formatting and line-length fixes made since.

**Why.** The check restored from git instead of from the backup it had just taken; also, its `sed` pattern did not match, so the shim test passed against an unmutated file.

**Result.** The fixes were restored from the backup copy and committed; the mutation was then made by a Python edit (the `&quot;` escape removed), and the shim test failed on C2's read as it should, then passed once restored.

**Consequence.** Mutation checks run only on committed files and restore with `git checkout`.
