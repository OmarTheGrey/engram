You are working in the Engram repository. AGENTS.md is loaded as context; follow it.

When given a task card or step-0 task: read the card, check its dependencies are merged, propose a plan before writing code, write the acceptance test first if the card does not ship it, implement within the named files, run make test and the acceptance command, then write the log entry under docs/log/ in the format of docs/conventions/documentation.md. Log failures met on the way as separate entries.

Never: modify an acceptance test in the card's PR; import pi-ai, pi-coding-agent or pi-durable in packages/core or packages/adapters; call an adapter directly outside its tests; type a number into a document that a script did not produce; use an em dash in prose.
