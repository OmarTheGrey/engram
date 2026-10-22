# Timeline

Consolidated from docs/log by research/scripts/consolidate_log.py. Edit the entries, not this file.

| date | type | card | what | entry |
|---|---|---|---|---|
| 2026-10-17 | milestone | none | The body of knowledge for the repository was written before any code: operating manual, ADR 0001 (pi as base), documentation and testing conventions, proposed ADRs 0002 to 0023, the step-0 task list, the readings list and the glossary. | docs/log/2026-10-17-body-of-knowledge.md |
| 2026-10-17 | milestone | none | The literature review was added under `docs/readings/litreview/`: one note per paper in a fixed template (claim, method, key numbers with their table or section, what Engram borrows, what it does differently, risk to our claims, open question), an index by reading tier, and a frontier summary as of 2026-10-17. | docs/log/2026-10-17-literature-review.md |
| 2026-10-17 | decision | none | The lead removed the PR size limit: AGENTS.md rule 10 no longer caps a PR at 400 changed lines or asks for a card to be split first, and the card prompt pattern no longer says "Keep the diff under 400 lines". | docs/log/2026-10-17-remove-pr-size-limit.md |
| 2026-10-17 | milestone | S0.2 | Step-0 task S0.2 completed the body of knowledge and the harness setup: `make lint-docs` (em dashes in prose, CLAUDE.md equals AGENTS.md, log entry field set), a log template at `docs/log/_template.md`, the card prompt pattern and session rules in `.pi/APPEND_SYSTEM.md`, and `.claude/` settings and commands mirroring the three pi prompts. | docs/log/2026-10-17-s0-2-body-of-knowledge-and-pi-setup.md |
