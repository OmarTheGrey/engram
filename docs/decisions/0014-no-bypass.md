# ADR 0014: No-bypass: store commands blocked in bash; MCP store tools wrapped

Status: accepted with amendments, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Invariant 2 is meaningless if an agent can write to the store from a shell; MPBench's write channels include tool outputs.

## Decision

The extension's `user_bash` and `tool_call` handlers block a configured list of store commands and endpoints (`mem0`, `letta`, direct file writes under adapter roots) and route them through the Engram tools. MCP tools that reach a store are wrapped so their calls pass the gate. A blocked bypass is an event.

Amendments made when deciding:

- Amended from S0.5: pi emits user_bash only for the user's `!` commands and only from its interactive and RPC hosts, so the model's bash tool is gated in tool_call with the same command list and the runner emits user_bash itself.
- user_bash cannot block a command, so a block is a replacement result with exit code 126, recorded as an event.

Amendments made in the review fix pass, 2026-10-25 (PR #7, findings R7-1 to R7-15; pending the lead's review like the rest of this ADR):

- Decision D10 (finding R7-1): shell text cannot be parsed into a complete answer, so the check errs towards blocking. A command is a store command if any word of it, after removing quotes, a leading path, an executable suffix (`.exe`, `.cmd` and the like) and case, and on either side of an `=`, is a known store name (`mem0`, `letta`), wherever it stands: behind wrappers (env, sudo, exec, time, xargs, npx, uvx, `pnpm dlx`, `python -m`), inside `bash -c` and `sh -c` arguments, subshells, braces, `$()`, backticks, and after `&`, `;`, `|`, `&&`, `||`. The check runs for user_bash and for the model's bash and powershell tools. Mentions that would not run the store (`echo mem0`) are blocked too; that is the cost of erring this way.
- Decision D10: pi's file tools (read, write, edit, grep, find, ls) and any tool with a path argument are blocked, as a `Plane.recordBypass` event with policy_id `engram/bypass/store-path`, on a path that resolves inside a configured store root (realpath of the path or its nearest existing ancestor, else the normalised absolute path, without case on Windows). grep and find are also blocked when a root lies inside the directory they search. A shell command word that is such a path is blocked the same way.
- Limit, recorded as D10 asks: a store name that a variable, an alias, a function or a script supplies at run time (`$STORE add x`, `$(printf mem%s 0)`), and a shell command that reaches a root through a path it computes, are out of reach of any text check. The extension's header comment says the same; nothing more is claimed.
- Finding R7-9: `Plane.recordBypass` keeps what was attempted in the event's reason (`...; attempted: <command>`), on one line, cut to 160 characters, with values that look like secrets (`NAME_KEY=`, `--token`, `Bearer`, URL credentials, `sk-` and long key-like strings) replaced by `<redacted>`. It refuses an invalid actor, time or bypass with `InvalidCallError`, as every other Plane call does (decision D6). A bypass has a route: `command` (`engram/bypass/store-command`), `path` (`engram/bypass/store-path`) and `result` (`engram/bypass/foreign-result`, decision D11, see ADR 0009).

Amendments made in the second review round, 2026-10-29 (PR #7, verifier report defects 1, 2 and 4; pending the lead's review like the rest of this ADR):

- Defect 1: shell text is normalised as a shell reads it before the word check: a backslash-newline continuation is joined, `$'...'` quoting is decoded, cmd's `^` escape is dropped, and brace expansion (`me{m,}0`, `mem{0..1}`, nested groups) is expanded. Each word is also read with C escapes decoded (printf, `echo -e`), with `+` removed (`'me'+'m0'`), with PowerShell's backtick escape removed, split at `:` (`${X:-mem0}`) and at `@` (`mem0@latest`), and without leading dashes or `!`. A word with glob characters and at least two literal characters is matched as a pattern against the store names (`mem?`, `mem*`, `m[e]m0`). Still out of reach, and not claimed: a name assembled at run time (`$(printf mem%s 0)`, `x=me; ${x}m0`), a glob with fewer than two literal characters (`m*`, `*`), and lookalike letters of another alphabet.
- Defect 2: on Windows, a Git Bash, MSYS, Cygwin or WSL drive path (`/c/x`, `/cygdrive/c/x`, `/mnt/c/x`) is read as `C:\x` before the store-root check, in shell commands and in file tool arguments, as pi's own tools read it. File tool arguments are also resolved the rest of the way pi resolves them (unicode spaces, `file://` URLs), and the path as written is checked as well.
- Defect 4: "any tool with a path argument" now means: every string under a key that names a path (`path`, `file`, `dir`, `src`, `target`, `dest` and the like) at any depth of the arguments, and every one-line string anywhere in them that is a path on its own (absolute, `~/`, `./`, `../`, a `file://` URL). A relative path inside other free text (an edit's old text, a file's new content, a search pattern) is not read as a path, to avoid blocking ordinary edits that mention one; a hard link to a store file from outside the root is not seen either.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks PX1, Gate A check. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
