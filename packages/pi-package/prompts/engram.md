---
description: Engram memory governance (explain, lint, simulate, policy)
argument-hint: "<explain|lint|simulate|policy> [args]"
---
Engram command: `$1`, arguments: `${@:2}`.

Use the engram skill. Act on the command only through the Engram memory tools this session has (memory_write, memory_read, memory_explain, memory_simulate, and memory_lint when it is registered); never read or edit a memory store's files or run a store's CLI directly.

- `explain <read id>`: call memory_explain with that read_id and report the score components, rank, admitting rule, grants and validity of each item it returned. With no id, say which of this session's memory_read calls can be explained.
- `lint [scope]`: if this session has a memory_lint tool, call it for the scope given (with none, for each of this session's scopes) and report each finding with its lint, item and reason. If it has no memory_lint tool, say that lint is not available as an Engram tool in this session.
- `simulate [strict|medium|permissive]`: call memory_simulate, passing the preset as its candidate when one is given, and report which decisions, recall and evictions would change, with each decision's reason and policy id. If the tool says it is not implemented yet, report that and the card it names.
- `policy`: state the policy this session runs under (its id and version from the Engram events in this session) and what it allows and forbids for this actor's scopes, from the decisions seen so far.

If the command is empty or not one of these four, list the four with one line each.
