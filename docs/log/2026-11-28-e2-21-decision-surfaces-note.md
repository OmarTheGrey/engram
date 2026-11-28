---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.21
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/view/src/view.ts
  - packages/cli/src/tui/screens/grants.ts
  - packages/ui/src/App.tsx
  - packages/cli/test/tui/frames-memory.test.ts
  - packages/ui/test/twin.test.ts
  - test/e2e/twin.e2e.test.ts
supersedes: none
---

**What.** Both grants editors state the cap as fixed words from `@engram/view` (`GRANT_EXPIRY_NOTE`, `GRANT_EXPIRY_HINT`), and show a refusal as core's answer carries it.

**Why.** Reading the workspace's policy to decide whether to show the cap would be a policy branch outside core (AGENTS.md rule 1; the TUI's no-policy guard). The words name the twin and knowledge profiles, the only places the option is on, and pass that guard.

**Result.** The TUI's Expires hint now names the cap (it said "empty for none", which the gate refuses): the eight `memory-grants` frames changed on that line only, checked before `-u`; eight new `memory-grants-capped` frames show the deny, its reason and `engram/write/grant-expiry-cap`. The inspector shows the note beside the expiry; its twin test and the e2e twin test add a refusal past the cap.

**Consequence.** Under another policy the note still names the two profiles; it never claims the cap applies.
