# @engram/cli

The `engram` command. It calls core and the adapters through the HTTP API's generated client and holds no policy logic. Back to the [root README](../../README.md).

## Rules

- **One client call per command** (card E8.2, ADR [0027](../../docs/decisions/0027-http-contract-client-and-inspector.md)), except `doctor`, `serve`, `mcp` and `hook`, which are not plane calls of their own. In process, the client's fetch is the server app over the workspace the flags open, so no command needs a running server; with `--server <url>` (or `ENGRAM_SERVER_URL`) the same call goes over HTTP to `engram serve`.
- **No policy `if`** (AGENTS.md rule 1). The CLI builds the actor from `--as`, `--level` and `--member` and prints what the Plane decided.
- **It never calls an adapter outside the plane** (rule 2). The workspace opener in `@engram/server` opens the log, the policy and the store. The one exception is `engram doctor`: it builds its own Mem0 and Letta adapters, each on a temporary folder or an in-memory store, and checks them through a Plane on an in-memory log, except three calls (`history`, `delete`, `read`) its Letta check makes on its own probe, since the plane has neither history nor delete.
- **Writes are recorded as source `user`** by the acting principal, whatever the item claims (decision D4 of ADR [0004](../../docs/decisions/0004-provenance-and-source-trust.md): the harness, not the caller, sets provenance).
- **The clock is the real one.** Only `read --at` changes the time validity windows are judged at; `--at` on any other command is refused unless `--test-clock` (tests and fixtures only) is given in process.
- **Identity is self-asserted.** `--as` and `--member` are taken as given; there is no authentication yet.

## Commands

| command | what it does |
|---|---|
| `engram write` | write one item through the write gate (`--content` or `--file`, `--scope`, `--class`, `--confidence`, `--valid-from`, `--valid-to`) |
| `engram read [query]` | adopt the store's own memories, then read through the plane and explain every returned item |
| `engram read --item <id>` | one item by its id through the read filter, explained, with read's output (card E8.15a over E8.14's route) |
| `engram check` | the decision `engram write` would get with the same flags: nothing stored, no event; exit 1 on deny or ask (card E8.15a) |
| `engram explain <readId>` | the explanations a read recorded, for the reader who made it only |
| `engram promote <itemId> --to <scope>` | promote through the promotion gate; `--review` approves as a reviewer |
| `engram grants <itemId> --add <grant> --remove <grant>` | one governed grant change as the item's owner, a grant written `<to>[,class=..][,mode=..][,expires=..]` (card E8.15a) |
| `engram events [--after <seq>]` | the events the actor may see, each with its decision, rule and reason (card E8.15a) |
| `engram scopes` | the scopes the actor can see, by membership or through a grant; a read (card E8.15a over E8.14's route) |
| `engram retain --scope <scope>` | sweep one scope's retention: expired items retired, budgets enforced |
| `engram lint --scope <scope>` | the policy's deterministic lints over one scope; exit 1 on a finding |
| `engram simulate --workload <file> --policy <p> --candidate <p>` | replay a recorded workload under two policies on scratch logs and stores; `--json` for the report |
| `engram policy` | the policy in force and its label, as YAML a policy file may hold; no actor, no log (card E8.15a) |
| `engram serve` | the HTTP API and the inspector on loopback (default port 7313) |
| `engram mcp` | the MCP server for Claude Code and Codex, over stdio or `--http <port>` |
| `engram hook claude-code` | the Claude Code PreToolUse hook that blocks store bypasses |
| `engram doctor` | check the log (never creating one), the policy, the store, the adapters, provider keys by name only, benchmark pins, the pi pin and Node |

Shared flags: `--store files|letta`, `--root <folder>`, `--owner <id>`, `--policy strict|medium|permissive|<file>`, `--db <sqlite file|:memory:|postgres://...>` (default `ENGRAM_DB_URL`, else `<home>/.engram/engram.db`), `--json`. `engram --help` prints them all.

## Main modules

| module | what it holds |
|---|---|
| `src/main.ts` | the entry point (`bin: engram`) |
| `src/registry.ts` | the command registry (card E8.15a): one entry per command with its flags, help lines, group, exit codes and what it writes; HELP, the command table and every handler's parse config come from it |
| `src/run.ts` | `run(argv, io)` and the help text; every id and time comes from the injected `Io`, so a run with a fixed `Io` is reproducible |
| `src/commands.ts` | the commands that reach the plane, each one client call, split into `prepare`, `call` and `print` (card E8.15a) so the TUI makes the same call |
| `src/connect.ts` | the in-process client, or the client to `--server` |
| `src/serve.ts`, `src/mcp.ts`, `src/hook.ts` | `engram serve`, `engram mcp` and `engram hook claude-code` |
| `src/doctor.ts` | `engram doctor`: one line per check with its reason; secrets in a Postgres URL are never printed |
| `src/format.ts` | the human-readable output |
| `src/setup.ts`, `src/store.ts`, `src/uuid.ts` | the actor and flag checks, the workspace re-exports, `uuidv7` |

## Use

From a clone, `node packages/cli/src/main.ts <command>` or `make engram ARGS="<command> ..."`:

```sh
engram write --root /tmp/demo/memory --owner alice --db /tmp/demo/engram.db --content "The deploy key rotates every 90 days."
engram read deploy --root /tmp/demo/memory --owner alice --db /tmp/demo/engram.db
engram explain <read id> --owner alice --db /tmp/demo/engram.db
engram read --root ~/.claude/projects/<project>/memory --owner alice     # your own Claude Code memory, adopted as person:alice
```

## Test

```sh
pnpm --filter cli exec vitest run
pnpm exec playwright install chromium   # once: make test-e2e also runs the inspector in Chromium
make test-e2e        # builds the inspector (make ui) first; layer 6: doctor and a write, read, explain smoke on SQLite and embedded Postgres, on a temp folder and on a Letta repository
```

`test/commands.test.ts` holds the help snapshot (card E8.2's acceptance) and `test/main.test.ts` runs the binary as a process; there is a test file per command (`write`, `read`, `explain`, `promote`, `simulate`, `doctor`, `hook`), and `test/redaction.property.test.ts` checks that no secret in a Postgres URL reaches the output.

## What is next

- Card E9.8: `engram export` (a portable JSONL bundle of what the actor owns) and `engram import` (every row a governed candidate write by a dedicated import actor, grants dropped).
- Card E1.6: `engram log verify`, which checks the tamper-evident chain of the event log.
- Card E2.13: who can read an item, through the generated client.
- Card E8.12: verified actors; `--as` stays for stdio, and the HTTP surfaces take tokens.
- Card L6: supersession proposals (an end date for a fact a newer one replaces) applied as ordinary governed updates.
- Card E2.11: the trust floors, opt-in options of the policy file the CLI loads.
- Card E8.13: decisions exported as OpenTelemetry spans, off by default.

All of these are in progress since 2026-11-21; none has merged.
