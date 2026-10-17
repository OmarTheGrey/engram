# Related work

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Govern

**2026-10-23, A2, finding, supersedes 2026-10-18-mem0-history-gap.** Mem0 does keep update history, behind a separate endpoint. The earlier finding missed the endpoint. The history endpoint returns every version of a memory. The adapter sets native_history.[^1]

[^1]: <https://docs.mem0.ai/>
