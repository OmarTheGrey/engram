---
date: 2026-10-29
author: claude-agent
type: failure
card: E8.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/ui.test.ts
  - packages/server/src/static.ts
supersedes: none
---

**What.** The first test for the colon rule (review R4-10) passed with the rule removed.

**Why.** Its paths (`/assets/app.js:x`, `/C:/secret.txt`) name nothing that exists, so the existence check refused them anyway; the mutation check showed the test did not depend on the rule.

**Result.** The test now asks for `/assets/app.js::$DATA`, which on Windows names the main stream of a file that exists, and on other systems for a real file whose name holds a colon. Without the rule it fails; with it, all 10 tests in the file pass.

**Consequence.** A path rule's test names a file that exists without the rule.
