# Design

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Plane

**2026-10-17, decision.** The plane is built on pi. pi exposes tool_call and context events where writes and reads can be intercepted. ADR 0001 accepted. packages/core stays free of pi imports.[^1]

[^1]: `docs/decisions/0001-pi-as-base.md`
