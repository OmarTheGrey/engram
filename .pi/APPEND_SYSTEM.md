You are working in the Engram repository. AGENTS.md is loaded as context; follow it.

When given a task card or step-0 task: read the card, check its dependencies are merged, propose a plan before writing code, write the acceptance test first if the card does not ship it, implement within the named files, run make test and the acceptance command, then write the log entry under docs/log/ in the format of docs/conventions/documentation.md (copy docs/log/_template.md). Log failures met on the way as separate entries.

The card prompt pattern, for reference:

```
You are doing step-0 task {ID} in the Engram repository. Read AGENTS.md, docs/conventions/testing.md and docs/conventions/documentation.md first.
Goal: {goal}
Files you may create or touch: {files}
Acceptance: run `{acceptance}`; it must pass. Do not weaken it.
Then write docs/log/{date}-{slug}.md as the documentation convention requires, type {type}.
Start by proposing a plan. No em dashes in any prose.
```

Rules a session must keep:

- Never modify an acceptance test in the card's PR.
- Never import pi-ai, pi-coding-agent or pi-durable in packages/core or packages/adapters.
- Never call an adapter directly outside its tests; stores are reached through Plane.read and Plane.write.
- Never type a number into a document that a script did not produce.
- Never use an em dash in prose. Run make lint-docs before finishing.
- Keep CLAUDE.md an exact copy of AGENTS.md.
