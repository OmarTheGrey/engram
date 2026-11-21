---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/scrub.ts
  - packages/runner/test/recorder.test.ts
supersedes: none
---

**What.** The scrub redacts free text, and holds a session only when an identifier still matches: the session id, task id, an entry id, a tool name, a model name or an argument name. pi's own id shapes (an 8-hex entry id, a canonical UUID) are exempt. A hold is reported by the recorder and is not logged as an event.

**Why.** Redaction is idempotent, so redacted text can never "still match". Only fields the scrub may not rewrite can. The table's 32-character rule matches every UUID, and pi's default session id is a UUID. No Plane method records a hold, and adding one is outside card D1's files.

**Result.** The planted-secret tests pass. A key in a tool result is stored redacted, and a key in the task id is held with no write and no event.

**Consequence.** Card E2.9's write-gate guard gives such refusals an event.
