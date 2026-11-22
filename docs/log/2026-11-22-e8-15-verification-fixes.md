---
date: 2026-11-22
author: claude-agent
type: change
card: E8.15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/design/tui.md
  - docs/tasks/E8.15.md
supersedes: none
---

**What.** The verification of the review fix pass found four important and five minor gaps in card E8.15's design, all fixed in `docs/design/tui.md` and the card.

**Why.** A pasted hook could fail open on Windows, Try it could reach a real server or test an unexpanded `${CLAUDE_PROJECT_DIR}`, and moving the inspector's view modules would delete paths log entries cite.

**Result.** Try it removes `ENGRAM_SERVER_URL` and replaces `--server` with a scratch log; store roots are absolute; E8.15c keeps one-line re-exports at `packages/ui/src/view.ts` and `provenance.ts`; the reviewer handoff lasts a session with Switch back and is not offered against a credentialed server; only `ENGRAM_TOKEN` sends a token; retain gets the strong dialog in 8.9 and 9.5; review rows have no checkbox; E8.12 is marked merged. The mockup check reports 41 of 41 frames fit.

**Consequence.** Section 13's snippet tests cover each fix.
