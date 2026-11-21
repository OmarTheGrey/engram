# @engram/pi-extension

The Engram extension for [pi](https://pi.dev), the reference harness (ADR [0001](../../docs/decisions/0001-pi-as-base.md)). It is where the plane meets an agent: pi's events and tool calls become Plane calls, and Plane results become what the model sees. Inside pi, the Engram tools are the only path to a store. Back to the [root README](../../README.md).

## Rules

- **The Plane decides; the extension maps.** No policy `if` lives here (AGENTS.md rule 1). The extension calls `Plane.checkWrite`, `Plane.write`, `Plane.read`, `Plane.retain`, `Plane.explain`, `Plane.simulate` and `Plane.recordBypass`.
- **Every decision is mirrored into the session** as a `custom` entry with `customType: "engram.event"` (rule 3), after an `engram.call` entry for the call itself, and the policy is recorded once per runtime as `engram.policy`. A recorded session therefore replays through the plane to the same decisions with no model (card PX2, ADR [0032](../../docs/decisions/0032-simulator-replays-recorded-calls.md)).
- **No bypass** (ADR [0014](../../docs/decisions/0014-no-bypass.md)). Store commands are blocked in `user_bash` and in the model's shell tools, and pi's file tools are blocked on paths inside a store root (`storeRoots`). The event log and pi's own settings are protected only when the `protect` option names them (the pi package does), and a folder holding one is guarded below the `protectBelow` folders. Core's `shellBypass` and `toolBypass` decide, and each block is one `bypass_blocked` event. A store name that a variable, an alias or a script supplies at run time is out of reach of any text check.
- **The agent writes as source `model`** (decision D4 of ADR [0004](../../docs/decisions/0004-provenance-and-source-trust.md)), whatever the item claims.
- **Only pi-extension, pi-package, runner, bench and model may import pi packages** (ADR [0033](../../docs/decisions/0033-shared-model-package.md)).

## Main modules

| module | what it holds |
|---|---|
| `src/extension.ts` | `createEngramExtension(options)`: the tools and the handlers. `tool_call` decides a write with `Plane.checkWrite` (a deny is committed there and blocks the call; an allowed write is committed in the tool's `execute`); `context` shows the model only the memory results this extension produced, tagged with their read id and admitting rule, and withholds every other `memory_*` result; `before_agent_start` injects governed recall and sweeps retention; `session_before_compact` and `session_before_tree` keep memory out of summaries |
| `src/tools.ts` | the tool definitions the model sees, `memory_write`, `memory_read`, `memory_explain`, `memory_simulate`, shared with the runner's ungoverned conditions and the MCP server so every path offers the same names and wording |
| `src/tag.ts` | how a governed read is rendered for the model (the memory tag), and how other text is defused so it cannot pass as governed memory |
| `src/replay.ts` | `replaySession`, `sessionEvents`, `sessionWorkload`: read a recorded pi session back and replay it through a plane |
| `src/bash.ts`, `src/paths.ts` | re-exports of core's checks (`packages/core/src/no-bypass/shell.ts` and `paths.ts`): the store commands blocked by default (`STORE_COMMANDS`) and the store-root check for file tools; the check is core's, since it decides |
| `src/ids.ts` | `uuidv7` and the system clock, the defaults a session injects |

## Use

Most people use it through the pi package (`packages/pi-package`), which opens a workspace and loads this extension. Directly:

```ts
import { createEngramExtension } from "@engram/pi-extension";

export default createEngramExtension({
  db,                       // a migrated Engram log
  adapter,                  // the store the plane governs
  policy,                   // e.g. loadPreset("medium")
  actor: { id: "person:alice", level: "person", memberships: ["person:alice"] },
  storeRoots: ["/path/to/store"],   // file tools are blocked inside these
  protect: ["/home/alice/.engram/engram.db", "/path/to/project/.pi"],   // the log and pi's settings
  protectBelow: ["/path/to/project", "/home/alice"],   // a folder holding a protected file is guarded below these
});
```

## Test

```sh
pnpm --filter pi-extension exec vitest run
```

These are layer 5 tests (`docs/conventions/testing.md`): the extension inside a real pi SDK session with an in-memory session manager and a scripted model. `test/interception.test.ts` checks that writes are gated, reads filtered, events mirrored and bypasses blocked, against the golden sessions in `fixtures/sessions/` (regenerated only by `make fixtures`); `test/attacks.test.ts` tries to smuggle memory past the `context` handler; `test/replay.test.ts` replays recorded sessions; `test/unit/` covers the pure helpers.

## What is next

- No `memory_lint` tool is registered yet, and no card schedules one; the `/engram lint` prompt template uses it when present and says so when it is not.
- Card D2 (in progress): its induced procedures are written as SKILL.md, the format pi and Claude Code load, so an admitted procedure needs no converter.
- The limit that remains by design: a handler of another extension that runs after Engram's can still change what is sent (ADR [0009](../../docs/decisions/0009-retrieval-explanations.md), decision D11).
