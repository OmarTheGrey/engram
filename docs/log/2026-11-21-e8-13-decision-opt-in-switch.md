---
date: 2026-11-21
author: claude-agent
type: decision
card: E8.13
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/export.ts
  - packages/cli/test/export.test.ts
supersedes: none
---

**What.** Only `--otlp`, `--export-jsonl`, `ENGRAM_OTLP_URL` or `ENGRAM_EXPORT_JSONL` turn the export on. `OTEL_EXPORTER_OTLP_ENDPOINT` and the other `OTEL_*` variables never do; once on, the exporter reads its headers from them as usual. The flags are refused with `--server`, since the server exports its own decisions. The cursor starts at the log's head, so only events appended after the export starts are sent, from whichever handle appended them.

**Why.** Organisations set `OTEL_*` for every service; honouring them would turn egress on without the operator choosing Engram's. A history replay on start would send a whole log at once.

**Result.** Tested: an `OTEL_EXPORTER_OTLP_ENDPOINT` pointed at the test's receiver gets nothing; the `ENGRAM_` variable writes the file; a pre-export event is not sent.

**Consequence.** Stated in ADR 0043 and the help text.
