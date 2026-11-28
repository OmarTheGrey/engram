## Card

E8.16 Cross-surface parity and leak suite (second absorb plan, pull request 3 of 30). Depends on RD1, merged in #127.

## Plan

- A canary workspace shared by every suite (`packages/server/test/leakage-kit.ts`): thirteen nonces seeded from `research/configs/leakage.json`, written through seven write paths (write, a denied write, a grant change, import and promotion, supersession, adoption of a store record, an offboarding's erasure), and four probe actors: a non-member, an expired grantee, a former member after offboarding, a partial grantee. A positive control (a member of the team) must find the team's canaries.
- The HTTP API: every route of the route table probed as each actor, a closed exemption list whose reasons are checked, no status outside a route's declared ones, and the denied-and-missing comparison with its pinned characterisations.
- MCP: every tool the server can list, memory_supersede included.
- The CLI and the TUI: thirteen user operations through the HTTP API, the CLI, the CLI against a server and the TUI's runner, compared field by field; every registry command probed through the CLI and the TUI; the TUI's drawn screen scanned.
- The pi extension: a model's five operations in a real pi session matched against the snapshot MCP matches (`packages/server/test/__parity__/model-operations.json`), and each actor's model context and session record scanned.
- The count as a proof-of-concept result: `research/scripts/leakage.py` into `research/results/h1-leakage.json`, its MANIFEST row and its section in the results register (new status: proof of concept).
- Leaks RD1 leaves are pinned as characterisation tests and logged as findings, not fixed.

Acceptance: `make test-one T=packages/server/test/leakage.test.ts`, `make test-one T=packages/mcp/test/leakage.test.ts`, `make test-one T=packages/cli/test/parity.test.ts`, `make test-one T=packages/pi-extension/test/parity.test.ts` and `make test-e2e`

## Evidence

From `research/results/h1-leakage.json` (sha256 `2b7554d928d1ab07a1d1865241662f1feaa8f8245bebb5ad09c448b9138dca85`, the same on three runs):

```
canaries.written            13
totals.probes               2221   (http 728, mcp 288, cli 576, tui 581, pi 48)
totals.leaks                0
denied_and_missing.http     12 compared, 8 alike; characterised: write, checkWrite, explain, read (reason counts)
denied_and_missing.mcp      3 compared, 2 alike; characterised: memory_explain
parity                      13 of 13 on http, cli, cli --server and tui; 5 of 5 on mcp and pi
positive_control            dana-team, fred-team, lee-team found on every surface
suite_passed                true
```

Two mutations were checked and reverted: `eventVisibleTo` showing every team:x event fails 12 tests (HTTP, CLI, TUI); `liveGrants` admitting expired grants fails 4 (HTTP, MCP, pi).

## Log entries

- docs/log/2026-11-28-e8-16-change-http-leak-suite.md
- docs/log/2026-11-28-e8-16-change-mcp-leak-suite.md
- docs/log/2026-11-28-e8-16-change-cli-tui-parity.md
- docs/log/2026-11-28-e8-16-change-pi-parity.md
- docs/log/2026-11-28-e8-16-change-register-proof-of-concept.md
- docs/log/2026-11-28-e8-16-measurement-leak-count.md
- docs/log/2026-11-28-e8-16-decision-shared-kit.md
- docs/log/2026-11-28-e8-16-decision-former-member.md
- docs/log/2026-11-28-e8-16-decision-erased-id.md
- docs/log/2026-11-28-e8-16-decision-parity-fields.md
- docs/log/2026-11-28-e8-16-decision-tui-surface.md
- docs/log/2026-11-28-e8-16-decision-pi-files-store.md
- docs/log/2026-11-28-e8-16-decision-echo-passes.md
- docs/log/2026-11-28-e8-16-finding-write-id-oracle.md
- docs/log/2026-11-28-e8-16-finding-explain-403-404.md
- docs/log/2026-11-28-e8-16-finding-read-reason-counts.md
- docs/log/2026-11-28-e8-16-failure-asked-ids-hid-a-leak.md
- docs/log/2026-11-28-e8-16-failure-probe-nonces-to-model.md
- docs/log/2026-11-28-e8-16-failure-pi-snapshot-fake-store.md
- docs/log/2026-11-28-e8-16-failure-probe-wrote-under-a-canary-id.md
- docs/log/2026-11-28-e8-16-failure-cli-mcp-sdk.md

## Checklist

- [x] The acceptance's four test files pass locally (11, 8, 26 and 8 tests); `make test-e2e` left to the orchestrator's serial run, as the addendum asks.
- [x] Tests only in packages: no product code, no schema, no route, no registered preset or config changed.
- [x] `make lint`, `make lint-docs`, `make results-register CHECK=1` pass.
- [x] A log entry per deliverable, decision, finding, failure and the measurement.
- [x] `docs/absorbed.md` and `NOTICE` updated for the port of ClickHouse/loom's suite (Apache-2.0, LICENSE and NOTICE read at `61b22646a1af`).
- [x] No new dependency.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
