# The engram terminal interface: design

Status: design for card E8.15, 2026-11-21. Proposed with [ADR 0044](../decisions/0044-cli-tui.md), for the lead's acceptance. The implementation card is [`docs/tasks/E8.15.md`](../tasks/E8.15.md), split into E8.15a to E8.15e.

The lead asked for a terminal interface to the `engram` CLI that is as friendly and appealing as possible, loses no function or feature, and makes everything easy to reach and use without a hitch. This document is the specification a later card builds from. Where it says "must", the implementation card's tests check it.

## 1. Decisions at a glance

| question | answer | section |
|---|---|---|
| library | `@earendil-works/pi-tui` 1.3.0, the pi family's own terminal library, pinned with pi; ADR 0033's import list amended for `packages/cli` | ADR 0044 |
| entry | `engram tui`; bare `engram` keeps its pinned help on stderr and exit 2 | 5 |
| where the TUI refuses | stdout or stdin not a TTY, `CI` set, `TERM=dumb`, `--json` anywhere on the line; it then prints one line and exits 2 | 5.2 |
| what it calls | exactly the generated client call the plain command makes, through the same `connect`; in process or `--server` | 6 |
| how it teaches | every action shows its exact command line before it runs, `c` copies it, and quitting prints the session's commands | 4 |
| one registry | `packages/cli/src/registry.ts` holds every command, flag, default, help line and exit code; `run.ts`, `HELP`, the palette and every form come from it | 6.1 |
| plain CLI | every existing output and exit code byte for byte; only additions: new commands, a second "did you mean" line on unknown commands and flags | 12 |
| accessibility | full keyboard, mouse optional, `NO_COLOR` and `--no-color`, a high-contrast palette, Okabe-Ito status colours always paired with a symbol and a word, `--reduced-motion`, `--ascii`, a line mode for screen readers, 80x24 minimum | 11 |
| undo | only for a grant change, whose inverse is itself a governed grant change; nothing else the plane does can be undone | 9.6 |

## 2. Sources this design is built from

- `packages/cli/src/run.ts` (HELP, the command table, `Io`, exit codes), `commands.ts`, `format.ts`, `setup.ts`, `connect.ts`, `doctor.ts`, `serve.ts`, `mcp.ts`, `hook.ts`, and the tests that pin their output (`packages/cli/test/commands.test.ts` holds the help snapshot).
- `packages/server/src/routes.ts`, the route table every surface calls (ADR 0027).
- The inspector, `packages/ui/src/`: the viewer picker, scope lanes in person, role, shared and granted groups, the grants editor, the timeline, the explain view (`view.ts`), and since card E8.11 the item page with its provenance graph, versions diff and "Events naming this item" table (`provenance.ts`, `ItemPage.tsx`, `EventTable.tsx`). The TUI uses the inspector's words for the same things.
- ADRs 0001 (pi as base), 0014 (no bypass), 0027 (one HTTP contract), 0033 (where pi packages may be imported), 0037 (absorbing open source).
- The branches of the cards in flight on 2026-11-21, read without changing them (section 3.7).
- Every sample output below was produced by running the CLI of this commit on the fixtures (`fixtures/stores/claude-code-memory`, `fixtures/workloads/e8-9-two-presets.json`, `fixtures/faults/duplicate.flag.json`) on this machine. Long temporary paths are shortened to `~/demo` in the mockups; ids, reasons, policy ids and numbers are as printed.

## 3. Inventory

"Without discounting any functionalities" is a hard requirement. This section lists everything the CLI has and will have, and where each lives in the TUI. Section 3.8 is the check that nothing is lost.

### 3.1 Commands

| command | what it does | client call | exit codes | output modes | TUI screen |
|---|---|---|---|---|---|
| `read [query]` | adopt the store's memories as its owner, sweep the owner's retention, read through the plane, explain every item | `POST /read` | 0 done; 1 error; 2 usage | text, `--json` | Read (8.5) |
| `write` | one item through the write gate | `POST /items` | 0 allow; 1 deny, ask or error; 2 usage | text, `--json` | Write (8.7) |
| `promote <itemId>` | the promotion gate, optionally as a reviewer | `POST /promote` | 0 allow; 1 deny or ask; 2 usage | text, `--json` | Promote (8.8) |
| `explain <readId>` | the explanations a read recorded, for its reader only | `POST /explain/{readId}` | 0; 1 another reader's read or unknown read; 2 usage | text, `--json` | Explain (8.6) |
| `retain` | sweep one scope's retention | `POST /retain` | 0 allow; 1 refused; 2 usage | text, `--json` | Retention (8.9) |
| `lint` | the policy's deterministic lints over one scope | `POST /lint` | 0 clean; 1 a finding or refused; 2 usage | text, `--json` | Lint (8.10) |
| `simulate` | replay a workload under the policy and a candidate on scratch logs | `POST /simulate` | 0; 1 bad workload; 2 usage | text, `--json` | Simulate (8.11) |
| `serve` | the HTTP API and the inspector on loopback until stopped | none (it is the server) | 0 when stopped; 1 error; 2 usage | one line on start, one on stop | Serve (8.13) |
| `mcp` | the MCP server, stdio or `--http <port>` | one client call per tool call | 0 when stopped; 2 usage | MCP protocol on stdout (stdio); one stderr line (HTTP) | MCP (8.14) |
| `hook claude-code` | the Claude Code PreToolUse hook | `POST /bypass` on a block | always 0 (the decision is in the JSON); 2 usage | deny JSON on stdout, or nothing | Hook setup (8.15) |
| `doctor` | check the log, policy, store, adapters, provider keys by name, pins, Node | none (local checks) | 0 all pass; 1 a check failed; 2 usage | text, `--json` | Doctor (8.12) |
| `--help`, `-h`, `help` | the help text on stdout | none | 0 | text | Help overlay (9.2) |
| no command | the help text on stderr | none | 2 | text | unchanged; `engram tui` is the entry (5.1) |
| unknown command | `engram: unknown command "<x>"; engram --help lists them` on stderr | none | 2 | text | palette search (9.3) |

### 3.2 Flags

Each flag, the commands that take it (today), and the TUI control that sets it. "Workspace bar" is the panel of section 8.3, shared by every screen; a value set there is passed to every command that takes the flag.

| flag | commands | meaning and default | TUI control |
|---|---|---|---|
| `--server <url>` | read, write, promote, explain, retain, lint, simulate, mcp, hook | call `engram serve` at the URL; default `$ENGRAM_SERVER_URL` | workspace bar, "Connection: server" |
| `--store <files\|letta>` | read, write, promote, retain, lint, serve, mcp | the adapter; default files | workspace bar, "Store kind" |
| `--root <folder>` | read, write, promote, retain, lint, serve, mcp, doctor; hook (repeatable, a different meaning) | the store folder | workspace bar, "Store folder"; hook setup, "Store roots" list |
| `--owner <id>` | read, write, promote, explain, retain, lint, serve, mcp | the store's owner; also the actor `person:<id>` when `--as` is absent | workspace bar, "Owner" |
| `--import-valid-from <iso>` | read, write, promote, retain, lint, serve, mcp | valid_from for adopted memories; default each file's mtime | workspace bar, advanced, "Imported valid from" |
| `--policy <preset\|path>` | every command | strict, medium, permissive or a YAML file; default medium | workspace bar, "Policy" (picker plus file path) |
| `--db <path\|url>` | every command | the log: SQLite file, `:memory:`, `postgres://`; default `$ENGRAM_DB_URL`, else `<home>/.engram/engram.db` | workspace bar, "Event log" |
| `--as <principal>` | read, write, promote, explain, retain, lint, serve, mcp, hook | who acts; default `person:<owner>` (hook: `agent:claude-code`) | workspace bar, "Acting as" (the inspector's viewer picker) |
| `--level <level>` | read, write, promote, explain, retain, lint, serve, mcp | person, role, team or org; default the actor's own | workspace bar, "Level" |
| `--member <scope>` | read, write, promote, explain, retain, lint, serve, mcp | a member scope, repeatable; default the actor's own scope | workspace bar, "Member of" (a list, add and remove) |
| `--at <iso>` | read (any command with `--test-clock`) | read: the time validity windows are judged at | Read form, "Validity at"; elsewhere hidden unless test clock is on |
| `--test-clock` | write, promote, retain, lint, in process | tests and fixtures only: `--at` sets the call's clock | workspace bar, advanced, "Test clock" (off; turning it on shows a warning and needs confirmation) |
| `--content <text>` | write | the item's content | Write form, "Content" (multi-line editor) |
| `--file <item.json>` | write | a JSON item the flags complete | Write form, "From file" |
| `--id <uuidv7>` | write | the item id; default a fresh UUIDv7 | Write form, advanced, "Id" |
| `--scope <scope>` | write, retain, lint | write: the item's scope (default the owner's person scope or the actor); retain and lint: the scope swept or linted | Write form "Scope"; Retention and Lint forms "Scope" |
| `--class <episodic\|semantic>` | write | default semantic | Write form, "Class" |
| `--confidence <0..1>` | write | default 0.9 | Write form, "Confidence" |
| `--valid-from <iso>`, `--valid-to <iso>` | write | default now and open | Write form, "Valid from", "Valid to" |
| `--to <scope>` | promote | the target scope | Promote form, "To scope" |
| `--review` | promote | approve as a reviewer | Promote form, "Approve as reviewer" |
| `--workload <file>` | simulate | a recorded workload; default empty | Simulate form, "Workload" |
| `--candidate <preset\|path>` | simulate | the policy compared; default the baseline | Simulate form, "Candidate" |
| `--host <address>` | serve | 127.0.0.1, ::1 or localhost | Serve form, "Host" |
| `--port <n>` | serve | default 7313 | Serve form, "Port" |
| `--http <port>` | mcp | streamable HTTP instead of stdio | MCP form, "Transport" |
| `--protect <file>` | hook | a file no tool may touch, repeatable | Hook setup, "Protected files" |
| `--json` | read, write, promote, explain, retain, lint, simulate, doctor | the machine-readable output | `J` on any result shows the exact `--json` body; the TUI itself refuses `--json` (5.2) |
| `-h`, `--help` | all | the full help | `?` |

### 3.3 Positionals

| positional | command | TUI control |
|---|---|---|
| `[query]` (words joined by spaces) | read | Read form, "Query" |
| `<itemId>` | promote | Promote form, "Item", picked from the last read or typed |
| `<readId>` | explain | Explain form, "Read", picked from the session's reads or typed |
| `claude-code` | hook | Hook setup, "Harness" (one choice today) |

### 3.4 Environment variables

| variable | read by | TUI |
|---|---|---|
| `ENGRAM_DB_URL` | every command with `--db` | workspace bar shows "Event log (from ENGRAM_DB_URL)" |
| `ENGRAM_SERVER_URL` | every client command | workspace bar shows "Connection: server (from ENGRAM_SERVER_URL)" |
| `HOME`, `USERPROFILE` | the default log `<home>/.engram/engram.db` (`Io.home`) | the log path shown |
| `CLAUDE_PROJECT_DIR` | hook | Hook setup resolves roots against it, as the hook does |
| provider key variables (`packages/runner/src/model/provider-keys.json`) | doctor, by name only | Doctor shows set names, never values |
| `NO_COLOR` | new, the TUI | no colour (11.2) |
| `ENGRAM_TUI_ASCII` | new, the TUI | `1` is `--ascii` |
| `ENGRAM_TUI_MOTION` | new, the TUI | `reduce` is `--reduced-motion` |
| `ENGRAM_TUI_CONTRAST` | new, the TUI | `high` is `--high-contrast` |
| `ENGRAM_TUI_MOUSE` | new, the TUI | `0` is `--no-mouse` |
| `CI`, `TERM` | new, the TUI's refusal | `CI` set, or `TERM=dumb`: the TUI does not start |
| `ENGRAM_OTLP_URL`, `ENGRAM_EXPORT_JSONL` | in flight, card E8.13 | workspace bar, "Decision export" |
| `ENGRAM_TOKEN` | in flight, card E8.12 | workspace bar, "Token: set" or "not set", never the value |

### 3.5 Exit codes and output streams

Today's contract, which the TUI never changes for a plain command:

- 0: done, allowed, clean, or stopped. 1: a denied write, a denied or asked promotion, a refused sweep, a lint finding, a failed doctor check, an error. 2: usage, or a 501 naming a card that has not landed.
- Results go to stdout; usage errors and errors go to stderr as `engram <command>: <message>`; the hook prints only its JSON; `mcp` over stdio writes nothing but MCP to stdout.

The TUI's own exit codes: 0 when quit; 2 when it refuses to start or gets a bad flag, with one line on stderr naming why (5.2). It never returns 1: a denial inside the TUI is shown, not exited on.

### 3.6 API routes no command calls today

The route table has routes the inspector uses that have no plain command. Leaving them out of the TUI would lose features (the grants editor, the timeline, the policy view), and putting them in without a command would break principle 4.1. So card E8.15a adds four plain commands, each one client call, built from the registry like the rest. They are new, so nothing pinned changes.

| route | used by | new plain command | TUI |
|---|---|---|---|
| `POST /items/check` | the pi extension's tool_call gate | `engram check` with the write flags: the decision a write would get, nothing stored, no event; exit 0 allow, 1 deny or ask | Write form's live "the gate would" preview (8.7) |
| `POST /events` | the inspector's timeline | `engram events [--after <seq>] [--json]`: the events the actor may see (`visibleEvents`) | Events (8.16) and the item page (8.17) |
| `GET /policy` | the inspector | `engram policy [--json]`: the policy the workspace decides with and its label | Policy (8.18) |
| `POST /grants` | the inspector's grants editor | `engram grants <itemId> [--add <to>[,class=..][,mode=..][,expires=..]]... [--remove ...]...`: one grant change as the owner | Grants (8.19) |
| `POST /bypass` | the hook | none: only a surface that blocked a bypass records one | not offered |
| `POST /distill` | answers 501 until card D2 | none until D2 adds one | Procedures (8.25), shows the 501 line |
| `GET /viewer`, `GET /health` | the inspector, layer 6 | none | the connection indicator in the status bar (server mode) |

Whether to add these four commands is the lead's call (section 14, item 2). Without them, the TUI ships without the four screens, and section 3.8 lists them as lost.

### 3.7 In flight on 2026-11-21

Read from the branches, read-only. The registry (6.1) takes each as one entry; none needs a redesign. Each screen is drawn in section 8 and marked there too.

| card, branch | adds | TUI |
|---|---|---|
| E9.8, `e9-8-import-export` | `engram export [--out <file>] [--recipient <age1...>]... [--passphrase-file <file>]` with the actor and log flags; route `POST /export`; always exit 0. `engram import <bundle> \| --claude <file> [--scope] [--confidence] [--identity <file>]... [--passphrase-file]` with the store and actor flags; one `POST /items` per row as `import:<importer>`; exit 0 all allowed, 1 any denied; `--json` `{importer, actor, source, rows, allowed, denied, lineage_dropped, id_map, decisions}` | Export and Import (8.20, 8.21); in flight, card E9.8 |
| E2.13, `e2-13-who-can-read` | `engram who-can-read <itemId> \| --scope <scope>` with store, actor and client flags and `--json`; routes `POST /who-can-read/item` and `/who-can-read/scope`; exit 0 answered, 1 refused, 2 bad id | Who can read (8.22), and `w` on any item; in flight, card E2.13 |
| E8.12, `e8-12-verified-actors` | ADR 0042 (proposed): `serve` and `mcp --http` take `--issuer`, `--jwks`, `--audience`, `--keys`, `--subjects`, `--resource`, `--insecure-loopback` and refuse to start without a credential flag or the waiver; `engram key create \| list \| revoke`; `ENGRAM_TOKEN`; a doctor check on serve flags; 401 and 403 `forbidden_actor` | Keys (8.23), the Serve and MCP forms' "Authentication" section, the status bar's token indicator; in flight, card E8.12 |
| E8.13, `e8-13-otel-export` | `--otlp <url>` and `--export-jsonl <file>` on read, write, promote, retain, lint, serve, mcp and hook; `ENGRAM_OTLP_URL`, `ENGRAM_EXPORT_JSONL`; refused with `--server`; a failed export is one stderr line that does not change the exit code | workspace bar, "Decision export"; in flight, card E8.13 |
| E1.6, `e1-6-tamper-evident-log` | `engram log verify` (first broken link, an UNSIGNED verdict for an unsigned checkpoint, Ed25519 checkpoint signing); flags not yet fixed | Log verify (8.24); in flight, card E1.6. The form is built from the registry entry when it lands |
| E2.12, `e2-12-cedar-export` | core only (`exportCedar`); no command | none until a command exists; the Policy screen reserves an action slot for it; in flight, card E2.12 |
| L5, `l5-near-duplicate-lint` | lint id `near-duplicate-tier`, threshold `lints.thresholds.near-duplicate`; a new finding reason and a policy load error | Lint shows it like any finding; in flight, card L5 |
| L6, `l6-supersession-helper` | route `POST /supersede` `{actor, item_id, accept?}` returning proposals and applied writes; the card promises a CLI | Supersede (8.26) and `s` on an item; in flight, card L6 |
| L7, `l7-nli-tier` | lint id `contradiction-nli` with `upper` and `lower` thresholds; `LintReport.nli`; runs only with a scorer, which the CLI does not pass | Lint shows its findings with tier `model` and the load errors; in flight, card L7 |
| D2, `d2-awm-induction` | runner only; the `/distill` route stays 501 | Procedures (8.25) shows the 501 line until a command exists; in flight, card D2 |
| D3, `d3-replay-gate` | promote rule `engram/promote/validation-source` and replay reasons; no new flag | Promote shows the reason as printed; in flight, card D3 |

### 3.8 Nothing is lost

Every row of 3.1 to 3.7 maps to a control. The check the implementation must pass, as a test (`packages/cli/test/tui/parity.test.ts`, section 13):

1. For every command in the registry, the TUI has a screen or names why not (only `help`, which is the overlay).
2. For every flag of every command in the registry, the command's form has a control whose value becomes exactly that flag, and a test sets each control and asserts the command line built.
3. For every command, the TUI action issues the same client call (method, path, body) as the plain command given the equivalent flags, through a counting transport (`Io.transport`).
4. For every `--json` output, the TUI's `J` view shows the same bytes.

| capability | plain CLI | TUI |
|---|---|---|
| every command of 3.1 | yes | yes, one screen each |
| every flag of 3.2 and positional of 3.3 | yes | yes, one control each, defaults shown as the CLI applies them |
| every environment variable of 3.4 | yes | yes, shown with its source; never a secret's value |
| exit codes | yes | each result shows "exit 0" or "exit 1" as the plain command would return, beside the decision |
| `--json` | yes | `J` shows it; `c` copies the command with `--json` when that view is open |
| in process and `--server` | yes | yes, the workspace bar switches; workspace flags are refused with a server, as the CLI refuses them |
| piping and scripting | yes | no, by design: the TUI is for people; it prints the commands to script with |
| check, events, policy, grants | no command today | yes, through the four commands of 3.6 if the lead accepts them |
| distill | 501 | shows the 501 line naming card D2 |
