## Card

E9.15 The signed audit report: `engram audit export --from --to` writes a content-free statement of a window of the log in a DSSE envelope with an in-toto Statement, signed with the operator's key; `engram audit verify` checks it against the log.

## Plan

1. Core, pure: `packages/core/src/audit/report.ts` builds the statement (counts by decision, operation and rule, the chain head and latest checkpoint, the policy's sha256, the schema version, the oracle's count) and verifies a report in order: envelope, signature, statement, chain, head, checkpoint, counts recomputed to the report's head. `packages/core/src/audit/dsse.ts` ports DSSE's PAE and envelope, signer and check injected. Core reads no clock: the issuing time is given.
2. CLI: `packages/cli/src/audit.ts` signs with the operator's Ed25519 key through `signing.ts`; both commands registered with `home: false`.
3. TUI: a Verify an audit report screen, reached from the log verify screen's buttons and the palette.
4. Proof of concept: `research/scripts/audit_report.py` into `research/results/h1-audit-report.json`.

## Acceptance

Acceptance: `make test-one T=packages/core/test/unit/audit/report.test.ts`

## Evidence

`research/results/h1-audit-report.json` (sha256 dc1562bf...7f31f, the same on three runs):

```
"totals": {"cases": 11, "matched": 11, "tampering": 8, "tampering_detected": 8}
"envelope": {"bytes": 2979, "sha256": "c3f2a52a39548e0f2c6926f1e9b9dd47953fd9240b208ae38e43d7417a6b6b18"}
```

`engram audit verify` on the CLI fixture log:

```
engram audit verify: OK
  ok    envelope
  ok    signature
  ok    statement
  ok    chain
  ok    head
  ok    checkpoint
  ok    counts
```

## Log entry

- docs/log/2026-11-28-e9-15-change-statement-and-envelope.md
- docs/log/2026-11-28-e9-15-change-cli-commands.md
- docs/log/2026-11-28-e9-15-change-tui-screen.md
- docs/log/2026-11-28-e9-15-measurement-audit-report.md
- docs/log/2026-11-28-e9-15-decision-reach.md
- docs/log/2026-11-28-e9-15-decision-recompute-at-head.md
- docs/log/2026-11-28-e9-15-decision-envelope-in-core.md
- docs/log/2026-11-28-e9-15-finding-oracle-memberships.md
- docs/log/2026-11-28-e9-15-failure-oracle-expectation.md
- docs/log/2026-11-28-e9-15-failure-help-line.md
- docs/log/2026-11-28-e9-15-failure-merge-result-file.md

## Checklist

- [x] acceptance command passes locally (28 of 28 with Postgres)
- [ ] make test passes (not run under the load rule; the core project ran whole: 117 files, 3,578 passed, 1 skipped)
- [x] tests required by docs/conventions/testing.md are included
- [x] docs/deps.md updated if a dependency was added (none added)
- [x] docs/absorbed.md and NOTICE updated if code or data was copied or ported (two ports, no copy, so no NOTICE entry)
- [x] AGENTS.md updated if a rule or command changed
- [x] ADR added if a choice another card could have made differently (none: follows ADR 0038's injected signer; decisions logged)
- [x] no em dashes in prose

🤖 Generated with [Claude Code](https://claude.com/claude-code)
