---
date: 2026-11-06
author: claude-agent
type: milestone
card: PX3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-package/package.json
  - packages/pi-package/test/install.test.ts
  - .pi/settings.json
  - "pnpm exec vitest run packages/pi-package/test/install.test.ts"
supersedes: none
---

**What.** Card PX3 added `packages/pi-package`, an installable pi package bundling the Engram extension, an `engram` skill and an `/engram` prompt template, and this repository's `.pi/settings.json` now loads it.

**Why.** ADR 0001 makes the pi package the primary distribution surface for Engram.

**Result.** The acceptance test runs `pi install <path> --local` in a temporary project with pi 1.3.0, offline, then pi in RPC mode: `get_commands` lists `engram` and `skill:engram` with origin `package`, and the four memory tools are registered (`packages/pi-package/test/install.test.ts`, 3 tests pass). In this repository, `get_commands` lists the package beside `adr`, `card` and `log-entry`.

**Consequence.** `/engram lint` waits for card L1 and `/engram simulate` for card E8.9; until they land the template reports them as unavailable. Publishing to npm stays out of scope.
