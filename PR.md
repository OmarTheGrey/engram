## Card

E9.10 `engram discover`: harness memory outside the plane, counted, and its doctor check (second absorb plan, pull request 6 of 30).

## Plan

1. Core, pure: `packages/core/src/discover.ts` holds a dated table of eleven harness memory locations (Claude Code's auto memory, user and project `CLAUDE.md`, `CLAUDE.local.md` and rules; Codex's user and project `AGENTS.md` and memories; Cursor's rules and `.cursorrules`), each row with its documentation link, `as_of` 2026-11-28 and a status, and `classifyHarnessMemory(path, head, home)`, where `head` is the file's size and time, never its content. `insideRoot` and `summarizeDiscovery` count per harness and kind what sits outside every store root.
2. CLI: `packages/cli/src/discover.ts`, a bounded walk (the home's table locations; each project to depth 4 and 20,000 entries, skipping dependency, build and dot folders but `.claude` and `.cursor`, no links followed), registered in `packages/cli/src/registry.ts` (main moved commands there from `commands.ts`): help, form, Home letter D under Machine.
3. Doctor: a `harness memory` check, `warn` when anything is outside, never a failure. Doctor gains the `warn` status, `warned` in its JSON and `, N warning(s)` after its summary.
4. TUI: a Harness memory screen that draws the counts, and Doctor's screen reads `warn`, with its meaning and what to do.
5. Fake home fixtures in `fixtures/harness/home/`.

No file is opened anywhere (rule 12); a test fails if either discover source calls a read of content.

## Acceptance

Acceptance: `make test-one T=packages/core/test/unit/discover.test.ts` and `make test-one T=packages/cli/test/doctor-discover.test.ts`

## Evidence

`engram discover` on a copy of the fake home, auto memory as the store root (`packages/cli/test/doctor-discover.test.ts`):

```
discover: 10 harness memory files outside every store root, 2 inside one; sizes and times only, no file opened
  claude-code  user-claude-md        1 file      51 bytes  newest 2026-11-20T10:00:00.000Z
  claude-code  project-claude-md    2 files      55 bytes  newest 2026-11-20T10:00:00.000Z
  codex        project-agents-md     1 file      38 bytes  newest 2026-11-20T10:00:00.000Z
  cursor       project-rules         1 file      53 bytes  newest 2026-11-20T10:00:00.000Z
  ...
```

and `engram doctor` on it:

```
warn harness memory  10 harness memory files outside every store root (claude-code user-claude-md 1, ...); 2 inside one; engram discover lists them
doctor: all checks passed, 1 warning
```

exit 0. TUI frames: `packages/cli/test/tui/__frames__/surface-discover-*.txt` and the updated `surface-doctor-*.txt`. Guard: no registered config, script or fixture reaches the new code; `research/results/h1-crosswalk.json`, the one row whose config names CLI test files, regenerates to its MANIFEST sha256 `e51bbc85...57c0` unchanged.

## Log entry

- docs/log/2026-11-28-e9-10-classifier.md
- docs/log/2026-11-28-e9-10-discover-command.md
- docs/log/2026-11-28-e9-10-doctor-warning.md
- docs/log/2026-11-28-e9-10-head-is-stat.md
- docs/log/2026-11-28-e9-10-walk-bounds.md
- docs/log/2026-11-28-e9-10-doctor-warn-status.md
- docs/log/2026-11-28-e9-10-tui-and-attribution.md
- docs/log/2026-11-28-e9-10-no-poc-result.md
- docs/log/2026-11-28-e9-10-table-unfetched.md
- docs/log/2026-11-28-e9-10-hook-feed.md
- docs/log/2026-11-28-e9-10-failure-escaping.md
- docs/log/2026-11-28-e9-10-failure-byte-count.md
- docs/log/2026-11-28-e9-10-failure-title-cut.md
- docs/log/2026-11-28-e9-10-failure-full-suite.md

## Checklist

- [x] acceptance command passes locally
- [ ] make test passes (left to the orchestrator; the CLI package's tests, the acceptance files and make test-invariants pass)
- [x] tests required by docs/conventions/testing.md are included
- [x] docs/deps.md updated if a dependency was added (none added)
- [x] docs/absorbed.md and NOTICE updated if code or data was copied or ported (nothing copied; vendor documentation read for paths only)
- [x] AGENTS.md updated if a rule or command changed
- [x] ADR added if a choice another card could have made differently (none needed)
- [x] no em dashes in prose

🤖 Generated with [Claude Code](https://claude.com/claude-code)
