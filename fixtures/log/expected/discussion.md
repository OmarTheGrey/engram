# Discussion

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

## Twin

**2026-10-21, E9.2, decision, H2.** A role scope is handed to a successor by event, never by copy. Copying would duplicate items outside their lineage. ADR 0021 accepted. Handover is replayable.[^1]

[^1]: `docs/decisions/0021-twin-scopes.md`
