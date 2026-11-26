---
date: 2026-11-23
author: claude-agent
type: finding
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/rich.ts
supersedes: docs/log/2026-11-22-e8-15c-finding-pseudoconsole.md
---

**What.** The reviewer's ConPTY scripts s2, s3 (with a Tab for the new Member of field) and s6 rerun on the fixed branch, scratch `--db`, `--root` and `--no-saved`.

**Why.** The review fix pass's last check. The earlier entry said every screen worked, but s3 had shown dana's note under sam's title bar.

**Result.** s3: dana's item page shows the note; after the handoff the item page and Read say "This answer was made as person:dana", r reruns as sam, and the reviewer's promotion to org is allowed; no frame after the switch holds the note's id or text. s2: Open the event says "event 5 is not one you may see; nothing is selected". s6: after accepting, the plan runs again and offers nothing; ctrl+s again sends nothing.

**Consequence.** None.
