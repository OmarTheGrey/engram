---
date: 2026-11-19
author: claude-agent
type: failure
card: RV3
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/files/rv3.test.ts
  - docs/dogfood.md
supersedes: none
---

**What.** Review finding RV3-4 (minor): a case-only rename of an item file (`<ID>.md`) blocks rewrites of that item until the file is renamed back, which nothing stated.

**Why.** The renamed file names another id than its key, so RV-ADP-1 refuses it, and a write refuses a name that differs from the item's only in case (review finding R4-5).

**Result.** A test pins it: after the rename the item lists nothing, the renamed file is a diagnostic, a rewrite throws `UnsafeKeyError`, and after renaming it back the rewrite succeeds. `docs/dogfood.md` now warns against renaming an item file in any case, and ADR 0013's amendment names it.

**Consequence.** Nothing else; the behaviour is kept, since guessing which of two names is the item would be worse.
