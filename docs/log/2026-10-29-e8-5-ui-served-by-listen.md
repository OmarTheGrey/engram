---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/static.ts
  - packages/server/src/listen.ts
  - packages/server/test/ui.test.ts
supersedes: none
---

**What.** `createApp` takes a `ui` directory and `listen` defaults it to the built `packages/ui/dist`, so `engram serve` serves the inspector with no flag; every inspector response carries a same-origin Content-Security-Policy.

**Why.** The plan says the server serves the UI at `/` and that the page fetches nothing but the API; it does not say how the server finds the build or how the second rule is enforced.

**Result.** A path is decoded once and refused with a backslash, a NUL, or a `.` or `..` segment; the file must resolve inside the directory, links followed. Ten traversal spellings and a symlink out return nothing outside it (`packages/server/test/ui.test.ts`); removing both checks fails that test, removing the containment check alone fails the symlink test. Playwright records no request to another origin.

**Consequence.** `engram serve` (PR 3) needs no change; a later `--ui <dir>` flag would pass `ui` through.
