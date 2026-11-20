---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/extension.ts
  - packages/pi-extension/test/attacks.test.ts
supersedes: none
---

**What.** Review of PR #59, RV5-4: pi's bash check does not follow `cd`, so `cd <protectBelow folder> && rm engram.db` removed the log.

**Why.** Core's shell check reads a relative path against the session's cwd, and the protectBelow folder itself was not guarded, only folders strictly inside it.

**Result.** Reproduced red by the new attacks.test.ts case (the bash call ran); fixed in the extension by guarding each protectBelow folder itself (rv5-fix-decision-protect-below-itself). The general `cd` case is a `test.todo` naming card RV7, which changes core's no-bypass.ts.

**Consequence.** Covered until RV7 lands: a command that names the folder to step into it is blocked.
