# @engram/pi-package

Engram as a pi package: what a pi user installs to get governed memory. It wires a workspace (a log, a policy and a store) to the extension of `packages/pi-extension`, and ships the `engram` skill, the `/engram` prompt template and the profile policies (card PX3). Back to the [root README](../../README.md).

## Rules

- **It only wires.** Every tool and every gate is the extension's; every decision is core's. This package opens the workspace through the same opener the CLI and the server use (`openWorkspace` from `@engram/server`).
- **A pi package takes no flags**, so the settings the CLI takes as flags are environment variables here, and every default keeps the store inside the project.
- **The log and pi's settings are guarded like a store root**: the extension refuses any tool or shell command that touches the SQLite log (with its `-wal`, `-shm` and `-journal` files), the project's `.pi/` folder or pi's agent folder (card RV5).

## What is in it

| path | what |
|---|---|
| `package.json` (`"pi"` key) | the manifest pi reads: the extension, the skills folder and the prompt templates |
| `src/extension.ts` | the default export pi loads: opens the workspace, builds the protected paths, loads the Engram extension, closes the log on `session_shutdown` |
| `src/config.ts` | `packageConfig`: reads `ENGRAM_ROOT` (default `.engram/memory` in the project), `ENGRAM_STORE` (default files), `ENGRAM_POLICY` (a preset name or a YAML file), `ENGRAM_OWNER` (default your login name), `ENGRAM_AS` (default `person:<owner>`) and `ENGRAM_MEMBER` (comma-separated scopes); the workspace opener reads `ENGRAM_DB_URL` for the log, whose default is `<home>/.engram/engram.db`, as for the CLI |
| `skills/engram/SKILL.md` | the `engram` skill: how the agent should use the memory tools, and never a store's files or CLI |
| `prompts/engram.md` | the `/engram explain \| lint \| simulate \| policy` prompt template |
| `profiles/knowledge.yaml` | the Govern profile (card E9.1): provenance required for org, validity required, the conflict lint on, review for promotion |
| `profiles/twin.yaml` | the Twin profile (card E9.2, ADR [0021](../../docs/decisions/0021-twin-scopes-and-grants.md)): person and role scopes, no default grants (nothing in a person scope is readable by another principal until its owner grants it), and the offboarding rule set card E9.7 applies; used by the twin dogfood ([`docs/dogfood.md`](../../docs/dogfood.md)) |

## Use

This repository loads the package for itself through [`.pi/settings.json`](../../.pi/settings.json), so running `pi` in a clone (after `pnpm install`) gives the session the Engram tools. Elsewhere, add the package path to a pi settings file's `packages` list and set the environment, for example:

```sh
ENGRAM_ROOT=~/notes/memory ENGRAM_OWNER=alice ENGRAM_POLICY=<clone>/packages/pi-package/profiles/twin.yaml pi
```

## Test

```sh
pnpm --filter pi-package exec vitest run
```

`test/install.test.ts` is the acceptance test of card PX3: `pi install` of this package into a fresh project, then pi in RPC mode lists the Engram commands and tools, offline, with a temporary agent folder, home and log. `test/unit/` covers the configuration (`config.test.ts`) and the skill and prompt template (`templates.test.ts`).

## What is next

- Cards D2 and D3, in progress: D2 writes induced procedures as SKILL.md files, the format this package's skills folder already uses, and D3 admits them only after replay validation; card E9.6 (open, not started) adds the Procedures screens.
- The Knowledge profile's dogfood, which Gate D asks for beside the twin's, waits on a card not yet written (`docs/roadmap.md`, Gate D).
