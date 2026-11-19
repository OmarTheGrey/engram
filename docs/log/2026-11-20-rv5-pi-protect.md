---
date: 2026-11-20
author: claude-agent
type: change
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/extension.ts
  - packages/pi-package/src/extension.ts
  - packages/pi-package/src/config.ts
  - packages/pi-extension/test/attacks.test.ts
  - docs/decisions/0014-no-bypass.md
supersedes: none
---

**What.** The pi extension takes `protect` and `protectBelow`, which pi-package fills with the SQLite log and its `-wal`, `-shm` and `-journal` files, the project's `.pi/` and pi's agent folder; only the four tools Engram registers skip the no-bypass checks (findings RV-SRF-3 and RV-SRF-4).

**Why.** Pi's `write` tool could overwrite the log and `bash rm` delete it, and another extension's `memory_export` wrote into a store root unrecorded.

**Result.** Five new cases in `packages/pi-extension/test/attacks.test.ts`: nine routes to the log and `.pi/` blocked as store `engram`, user_bash exit 126, a neighbouring file still read, `memory_export` blocked and recorded, the extension's `memory_read` unchecked. Against the extension before the card, three of them fail.

**Consequence.** ADR 0014 has a proposed amendment; editing `.pi/` from inside a pi session with Engram is now refused.
