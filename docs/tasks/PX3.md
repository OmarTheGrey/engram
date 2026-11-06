# PX3 pi package and project setup

Status: done on branch `px3-pi-package`, not merged (2026-11-06). `.pi/` prompts, settings and the context file exist since S0.2. `packages/pi-package` bundles the extension (`src/extension.ts`, workspace from `ENGRAM_*` variables), the `engram` skill and one `/engram` prompt template taking the subcommand as its argument; `.pi/settings.json` loads it. Acceptance: `pnpm exec vitest run packages/pi-package/test/install.test.ts` (commands by RPC `get_commands`, tools by a probe extension, since RPC lists no tools). `/engram lint` waits for L1 and `/engram simulate` for E8.9. Log: `docs/log/2026-11-06-px3-pi-package.md`.

Added by ADR 0001.

Goal: `packages/pi-package` bundles the extension, skills and prompt templates (`/engram explain`, `/engram lint`, `/engram simulate`, `/engram policy`) as an installable pi package; this repository's `.pi/settings.json` loads it.

Files: `packages/pi-package/`, `.pi/settings.json`

Depends on: PX1

Acceptance: `pi install` of the package in a fresh project lists the Engram tools and commands (RPC `get_commands`)

Out of scope: publishing to npm.
