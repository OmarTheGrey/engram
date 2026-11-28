## Card

A6 (second absorb plan, PR 17 of 30): a fourth store, the MCP reference memory server's JSONL file, through the conformance suite.

## Plan

- Read the format of `@modelcontextprotocol/server-memory` 2.2.1 at `modelcontextprotocol/servers` `c799c8552b0f27b7a33a7b9233773da144dddcf5` (licence in transition from MIT to Apache-2.0, both allowed). Port of the format, no code copied.
- `packages/adapters/src/mcp-memory/`: each plane item is one entity line `engram:<id>` with the item under an `engram` member the server keeps and never shows. The server's observations and relations list as read-only items in `person:<owner>`. Their refs are derived from what names them: `observation/<h>` over [entity, text], `relation/<h>` over [from, relationType, to]. Every line and member the adapter does not understand is kept byte for byte. Writes hold the server's own `<file>.lock`, with its 30 s stale bound. Refusals follow the files adapter: copies and renames, symlinks, hard links, read-only files.
- Register the adapter in `packages/adapters/test/conformance/registry.ts`, with no per-adapter skip. Add its own tests and `server-format.ts`, a port of the server's load and save. Add a synthetic fixture in `fixtures/stores/mcp-memory/`.
- Wire it into every place a store is chosen: the workspace opener, `--store mcp-memory` in the CLI registry and help, the TUI's store picker, doctor's `adapter mcp-mem` check and the TUI machine screen, and the e2e CLI smoke.
- Add a row to `docs/absorbed.md` (port, so NOTICE is not needed), and update AGENTS.md and CLAUDE.md.

## Acceptance

Acceptance: `make test-one T=packages/adapters/test/conformance/conformance.test.ts`

## Evidence

```
make test-one T=packages/adapters/test/conformance/conformance.test.ts
 Test Files  1 passed (1)
      Tests  291 passed | 41 skipped (332)
```

The mcp-memory entry passes 40 cases and lexical recall. It skips the same 7 capability-gated cases as files (no history, no native validity).

A governed write through the plane appends one line and leaves the fixture's seven lines, a malformed one among them, byte for byte. A rewrite keeps them too, and the delete restores the original bytes (`packages/adapters/test/mcp-memory/mcp-memory.test.ts`). The line the plane writes:

```
{"type":"entity","name":"engram:01920000-0000-7000-8000-000000000001","entityType":"engram","observations":[],"engram":{"id":"01920000-0000-7000-8000-000000000001","class":"semantic","scope":"person:dana",...}}
```

The e2e CLI smoke (`test/e2e/cli.e2e.test.ts`, 16 passed) writes, reads and explains on an mcp-memory file, on SQLite and on embedded Postgres. `make test-e2e` as a whole was not run (the machine's load rule).

Guard: no registered config names the store, and the runner's `STORES` is unchanged. Rows rerun:

- `h2-perf-budget`: `0ebdd59c...` unchanged
- `h2-cost-table`: `074d4fb0...` unchanged

`make bench BENCH=gatemem` (fake, mem0, letta) made 0 new calls, with 20 model and 24 judge calls from cassettes.

## Log entry

- docs/log/2026-11-28-a6-mcp-memory-adapter.md
- docs/log/2026-11-28-a6-store-wiring.md
- docs/log/2026-11-28-a6-entity-encoding.md
- docs/log/2026-11-28-a6-derived-refs.md
- docs/log/2026-11-28-a6-shared-lock.md
- docs/log/2026-11-28-a6-root-names-file.md
- docs/log/2026-11-28-a6-doctor-check-name.md
- docs/log/2026-11-28-a6-no-notice.md
- docs/log/2026-11-28-a6-request-identity.md
- docs/log/2026-11-28-a6-server-tools-bypass.md
- docs/log/2026-11-28-a6-register-duplicates.md
- docs/log/2026-11-28-a6-mtime-after-test-clock.md
- docs/log/2026-11-28-a6-heredoc-edit.md

## Checklist

- [x] acceptance command passes locally
- [ ] make test passes (left to the orchestrator's serial run)
- [x] tests required by docs/conventions/testing.md are included
- [x] docs/deps.md updated if a dependency was added (none added)
- [x] docs/absorbed.md and NOTICE updated if code or data was copied or ported (ADR 0037): one port row; no NOTICE entry, since nothing was copied
- [x] AGENTS.md updated if a rule or command changed
- [x] ADR added if a choice another card could have made differently (none: the choices are inside the adapter, behind ADR 0013's contract)
- [x] no em dashes in prose

🤖 Generated with [Claude Code](https://claude.com/claude-code)
