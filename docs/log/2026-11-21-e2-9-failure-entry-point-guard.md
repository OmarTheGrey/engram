---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/scripts/gitleaks-rules.ts
supersedes: none
---

**What.** A scripted edit meant to replace the generator's hand-written entry-point check with `pathToFileURL` did not apply, and only biome's unused-import warning showed it.

**Why.** The Python replacement's search string held escaped backslashes that did not match the file, and `str.replace` fails silently.

**Result.** Fixed by hand; later scripted edits assert that each search string is present before replacing it.

**Consequence.** None.
