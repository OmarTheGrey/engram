---
description: Engram memory governance (explain, lint, simulate, policy)
argument-hint: "<explain|lint|simulate|policy> [args]"
---
Engram command: `$1`, arguments: `${@:2}`.

Use the engram skill. Act on the command only through the Engram memory tools (memory_write, memory_read, memory_explain, memory_simulate); never read or edit a memory store's files or run a store's CLI directly.

- `explain <read id>`: call memory_explain with that read_id and report the score components, rank, admitting rule, grants and validity of each item it returned. With no id, say which of this session's memory_read calls can be explained.
- `lint`: report the lint findings for this session's memory scopes. The deterministic lints land with card L1; until then, say the lint is not available yet.
- `simulate`: call memory_simulate and report which decisions would change under the current policy, with each decision's reason and policy id. If the tool says it is not implemented yet, report that and the card it names.
- `policy`: state the policy this session runs under (its id and version from the Engram events in this session) and what it allows and forbids for this actor's scopes, from the decisions seen so far.

If the command is empty or not one of these four, list the four with one line each.
