---
date: 2026-11-21
author: claude-agent
type: change
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/export.ts
  - packages/server/test/export.test.ts
  - packages/cli/test/export.test.ts
  - "make test-one T=packages/server/test/export.test.ts"
  - "make test-one T=packages/cli/test/export.test.ts"
supersedes: none
---

**What.** Two sinks in `packages/server/src/export.ts`, a JSONL file and OTLP over HTTP through the OpenTelemetry SDK, flushed by `createApp` after every API call; the CLI's `--otlp` and `--export-jsonl` (or `ENGRAM_OTLP_URL`, `ENGRAM_EXPORT_JSONL`) on read, write, promote, retain, lint, serve, mcp and the hook.

**Why.** Card E8.13, step 3: both sinks, off unless configured, no webhook.

**Result.** Server tests 8 of 8 and CLI tests 6 of 6 pass. The OTLP tests post to a receiver on a loopback port in the test (no network); the received body has resource `service.name` engram only and no content. Mutations: removing the app's flush fails 4 server tests; not awaiting `drainExports` in `run` fails the CLI OTLP test.

**Consequence.** `engram serve` prints the sinks it exports to; a failed export goes to stderr and never fails the call.
