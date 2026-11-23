# The engram terminal interface: design

Status: design for card E8.15, 2026-11-21; review fix pass 2026-11-22. Card E8.15 is the lead's own request of 2026-11-21, not one of the absorb plan's thirty pull requests. [ADR 0044](../decisions/0044-cli-tui.md) is proposed, for the lead's acceptance; the six smaller calls of section 14 were decided on 2026-11-22 under the lead's delegation (`docs/tasks/lead-decisions.md`, item 62), and the design proceeds on them. The implementation card is [`docs/tasks/E8.15.md`](../tasks/E8.15.md), split into E8.15a to E8.15e.

The lead asked for a terminal interface to the `engram` CLI that is as friendly and appealing as possible, loses no function or feature, and makes everything easy to reach and use without a hitch. This document is the specification a later card builds from. Where it says "must", the implementation card's tests check it.

## 1. Decisions at a glance

| question | answer | section |
|---|---|---|
| library | `@earendil-works/pi-tui` 1.3.0, the pi family's own terminal library, at the pi pin, imported only under `packages/cli/src/tui/`; AGENTS.md's "What not to do" line amended for it (ADR 0044, proposed; the design proceeds on it under delegation) | ADR 0044 |
| entry | `engram tui`; bare `engram` keeps printing the help on stderr with exit 2, and the help's first line now names `engram tui` | 5 |
| where the TUI refuses | stdout or stdin not a TTY, `CI` set, `TERM=dumb`, `--json` anywhere on the line; it then prints one line and exits 2 | 5.2 |
| what it remembers | the workspace flags only, in `~/.engram/tui.json`; never content, ids, tokens or keys; "Forget saved workspace" deletes it | 8.3 |
| what it calls | exactly the generated client call the plain command makes, through the same `connect`; in process or `--server` | 6 |
| how it teaches | every action shows its exact command line before it runs, `c` copies it, and quitting prints the session's commands as a short list (`--quiet` turns it off) | 4 |
| one registry | `packages/cli/src/registry.ts` holds every command, flag, default, help line and exit code; `run.ts`, `HELP`, the palette and every form come from it | 6.1 |
| plain CLI | every existing output and exit code byte for byte, except HELP's first line, which names `engram tui`; additions: new commands and their help lines, a second "did you mean" line on unknown commands and flags | 12 |
| accessibility | full keyboard; mouse on by default with `--no-mouse` (Shift+drag selects text); `NO_COLOR` and `--no-color`; a high-contrast palette; status colours at 4.5:1 or better on dark and light themes, on the symbol only, always with a word; ASCII symbols by default in conhost; `--reduced-motion`; `--ascii`; line mode for screen readers (`--line`, `ENGRAM_TUI_LINE=1`); 80x24 minimum | 11 |
| confirmation | anything that changes state asks first, including a read with a store folder (it adopts the folder, and as the owner sweeps the owner's retention) the first time in a session | 9.5 |
| undo | only for a grant change, whose inverse is itself a governed grant change; nothing else the plane does can be undone | 9.6 |

## 2. Sources this design is built from

- `packages/cli/src/run.ts` (HELP, the command table, `Io`, exit codes), `commands.ts`, `format.ts`, `setup.ts`, `connect.ts`, `doctor.ts`, `serve.ts`, `mcp.ts`, `hook.ts`, and the tests that pin their output (`packages/cli/test/commands.test.ts` holds the help snapshot).
- `packages/server/src/routes.ts`, the route table every surface calls (ADR 0027).
- The inspector, `packages/ui/src/`: the viewer picker, scope lanes in person, role, shared and granted groups, the grants editor, the timeline, the explain view (`view.ts`), and since card E8.11 the item page with its provenance graph, versions diff and "Events naming this item" table (`provenance.ts`, `ItemPage.tsx`, `EventTable.tsx`). The TUI uses the inspector's words for the same things.
- ADRs 0001 (pi as base), 0014 (no bypass), 0027 (one HTTP contract), 0033 (where pi packages may be imported), 0037 (absorbing open source).
- The branches of the cards in flight on 2026-11-21 and 2026-11-22, read without changing them, and for card E1.6, whose branch had no commits, its card (section 3.7).
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
| `simulate` | replay a workload under the policy and a candidate on scratch logs | `POST /simulate` | 0; 1 a workload the plane rejects (400, a shape error); 2 usage, including a workload file that is not JSON | text, `--json` | Simulate (8.11) |
| `serve` | the HTTP API and the inspector on loopback until stopped | none (it is the server) | 0 when stopped; 1 error; 2 usage | one line on start, one on stop; accepts and ignores `--json` | Serve (8.13) |
| `mcp` | the MCP server, stdio or `--http <port>` | one client call per tool call | 0 when stopped; 1 an error (a log it cannot use, a port in use); 2 usage | MCP protocol on stdout (stdio); one stderr line (HTTP); accepts and ignores `--json` | MCP (8.14) |
| `hook claude-code` | the Claude Code PreToolUse hook | `POST /bypass` on a block | always 0 (the decision is in the JSON); 2 usage | deny JSON on stdout, or nothing | Hook setup (8.15) |
| `doctor` | check the log, policy, store, adapters, provider keys by name, pins, Node | none (local checks) | 0 all pass; 1 a check failed; 2 usage | text, `--json` | Doctor (8.12) |
| `--help`, `-h`, `help` | the help text on stdout | none | 0 | text | Help overlay (9.2) |
| no command | the help text on stderr | none | 2 | text | unchanged but for the help's first line (12.2); `engram tui` is the entry (5.1) |
| `tui` (new, E8.15b) | the terminal interface | the commands' own calls | 0 quit; 2 refused or usage | the screen; the session's commands on quit | itself |
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
| `--at <iso>` | read; write, promote, retain and lint refuse it unless `--test-clock` is given in process; explain and simulate do not take it | read: the time validity windows are judged at; elsewhere the call's clock, for tests and fixtures | Read form, "Judge validity windows at"; elsewhere shown only while Test clock is on |
| `--test-clock` | write, promote, retain, lint, in process (read accepts it and ignores it) | tests and fixtures only: `--at` sets the call's clock | workspace bar, advanced, "Test clock" (off; turning it on shows a warning and needs confirmation) |
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
| `--json` | read, write, promote, explain, retain, lint, simulate, doctor (serve and mcp accept it and ignore it) | the machine-readable output | `J` on any result shows the exact `--json` body; the TUI itself refuses `--json` (5.2) |
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
| `ENGRAM_TUI_LINE` | new, the TUI | `1` starts in line mode, as `--line` does |
| `WT_SESSION`, `TERM_PROGRAM`, `TMUX`, `MSYSTEM`, `COLORFGBG` | new, read by the TUI only | the terminal: which clipboard path to use (4.1), ASCII symbols in conhost (11.7), the winpty hint (5.2), the light or dark palette (11.3) |
| `CI`, `TERM` | new, the TUI's refusal | `CI` set, or `TERM=dumb`: the TUI does not start |
| `ENGRAM_OTLP_URL`, `ENGRAM_EXPORT_JSONL` | in flight, card E8.13 | workspace bar, "Decision export" |
| `ENGRAM_TOKEN` | card E8.12, merged | workspace bar, "Token: set" or "not set", never the value |

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
| `POST /distill` | answers 501 naming the backlog: no card implements it and no card plans an `engram distill` command | none | none: no Home entry; the palette lists "Procedures: not yet available (backlog)" with no action |
| `GET /viewer`, `GET /health` | the inspector, layer 6 | none | the connection indicator in the status bar (server mode) |

Decided on 2026-11-22 under the lead's delegation (section 14, item 3): the four commands are added by E8.15a. Card E8.14 adds two more routes of the same kind (`/read/{itemId}`, `/scopes`; section 3.7); E8.15a also adds `engram read --item <id>` and `engram scopes` once E8.14 has merged. Both of those routes append a read event, and `/read/{itemId}` runs the same sweep and adoption as `/read`, so the TUI treats them as reads (9.5): `engram scopes` is called once per actor per session and its answer cached for every scope picker, refreshed only when the person asks (`ctrl+r` in a picker), never once per picker opened.

### 3.7 In flight on 2026-11-21 (E8.12 merged since)

Read from the branches, read-only, on 2026-11-21 and 2026-11-22; card E1.6's row comes from its card, since its branch had no commits. The registry (6.1) takes each as one entry; none needs a redesign. Each screen is drawn in section 8 and marked there too.

| card, branch | adds | TUI |
|---|---|---|
| E9.8, `e9-8-import-export` | `engram export [--out <file>] [--recipient <age1...>]... [--passphrase-file <file>]` with the actor and log flags; route `POST /export`; always exit 0. `engram import <bundle> \| --claude <file> [--scope] [--confidence] [--identity <file>]... [--passphrase-file]` with the store and actor flags; one `POST /items` per row as `import:<importer>`; exit 0 all allowed, 1 any denied; `--json` `{importer, actor, source, rows, allowed, denied, lineage_dropped, id_map, decisions}` | Export and Import (8.20, 8.21); in flight, card E9.8 |
| E2.13, `e2-13-who-can-read` | `engram who-can-read <itemId> \| --scope <scope>` with store, actor and client flags and `--json`; routes `POST /who-can-read/item` and `/who-can-read/scope`; exit 0 answered, 1 refused, 2 bad id | Who can read (8.22), and `w` on any item; in flight, card E2.13 |
| E8.12, merged into main on 2026-11-22 (`1ecf4aa9`) | ADR 0042 (proposed). `serve` and `mcp --http` refuse to start without a credential: `--keys <file>`, or `--issuer` with `--jwks` and `--subjects` (and `--audience`, `--resource`), or the waiver `--insecure-loopback` ("the server needs authentication: give --keys <file> or --issuer with --jwks and --subjects, or --insecure-loopback to serve loopback with self-asserted actors (ADR 0042)"); a host beyond loopback only with credentials and an https `--resource`. `engram key create --keys <file> --as <principal> --source <kind> --expires <iso> [--level] [--member]...` prints the key once; `engram key list --keys <file>` prints `<masked>  <status>  <actor> (<level>, source <kind>)  expires <iso>`; `engram key revoke <id> --keys <file>`. `ENGRAM_TOKEN` is the bearer token sent over `--server`. `doctor` takes `--host` and serve's credential flags and fails a bind without authentication. 401 with `WWW-Authenticate`, 403 `forbidden_actor` | Keys (8.23); Serve and MCP built around a credential (8.13, 8.14); Doctor's form gains the bind flags; the status bar's token indicator; card E8.12, merged |
| E8.13, `e8-13-otel-export` | `--otlp <url>` and `--export-jsonl <file>` on read, write, promote, retain, lint, serve, mcp and hook; `ENGRAM_OTLP_URL`, `ENGRAM_EXPORT_JSONL`; refused with `--server`; a failed export is one stderr line that does not change the exit code; `run` waits for pending exports (`drainExports`) in its `finally`, which the prepare, call and print split of 6.2 must keep; with `--otlp` the decisions leave the machine for the named collector | workspace bar, "Decision export", which shows the collector's URL whenever it is on; in flight, card E8.13 |
| E1.6, card only (its branch had no commits) | `engram log verify` (first broken link, an UNSIGNED verdict for an unsigned checkpoint, Ed25519 checkpoint signing); flags not yet fixed | Log verify (8.24); in flight, card E1.6. The form is built from the registry entry when it lands |
| E2.12, `e2-12-cedar-export` | core only (`exportCedar`); no command | none until a command exists; the Policy screen reserves an action slot for it; in flight, card E2.12 |
| L5, `l5-near-duplicate-lint` | lint id `near-duplicate-tier`, threshold `lints.thresholds.near-duplicate`; a new finding reason and a policy load error | Lint shows it like any finding; in flight, card L5 |
| L6, `l6-supersession-helper` | `engram supersede <itemId> [--accept <id>]...` with the store, actor and client flags and `--json`: the plan (the chain's head, a close or review flag per readable ancestor), and each accepted close written as a new version through the write gate; exit 1 on an unresolved chain or a write not allowed; `engram mcp --supersede` also lists `memory_supersede`; route `POST /supersede` | Supersede (8.26) and `u` on an item; the MCP form's "Offer memory_supersede" toggle; in flight, card L6 |
| E8.14, `e8-14-framework-kit` | the packages `@engram/kit` and `@engram/ai-sdk` on the branch, `@engram/tag` planned (untracked in that worktree on 2026-11-22), all libraries with no command; `Plane.readById` and `listScopes` with routes `POST /read/{itemId}` (one item through the read filter with its explanation; one read event; with a store, the same sweep and adoption as `/read` first) and `POST /scopes` (the scopes the actor can see; one read event) | E8.15a adds `engram read --item <id>` and `engram scopes` after E8.14 merges (3.6): the item page opens by id, and scope pickers use the session's cached scopes; in flight, card E8.14 |
| L7, `l7-nli-tier` | lint id `contradiction-nli` with `upper` and `lower` thresholds; `LintReport.nli`; runs only with a scorer, which the CLI does not pass | Lint shows its findings with tier `model` and the load errors; in flight, card L7 |
| D2, `d2-awm-induction` (merged into `d3-replay-gate`) | runner only; the `/distill` route still answers 501 naming the backlog, and no card plans an `engram distill` command | none (3.6); in flight, card D2 |
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
| check, events, policy, grants | no command today | yes, through the four commands of 3.6, decided on 2026-11-22 |
| read by id, scopes (E8.14) | no command today | yes, through `engram read --item` and `engram scopes` once E8.14 merges |
| distill | 501, backlog | not reachable in either: no command exists or is planned; the palette says so |

## 4. Principles

1. **The TUI teaches the CLI.** Every action is labelled in plain language with its exact command line beside it, kept up to date as the form changes (`engram write --content "..." --scope person:dana`). Before an action runs, the confirmation shows the command; after it runs, the result shows it again with its exit code. `c` copies it. OSC 52 is never acknowledged by a terminal, so the path is chosen by terminal, not by a reply: OSC 52 in Windows Terminal (`WT_SESSION`), iTerm2, WezTerm and kitty (`TERM_PROGRAM`, `KITTY_WINDOW_ID`) and tmux (`TMUX`, which forwards it when `set-clipboard` is on); pi-tui's native clipboard (`getNativeClipboard`, exported in 1.3.0) on Windows and macOS elsewhere, conhost and VS Code's terminal included; and when neither applies, the status bar says "not copied: it will be printed when you quit". Quitting prints the session's commands to stdout as a short list under `# engram tui: the commands this session ran`, one a line with its exit code, so a person learns the CLI and can paste them into a script; `--quiet` turns this off.
2. **Nothing new is decided here.** The TUI shows what the plane decided, in the inspector's words: the decision, the reason, the policy id, the explanation. It holds no policy `if` (AGENTS.md rule 1). A form validates only what the CLI's own usage checks validate, with the same messages (9.4).
3. **One call per action, the same call.** An action is the plain command's client call, through the same `connect`, so it behaves the same in process and against `--server`, and prints the same text when shown in plain view (6.2).
4. **Calm by default.** Nothing moves unless work is under way; nothing beeps; no colour carries meaning alone; the screen never scrolls under the reader's cursor.
5. **Every state is a screen.** Empty, loading, error, offline, refused and denied each have a designed state with a next step (section 10). A blank pane is a bug.
6. **No dead ends.** Every screen has `esc` back, `?` help and the palette. Every error names the field or flag at fault and puts the cursor there.
7. **Safe by construction.** Anything that writes an item, retires, promotes, changes a grant, imports or erases asks first and names what it will do and whether it can be undone (9.5). A read is not always harmless: with a store folder, `/read` adopts the folder's memories into the log, and when the actor is the store's owner it first sweeps the owner's retention, which can retire expired items for good. So the first read with a store folder in a session asks, naming both (8.5), and every later read shows the same line in its command row. Lints, which only append lint events, do not ask.
8. **The screen never decides.** A denial shows the server's reason and policy id verbatim. The TUI derives no remedy from a reason or a rule id: its shortcuts only move to a form field and run the preview again, so the plane answers.

## 5. Entry and compatibility

### 5.1 How the TUI is entered

`engram tui [options]`. One entry, chosen over the alternatives for these reasons:

- **Bare `engram` stays as it is** (decided on 2026-11-22, section 14 item 2). It prints the help to stderr and exits 2, as `packages/cli/test/commands.test.ts` pins. Making the same word do two things depending on TTY detection surprises people in tmux, over SSH and in Git Bash's mintty, where Node may see pipes. So people find the TUI, the help's first line names it: `engram: the Engram control plane from the command line; engram tui opens the terminal interface`. That one line is the only change to an existing output (12.2).
- **Not `engram ui`.** "ui" already names the web inspector (`packages/ui`, `make ui`, served by `engram serve`). Two things called ui would confuse the help, the docs and the thesis.
- **`tui` is a new command name**, so no existing script or test can call it by accident.

On start the TUI loads the saved workspace (8.3), then applies the flags given, which win. `engram tui` takes the workspace flags (`--server`, `--store`, `--root`, `--owner`, `--import-valid-from`, `--policy`, `--db`, `--as`, `--level`, `--member`, and in flight `--otlp`, `--export-jsonl`), which prefill the workspace bar, plus its own:

| flag | meaning |
|---|---|
| `--line` | line mode: the plain CLI with prompts (11.6); also `ENGRAM_TUI_LINE=1` |
| `--no-color` | no colour; also `NO_COLOR` set to anything non-empty |
| `--high-contrast` | the high-contrast palette (11.3) |
| `--ascii` | ASCII box drawing and symbols (11.7) |
| `--reduced-motion` | no animation: the busy indicator is a static word (11.5) |
| `--no-mouse` | do not capture the mouse; the terminal's own selection works (with the mouse captured, Shift+drag selects text in most terminals) |
| `--quiet` | do not print the session's commands on quit |
| `--no-saved` | ignore the saved workspace for this session (8.3) |
| `--screen <name>` | open on a screen (`read`, `write`, `doctor` and every registry name), for docs and demos |

### 5.2 When the TUI refuses to start

The TUI must never start, and must never draw a single escape sequence, when any of these holds. It then prints one line to stderr and exits 2:

| condition | line printed |
|---|---|
| stdout is not a TTY | `engram tui: stdout is not a terminal; run the plain commands (engram --help lists them)` |
| stdin is not a TTY | `engram tui: stdin is not a terminal; run the plain commands (engram --help lists them)` |
| `CI` is set and non-empty | `engram tui: CI is set; run the plain commands (engram --help lists them)` |
| `TERM` is `dumb` | `engram tui: TERM is dumb; try engram tui --line, or the plain commands` |
| `--json` anywhere on the line | `engram tui: --json is for scripts; run the plain command with --json` |
| an unknown flag | the CLI's usage error shape, `engram tui: <parseArgs message>`, plus the "did you mean" line (12.2) |

Git Bash note, from the spike (ADR 0044): under Git for Windows' mintty without a pseudoconsole, Node sees pipes, so the first row applies and the person is told to run the plain commands; under Windows Terminal, conhost or mintty with ConPTY, Node sees a TTY and the TUI starts. The line also suggests `winpty engram tui` when `MSYSTEM` is set and stdin is a pipe.

The TUI is a human surface. Inside a pi session, ADR 0014 already blocks `engram` by name, so a model cannot start it either.

### 5.3 What stays byte for byte

Every existing invocation of every existing command keeps its exact stdout, stderr and exit code, with one decided exception: `HELP`'s first line names `engram tui` (section 14, item 2), which also changes what bare `engram` prints to stderr; its exit code stays 2. Otherwise, in particular: the rest of `HELP` for the existing commands, every text and `--json` output, every usage error message, the hook's JSON and `mcp`'s stdout. The help snapshot changes by that first line and by the lines each new command adds (`tui`, `check`, `events`, `policy`, `grants`, then `scopes` and `read --item`), exactly as cards E9.8 and E2.13 add theirs; section 12 lists every change.

## 6. Architecture

### 6.1 One registry

`packages/cli/src/registry.ts` (new, card E8.15a) is the single description of the CLI. Each entry:

```ts
interface CommandSpec {
  name: string;                    // "read", "hook claude-code", "key create"
  summary: string;                 // the HELP line, verbatim
  group: "memory" | "policy" | "audit" | "data" | "surfaces" | "machine";  // Home's six groups, keys 1 to 6
  positionals: PositionalSpec[];   // name, label, required, picker ("item" | "read" | "scope" | "file")
  options: Record<string, OptionSpec>;  // the parseArgs config the handler already uses, plus label,
                                   // help line, default text, control ("text" | "scope" | "time" | "number" |
                                   // "choice" | "file" | "list" | "toggle"), "advanced" flag, and the card
                                   // that added it
  helpSection: string[];           // the "<name> options:" block of HELP, verbatim
  exitCodes: { code: number; when: string }[];
  writes: (values: Values, ws: Workspace) => "none" | "audit" | "state" | "retire" | "erase" | "file" | "process";
                                   // drives confirmation (9.5); a function, because a read with a store
                                   // folder adopts (and as the owner sweeps) while one without does not
  handler: (args: string[], io: Io) => Promise<number>;
  card?: string;                   // set while the command is in flight
}
```

- `run.ts` keeps its exported `run` and `HELP`, built from the registry. The test that pins `HELP` keeps passing, which proves the registry reproduces the text byte for byte before any new command is added.
- The handlers keep their own `parse(...)` calls with the same option objects, now read from the registry, so parsing and its error messages do not change.
- The TUI builds its home menu, palette, forms, help overlay and parity test from the registry. A new command, such as `engram export` from E9.8, is one registry entry; it then appears in `--help`, the palette and a generated form with no TUI code. A hand-made screen (Read, Write, Doctor and the others in section 8) is an optional richer view over the same entry.

### 6.2 One call, the same call

- A TUI action builds the argument vector the plain command would get (`["write", "--content", "...", "--scope", "person:dana", ...]`) from the form and the workspace bar. That vector is the command line shown and copied, quoted for the shell detected (POSIX quoting under bash and zsh, PowerShell quoting when `PSModulePath` is set and `SHELL` is not).
- To run it, the TUI calls the command's client call through `connect(io, flags, ...)` with the same flags, so in process and `--server` behave as the CLI does. The command modules expose each command as two parts: `prepare(values, io)` (the flag checks, the actor, the request body; throws the same `UsageError`) and `call(conn, request)` (the one client call), with `readCommand` and the rest kept as `prepare`, `call`, `print`. The split keeps what `run` does around a handler, such as card E8.13's `drainExports` in its `finally`: the TUI's runner awaits the same drain after each call. The TUI renders the typed response; its plain view renders it with the same `format.ts` functions, so the text is the CLI's.
- Commands that are not plane calls: `doctor` runs its checks through the same `doctorCommand` with an `Io` whose `out` the TUI captures (`--json`, parsed), so the checks are not duplicated. `serve` and `mcp` run their own handlers with an `Io.stop` the TUI aborts. The hook and `mcp` over stdio are never run on the TUI's own terminal; their screens build the configuration to paste, and "Try it" spawns the exact copied command as a child process with piped stdio against a scratch log (8.14, 8.15).

### 6.3 Rules it keeps

- **No policy logic** (rule 1). Everything a screen shows about a decision is a field the response carries. Grouping and labels reuse the inspector's pure functions (`buildLanes`, `laneGroups`, `filterEvents`, `eventDetail`, `explainView`, `provenanceGraph`, `itemVersions`, `itemEvents`, `grantFrom`, `grantLabel`). Decided on 2026-11-22 (section 14, item 4): card E8.15c moves `packages/ui/src/view.ts` and `provenance.ts` into a new React-free workspace package, `@engram/view` (`packages/view/`, depending only on the generated client's types), which the inspector and the TUI both import. The CLI never depends on `@engram/ui`, so React, xyflow, dagre and tanstack stay out of its dependency graph.
- **Stores through the plane** (rule 2). The TUI opens no store and no log itself; the workspace does, inside `connect`.
- **The clock.** The TUI reads time only through `Io.now`, where and when the plain command does: never for a decision, only for what the CLI prints. `--at` is offered on Read only; on other screens it appears only when "Test clock" is on, as the CLI requires `--test-clock`.
- **Ids** come from `Io.newId`, as in the CLI.
- **pi packages.** Only `@earendil-works/pi-tui`, and only under `packages/cli/src/tui/`. ADR 0044 records the exception and amends AGENTS.md's "What not to do" line (which names the packages that may reach pi); ADR 0033's accepted text is not edited. A biome rule keeps pi-tui out of every other CLI file and out of core and the adapters, naming `@earendil-works/pi-tui` as an exact path, since the existing `@earendil-works/pi-*/**` pattern may not match a bare package import.
- **Pickers read once.** A scope picker offers the actor's member scopes and, once E8.14 merges, the session's cached `engram scopes` answer (3.6); an item picker offers the items of the session's last read. Opening a picker never makes a call, so it never appends a read event.

### 6.4 Modules

```
packages/cli/src/registry.ts          the command registry (E8.15a)
packages/cli/src/tui/main.ts          engram tui: flags, the refusals of 5.2, theme, start and stop
packages/cli/src/tui/term.ts          the TuiTerminal seam: ProcessTerminal in main, FakeTerminal in tests
packages/cli/src/tui/theme.ts         palettes (default, high contrast, no colour), glyph sets (unicode, ascii)
packages/cli/src/tui/app.ts           the router, the status bar, the key map, overlays (help, palette, confirm)
packages/cli/src/tui/workspace.ts     the workspace bar state, flags in and argument vectors out
packages/cli/src/tui/saved.ts         ~/.engram/tui.json: load, save, forget (8.3)
packages/cli/src/tui/clipboard.ts     the copy path by terminal (4.1)
packages/cli/src/tui/snippets.ts      the Claude Code, Codex and MCP configuration and the Try it spawn (8.14, 8.15)
packages/cli/src/tui/argv.ts          argument vector to a shell-quoted command line
packages/cli/src/tui/forms.ts         a form generated from a CommandSpec; field validation by the CLI's checks
packages/cli/src/tui/screens/*.ts     one file per screen of section 8
packages/cli/src/tui/line.ts          line mode (node:readline only, no pi-tui)
packages/cli/test/tui/*.test.ts       the layers of section 13
```

## 7. Information architecture

```
Home ─┬─ Memory ── Read and explain ── Explain ── Item page (provenance, versions, events naming it)
      │            Write ── (check preview) ── Result
      │            Promote ── Result
      │            Grants ── Result (undo)                       needs engram grants (3.6)
      │            Who can read                                  in flight, card E2.13
      │            Supersede                                     in flight, card L6
      ├─ Policy ── Lint ── Findings
      │            Retention sweep ── Result
      │            Simulate ── Comparison ── Changed steps
      │            Policy view                                   needs engram policy (3.6)
      ├─ Audit ─── Events (timeline) ── Event detail ── Item page needs engram events (3.6)
      │            Log verify                                    in flight, card E1.6
      ├─ Data ──── Export                                        in flight, card E9.8
      │            Import ── Per-row decisions                   in flight, card E9.8
      ├─ Surfaces  Serve (HTTP API and inspector)
      │            MCP server
      │            Claude Code hook setup
      │            Keys (before Serve and MCP)                   card E8.12, merged
      └─ Machine ─ Doctor
Overlays everywhere: Workspace (ctrl+o), Help (? or ctrl+g), Palette (ctrl+p or ;), Confirm, Plain view (v), JSON view (J)
First run ends with a guided first loop: write a memory, read it back, open its explanation (8.2)
```

The home screen groups the registry by `group`. First run (8.2) replaces Home until a log, a policy and an actor are named, or a saved workspace still works (8.3). Every screen has the same frame:

```
row 1        title bar: "engram", the screen, the connection (in process or server), the actor
rows 2..n-2  the screen
row n-1      command line: the exact command this screen would run now, or the last one run, with its exit code
row n        key hints for this screen, then "? help  ; commands  esc back"
```

The command line row is what makes the TUI teach: it is always on screen and always exact. A command wider than the terminal is cut in the middle with `...` in that row only; `c` copies it whole, and the wide layout shows more of it.

## 8. Screens

Every mockup is drawn at its exact size and generated by a script that refuses a line wider than the frame. Row 1 is the title bar, row n-1 the command line (principle 4.1), row n the key hints. In the real terminal the title bar is reverse video, the selected row is reverse video with a `>` marker, and status words carry their colour (11.3); the mockups show the symbols and words only, which is also exactly what `--no-color` shows.

### 8.1 Home

The home screen lists the registry's commands in six groups (Memory, Policy, Audit, Data, Surfaces, Machine), each action with a plain-language label and its command. The right pane shows, for the selected action, what it does, what it needs from the workspace and what it changes. Keys `1` to `6` jump to a group; letters to an action (the underlined letter in the real terminal, shown here in brackets). No action letter is one of the keys that act everywhere or in lists (`j`, `k`, `c`, `q`, `v`, `J`, `L`, `/`, `;`, `?`), so a jump never collides with them, and each letter has one meaning on this screen. At 80x24 the list scrolls and says how much is below; at 120x40 everything fits. The health strip at the bottom is the last doctor run of this session, or "doctor not run this session: d".

Home (80x24):

```text
 engram  Home                                  in process  person:dana (person)
┌──────────────────────────────────┐┌──────────────────────────────────────────┐
│ 1 Memory                         ││ Read and explain                         │
│ > [r] Read and explain           ││                                          │
│   [w] Write a memory             ││ Reads through the plane as               │
│   [p] Promote an item            ││ person:dana and explains every           │
│   [g] Grants on an item          ││ item it returns: its score, the          │
│   [n] Who can read      E2.13    ││ rule that admitted it, grants            │
│   [S] Supersede         L6       ││ used, validity.                          │
│ 2 Policy                         ││                                          │
│   [l] Lint a scope               ││ Changes: adopts ~/demo/mem into          │
│   [t] Retention sweep            ││ the log; as its owner, first             │
│   [s] Simulate a policy          ││ sweeps your expired items.               │
│   [y] Policy in force            ││ Asks the first time a session.           │
│ 3 Audit                          ││                                          │
│   [e] Events                     ││ engram read [query]                      │
│   [f] Verify the log    E1.6     ││                                          │
│ 4 Data                           ││ enter open   c copy command              │
│   ▾ 7 more below: pgdn           ││                                          │
│                                  ││                                          │
└──────────────────────────────────┘└──────────────────────────────────────────┘
 ✓ doctor: all checks passed 18:17   log ~/.engram/engram.db   preset.medium v1
$ engram read --owner dana --root ~/demo/mem
 enter open  1-6 group  letter action  ? help  ; commands  q quit
```

Home, wide (120x40):

```text
 engram  Home                                                 in process  log ~/.engram/engram.db  person:dana (person)
┌─ Actions ────────────────────────────────────────────────────────────┐┌─ Selected ───────────────────────────────────┐
│ 1 Memory                                                             ││ Read and explain                             │
│ > [r] Read and explain           engram read [query]                 ││                                              │
│   [w] Write a memory             engram write                        ││ Reads through the plane as person:dana       │
│   [p] Promote an item            engram promote <itemId>             ││ and explains every item it returns: the      │
│   [g] Grants on an item          engram grants <itemId>              ││ score and its components, the rule that      │
│   [n] Who can read               engram who-can-read     E2.13       ││ admitted it, grants used, the validity       │
│   [S] Supersede                  engram supersede        L6          ││ window.                                      │
│                                                                      ││                                              │
│ 2 Policy                                                             ││ With a store folder, the store's own         │
│   [l] Lint a scope               engram lint --scope                 ││ memories are adopted into the log first;     │
│   [t] Retention sweep            engram retain --scope               ││ when you are its owner, your retention       │
│   [s] Simulate a policy          engram simulate                     ││ is swept before that, which can retire       │
│   [y] Policy in force            engram policy                       ││ expired items for good. The first read       │
│                                                                      ││ of a session asks before it runs.            │
│ 3 Audit                                                              ││                                              │
│   [e] Events                     engram events                       ││ Needs    an actor (--as or --owner)          │
│   [f] Verify the log             engram log verify       E1.6        ││ Store    files at ~/demo/mem                 │
│                                                                      ││ Exit     0 done, 1 error, 2 usage            │
│ 4 Data                                                               ││                                              │
│   [x] Export a bundle            engram export           E9.8        ││ engram read [query] --owner dana             │
│   [i] Import a bundle            engram import           E9.8        ││   --root ~/demo/mem                          │
│                                                                      ││                                              │
│ 5 Surfaces                                                           ││ Session                                      │
│   [a] Keys                       engram key              E8.12       ││   3 commands run, 1 denied                   │
│   [h] Serve the API and inspector  engram serve                      ││   last read 01a1ff53-a519-707e-...           │
│   [m] MCP server                 engram mcp                          ││                                              │
│   [b] Claude Code hook setup     engram hook claude-code             ││ enter open   c copy command                  │
│                                                                      ││                                              │
│ 6 Machine                                                            ││                                              │
│   [d] Doctor                     engram doctor                       ││                                              │
│                                                                      ││                                              │
│                                                                      ││                                              │
└──────────────────────────────────────────────────────────────────────┘└──────────────────────────────────────────────┘
 ✓ doctor: all checks passed at 18:17    log ~/.engram/engram.db (SQLite, up to date)    policy preset.medium v1
 store files ~/demo/mem    owner dana    member of person:dana    workspace saved    decision export off

$ engram read --owner dana --root ~/demo/mem
 enter open  1-6 group  letter action  /  filter ? help  ; commands  ctrl+o workspace  esc back  q quit
```

Procedures (Distill) has no entry: its route answers 501 naming the backlog, and no command exists or is planned (3.6). The palette lists it as "not yet available (backlog)" with no action.

### 8.2 First run

The TUI opens on onboarding instead of Home when the workspace is not usable yet and no saved workspace still works (8.3). It decides that with three cheap checks, the functions doctor itself uses, and never the full doctor (which probes Mem0 and Letta and took 3.5 s on this machine): the log (`checkLog`: absent, usable or refused), the policy (`loadPolicy`) and an actor (`--as` or `--owner`). Doctor runs only when the person asks (`d`). Each step is one question with the default the CLI would use, and each shows the flags it amounts to. Nothing is written by onboarding itself: the log is created by the first read or write, as the CLI does, and onboarding says so. On finishing, the answers are saved (8.3) and the guided first loop starts.

First run, no log yet (80x24):

```text
 engram  Getting started  1 of 3
 Welcome. Three answers and you are ready.

 1  Where should the event log live?

    ( ) the default for this user   ~/.engram/engram.db
    (o) a file I name   [ ~/demo/engram.db                        ]
    ( ) in memory only, nothing kept   :memory:
    ( ) a Postgres server   postgres://...

    ✓ ok  log: no log yet; the first read or write creates it

 2  Who are you?                 [ dana          ]  acts as person:dana
 3  Which memory folder?         [ ~/demo/mem    ]  optional; skip for now

 Nothing is written until your first read or write. Every answer is a flag:
 you can type the same thing at the shell next time.





$ --db ~/demo/engram.db --owner dana --root ~/demo/mem  (every command)
 tab next  shift+tab back  enter accept  s skip  L line mode  ? help  q quit
```

First run, the policy fails to load (80x24):

```text
 engram  Getting started  policy
 The policy did not load.

   ✗ fail  policy  --policy nosuch.yaml is neither a preset (strict, medium,
                   permissive) nor a readable file

 Choose a policy:

   (o) medium       the default preset
   ( ) strict       a bundled preset
   ( ) permissive   a bundled preset
   ( ) a file       [ ./policy.yaml                         ]  browse: tab

 Press d to run every doctor check.








$ --policy nosuch.yaml   (refused: choose another)
 enter accept  d doctor  esc back  ? help  q quit
```

First run, after doctor failed (80x24):

```text
 engram  Getting started  doctor
 You ran doctor and a check failed. You can still continue; the screens
 it affects say so.

   ✓ ok    log             sqlite ~/demo/engram.db: opens; up to date
   ✓ ok    policy          preset.medium v1 loads and validates
   ✓ ok    store           ~/demo/mem is a readable folder
   ✗ fail  adapter letta   git was not found on the PATH

 What this means
   The Letta store (--store letta) needs git. The files store works.

 What to do
   Install git, or keep --store files. Press r to run doctor again.

 [ Continue with files ]   [ Run doctor again ]   [ Open Doctor ]






$ engram doctor --db ~/demo/engram.db --root ~/demo/mem   exit 1
 enter choose  r rerun  d doctor  ? help  q quit
```

The "adapter letta" failure text is the shape doctor prints when `gitVersion()` throws; the exact message comes from the check at run time. The "What this means" and "What to do" text is a fixed table keyed by check name (8.12), never parsed from the detail.

The guided first loop ends onboarding: three steps, each a real command shown before it runs, each one press of enter. Every step can be skipped (`s`), and `esc` leaves for Home.

First run, the guided first loop (80x24):

```text
 engram  Getting started  first loop
 Your first loop: write a memory, read it back, see why it came back.

 ✓ 1  Write    engram write --content "The deploy key rotates every 90
               days." --owner dana --root ~/demo/mem
               allow: semantic item from source user passes the person
               write rule  (preset.medium/write/person)

 > 2  Read     engram read deploy --owner dana --root ~/demo/mem
               Reading adopts ~/demo/mem into the log and, as its owner,
               sweeps your expired items first. Press enter to read.

   3  Explain  engram explain <the read's id> --owner dana

 Each step is the plain command; c copies it. Next time, type it yourself.







$ engram read deploy --owner dana --root ~/demo/mem
 enter run this step  s skip  c copy  esc Home  ? help
```

### 8.3 Workspace

`ctrl+o` opens the workspace panel from anywhere. It holds every flag that names where and as whom a command runs: the connection, the log, the policy, the store and the actor (the inspector's viewer picker, with the same validation: "the viewer needs an id, such as person:dana"). Each field shows its value and where it came from: flag, environment, saved or default. Changing the connection to a server greys out the log, policy and store fields with the CLI's own reason, since a server has its own workspace. Applying shows the flags it now adds to every command.

The saved workspace. On applying, and at the end of first run, the TUI writes `~/.engram/tui.json` (beside the default log, in the user's home, never in a project). It holds the workspace flags only: `server`, `db`, `policy`, `store`, `root`, `owner`, `import-valid-from`, `as`, `level`, `member`, and in flight `otlp`, `export-jsonl` and `keys` (a key file's path, never a key), plus the TUI's own options (`ascii`, `contrast`, `motion`, `mouse`, `line`). It never holds memory content, ids, reads, tokens, keys, passwords or a Postgres URL's userinfo (a `postgres://` URL is saved redacted as doctor prints it, so the person re-enters the secret, or uses `ENGRAM_DB_URL`). On the next start the saved flags are applied under any given on the command line, the cheap checks of 8.2 run, and when they pass the TUI opens on Home with "workspace saved" in the status strip; when they fail it opens on the first-run step that failed, with the saved answers filled in. "Forget saved workspace" in this panel deletes the file after a confirmation, and `engram tui --no-saved` ignores it for one session. The file is written with the user's permissions only (0600 where the system has them).

Workspace (80x24):

```text
 engram  Workspace                             in process  person:dana (person)
┌─ Where and as whom ──────────────────────────────────────────────────────────┐
│ Connection   (o) in process   ( ) server [ http://127.0.0.1:7313    ]        │
│                                                                              │
│ Event log    [ ~/demo/engram.db                       ]  saved               │
│ Policy       [ medium      v]  preset.medium v1 loads and validates          │
│ Store kind   (o) files   ( ) letta                                           │
│ Store folder [ ~/demo/mem                             ]  saved, readable     │
│ Owner        [ dana          ]  saved                                        │
│                                                                              │
│ Acting as    [ person:dana   ]  Level [ person v]  (its own)                 │
│ Member of    person:dana  [+ add scope]                                      │
│                                                                              │
│ Advanced     imported valid from [ each file's mtime  ]                      │
│              decision export off            E8.13                            │
│              test clock off (tests and fixtures only)                        │
│                                                                              │
│ Saved in ~/.engram/tui.json: flags only.   [ Forget saved workspace ]        │
│                                                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

$ --db ~/demo/engram.db --owner dana --root ~/demo/mem  (every command)
 tab next  enter apply and save  esc cancel  ? help
```

Workspace, with a server (80x24):

```text
 engram  Workspace                           server 127.0.0.1:7313  person:dana
┌─ Where and as whom ──────────────────────────────────────────────────────────┐
│ Connection   ( ) in process   (o) server [ http://127.0.0.1:7313    ]        │
│              ✓ the server answers (GET /api/v1/health)                       │
│                                                                              │
│ Event log    the server's own       --db, --root, --store, --policy and      │
│ Policy       the server's own       --import-valid-from name the workspace,  │
│ Store        the server's own       which the server at                      │
│                                     http://127.0.0.1:7313 has its own of;    │
│                                     give them to engram serve                │
│                                                                              │
│ Acting as    [ person:dana   ]  Level [ person v]                            │
│ Member of    person:dana  [+ add scope]                                      │
│ Token        not set (ENGRAM_TOKEN)                E8.12                     │
│                                                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘





$ --server http://127.0.0.1:7313 --as person:dana
 tab next  enter apply and save  esc cancel  ? help
```

The greyed text is the CLI's usage error from `connect.ts`, word for word.

### 8.4 Below 80x24

Below 80 columns or 24 rows the TUI draws no layout. It shows what it needs and keeps the session: resizing back restores the screen exactly, with the form's input intact. Below 40x5 it shows only the first line.

Too small (60x20):

```text
engram tui needs 80x24;
this terminal is 60x20.

Widen the window, or press
q and run the plain command:

  engram read --owner dana

Nothing is lost while you
resize.










```

### 8.5 Read and explain

The form has the query, the validity time (`--at`, the only screen where it is offered without the test clock, labelled "Judge validity windows at") and the workspace's actor. The results reuse the inspector's scope lanes: items grouped as Person scope, Role scopes, Team and org, and Through a grant (`laneGroups`), each item with its rank, class, provenance and the first line of its content. The bottom pane is the explain detail of the selected item, the same lines `format.ts` prints. The sync report (store, retention, adoption) is the collapsible header; it appears only for the store's owner, as the route returns it.

What a read does, before it does it. With a store folder, `POST /read` first adopts the folder's memories into the log, and when the actor is the store's owner it sweeps the owner's retention before that (`routes.ts`, `syncStore`), which can retire expired items for good, as `engram retain` would. So the first read with a store folder in a session asks, with the dialog below, and every later read in the session repeats its first line in the command row. The plane has no read-only preview of a sweep, so the dialog cannot say how many items would be retired; it says that any expired item will be. A read-only sweep preview is a backlog item for the plane (section 14). A read without a store folder, or by an actor who is not the store's owner, does not sweep, and the dialog says only what it does. `engram read --item <id>` (card E8.14) is treated the same way, since its route runs the same sweep and adoption.

Read, the first read of a session with a store folder (80x24):

```text
 engram  Read and explain                      in process  person:dana (person)
 Query [ release                     ]  Judge validity at [ now            ]


     ┌─ Read with ~/demo/mem? ────────────────────────────────────────────┐
     │ This read also changes the log, as engram read always does:        │
     │                                                                    │
     │   1. sweeps person:dana's retention as its owner: any item past    │
     │      its ttl is retired for good, items over budget evicted        │
     │   2. adopts the memories in ~/demo/mem into the log as             │
     │      person:dana; the files are not changed                        │
     │   3. reads through the plane and explains every item returned      │
     │                                                                    │
     │ $ engram read release --owner dana --root ~/demo/mem               │
     │                                                                    │
     │ Asked once a session.   [ Cancel ]    [ Read ]                     │
     └────────────────────────────────────────────────────────────────────┘





$ engram read release --owner dana --root ~/demo/mem
 enter read  ? help  esc back
```

Read, results (80x24):

```text
 engram  Read and explain                      in process  person:dana (person)
 Query [ release                     ]  Judge validity at [ now            ]
 read 01a1ff1a-e6e7-709b-96d7-4bb8217ccde4  ✓ allow   1 returned, 0 filtered
 ▸ store files ~/demo/mem: 4 imported, 4 allowed, 0 denied; 0 expired
┌─ Lanes ──────────────────────────────────────────────────────────────────────┐
│ Person scope  person:dana  member                                            │
│ > 1  semantic  import  The Lantern release freezes merges to main fr...      │
│                                                                              │
│ Role scopes   none held                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ Explain ────────────────────────────────────────────────────────────────────┐
│ 00000000-0000-7fec-aeaa-eb2bfa22eb9b  semantic  person:dana                  │
│ score 1.8671 = relevance 1.0000 + confidence 0.5000 + recency 0.3671         │
│ admitted by preset.medium/read/person                                        │
│ valid 2026-10-01T00:00:00Z to open, at 2026-11-21T17:15:15.530Z              │
│ source import claude-code-memory/project/project_release_freeze.md           │
└──────────────────────────────────────────────────────────────────────────────┘





$ engram read release --owner dana --root ~/demo/mem   exit 0
 enter item page  e explain  p promote  w who  v plain  J json  c copy  ? help
```

Read, wide (120x40):

```text
 engram  Read and explain                                     in process  log ~/.engram/engram.db  person:dana (person)
 Query [                                        ]   Judge validity windows at [ now (the server's clock) ]

 read 01a1ff53-a519-707e-9acd-082420886164 at 2026-11-21T18:17:14.251Z as person:dana (person) under preset.medium v1
 ▾ store files at ~/demo/mem
   retention: 0 expired, 0 evicted
   imported 0 of 5 memories: 0 allowed, 0 denied, 5 already in the log
 ✓ allow  5 items returned, 0 filtered
   returned 5 of 5 candidates; 0 filtered (0 outside the validity window, 0 not active, 0 past their ttl,
   0 by a grant's class or expiry); 0 projected items outside the reader's reach were not candidates
┌─ Lanes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Person scope   The viewer's own memory: no one else reads it without a grant.                                        │
│   person:dana  member                                                                                                │
│   > 1  semantic  user    The deploy key rotates every 90 days.                                                       │
│     2  semantic  import  The on-call runbook for Lantern is the "Lantern incidents" page in the ops wiki. Ch...      │
│     3  semantic  import  Dana is a backend engineer on the Lantern project. She writes Go services against Pos...    │
│     4  semantic  import  Keep code review comments short and make one point per comment.                             │
│     5  semantic  import  The Lantern release freezes merges to main from Thursday noon until the release is ta...    │
│                                                                                                                      │
│ Role scopes    The work memory of each role the viewer holds, handed to a successor at offboarding.                  │
│   none held                                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌─ Explain  item 1 of 5 ───────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. 01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c  semantic  person:dana                                                       │
│    score 1.8986 = confidence 0.9000 + recency 0.9986                                                                 │
│    admitted by preset.medium/read/person                                                                             │
│    valid 2026-11-21T17:15:16.620Z to open, at 2026-11-21T18:17:14.251Z                                               │
│    source user engram-cli                                                                                            │
│    > The deploy key rotates every 90 days.                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

 log ~/.engram/engram.db; engram explain 01a1ff53-a519-707e-9acd-082420886164






$ engram read --owner dana --root ~/demo/mem   exit 0
 enter item page  e explain  p promote  g grants  w who can read  S supersede  v plain  J json  c copy  ? help  esc back
```

Plain view (`v`) replaces the panes with the command's text output, byte for byte as `engram read` prints it, scrollable; `J` shows the `--json` body. Both are the CLI's own formatters, so the TUI and the shell never disagree.

### 8.6 Explain

Reached with `e` on a read, or from Home with a read id (a picker lists this session's reads and the read events the Events screen shows). It is the inspector's explain view: the counts line ("Returned 1 of 1 candidates; 0 filtered"), the filtered categories with the inspector's labels, the out-of-reach line, then one row per explanation. Asking about another actor's read shows the inspector's line and the CLI's error, without calling explain again.

Explain (80x24):

```text
 engram  Explain                               in process  person:dana (person)
 read 01a1ff1a-e6e7-709b-96d7-4bb8217ccde4: 1 explanation

 Returned 1 of 1 candidates; 0 filtered.
   0 outside the validity window    0 not active
   0 past their ttl                 0 by a grant's class or expiry
 0 projected items outside the reader's reach were not candidates.

 rank  item                                  score   admitted by
 > 1   00000000-0000-7fec-aeaa-eb2bfa22eb9b  1.8671  preset.medium/read/person

 1. 00000000-0000-7fec-aeaa-eb2bfa22eb9b
    score 1.8671 = relevance 1.0000 + confidence 0.5000 + recency 0.3671
    admitted by preset.medium/read/person
    valid 2026-10-01T00:00:00Z to open, at 2026-11-21T17:15:15.530Z

 An item's text is what the lanes show now, not its text when the read was made.





$ engram explain 01a1ff1a-e6e7-709b-96d7-4bb8217ccde4 --owner dana   exit 0
 enter item page  v plain  J json  c copy  ? help  esc back
```

Explain, another reader's read (80x24):

```text
 engram  Explain                                in process  person:sam (person)
 ✗ refused   only its reader may explain a read

   engram explain: explain: read 01a1ff1a-e6e7-709b-96d7-4bb8217ccde4 was
   made by another actor; only its reader may explain it

 This read was made by person:dana. You are acting as person:sam.
 Change who you act as with ctrl+o, or pick one of your own reads.














$ engram explain 01a1ff1a-e6e7-709b-96d7-4bb8217ccde4 --as person:sam   exit 1
 ctrl+o workspace  r my reads  ? help  esc back
```

### 8.7 Write

The form has every write flag. Content is a multi-line editor; Scope, Class, Confidence, Valid from and Valid to are fields with the CLI's defaults written in as placeholders ("default person:dana", "default 0.9", "default now", "default open"). "From file" loads an item JSON, and the fields it sets show "from file" until edited, as the CLI lets the flags fill what the file leaves out. Advanced holds Id.

While the form is edited, the "The gate would" line is a live `engram check` (section 3.6): the decision, reason and policy id a write would get now, with nothing stored and no event. It runs after 400 ms without a keystroke, never on every key. It is labelled a preview, because the decision at write time is made again at the server's clock. `engram check` was decided on 2026-11-22 (section 14, item 3).

`ctrl+s` (or enter on Submit) opens the confirmation (9.5), which shows the command and the preview. The result is the CLI's three or four lines, with the decision as a status word.

When the preview denies or asks, the screen shows the server's reason and policy id verbatim and offers only neutral shortcuts: "change Class" and "change Scope" move the cursor to that field, and the preview runs again on the next pause, so the plane gives the next answer. The TUI never suggests a value, never reads the reason or the rule id to decide what to offer, and contains no policy id or preset name (a test holds it to that, section 13). Submitting a write the preview denies is labelled "Record this write (the gate will deny it)": the write is still sent, and the gate records its denial as an event, which is why it is offered at all.

Write, the form (80x24):

```text
 engram  Write a memory                        in process  person:dana (person)
 Content      ┌──────────────────────────────────────────────────────────┐
              │ The deploy key rotates every 90 days.                    │
              │                                                          │
              └──────────────────────────────────────────────────────────┘
 From file    [                               ]  browse: tab
 Scope        [ default person:dana           ]  person:<id>, role:<id>...
 Class        (o) semantic  ( ) episodic
 Confidence   [ default 0.9  ]  0 to 1
 Valid from   [ default now                   ]  ISO 8601 UTC
 Valid to     [ default open                  ]
 ▸ Advanced   id

 The gate would  ✓ allow  semantic item from source user passes the
                 person write rule  (preset.medium/write/person)  preview

                                         [ Write ]   [ Check again ]





$ engram write --content "The deploy key rotates every 90 days." --owner dana
 ctrl+s write  tab next field  ctrl+x ctrl+e editor  c copy  ? help  esc back
```

Write, wide, the preview denies (120x40):

```text
 engram  Write a memory                                       in process  log ~/.engram/engram.db  person:dana (person)
 Content      ┌──────────────────────────────────────────────────────────────┐   As person:dana (person), source user
              │ x                                                            │   The plane records the write as source
              │                                                              │   user by the actor, whatever it claims.
              │                                                              │
              └──────────────────────────────────────────────────────────────┘   Store files at ~/demo/mem
 From file    [                                   ]  browse: tab                   Log ~/.engram/engram.db
 Scope        [ team:platform                     ]  person:<id>, role:<id>, team:<id> or org
 Class        ( ) semantic  (o) episodic
 Confidence   [ default 0.9  ]  a number from 0 to 1
 Valid from   [ default now                       ]  an ISO 8601 UTC time such as 2026-10-25T12:00:00Z
 Valid to     [ default open                      ]
 ▾ Advanced
   Id         [ default a new UUIDv7              ]

 Member of    person:dana, team:platform   (from the workspace)

 The gate would  ✗ deny  episodic items are forbidden in team scope; provenance set by the plane: source user,
                 actor person:dana  (preset.medium/write/team)  preview, nothing stored

 [ change Class ]  [ change Scope ]  [ open the rule in Policy ]     the preview runs again after a change

                                                [ Record this write (the gate will deny it) ]   [ Check again ]















$ engram write --content x --scope team:platform --class episodic --member team:platform --owner dana --root ~/demo/mem
 ctrl+s write  tab next field  ctrl+x ctrl+e editor  c copy  J check json  ? help  esc back
```

"open the rule in Policy" opens the Policy screen at the policy id the check returned, as a link would; it reads nothing into the id.

Write, a denied write (80x24):

```text
 engram  Write a memory  result                in process  person:dana (person)
 ✗ deny   exit 1

 write 01a1ff1a-ef5a-7d7b-9339-29d483e91b1b at 2026-11-21T17:15:17.719Z by
   person:dana
 deny: episodic items are forbidden in team scope; provenance set by the
   plane: source user, actor person:dana
 policy preset.medium/write/team
 log ~/demo/engram.db

 Nothing was stored. The decision is event 6 in the log.

 [ Edit and retry ]   [ Open the event ]   [ New write ]









$ engram write --content x --scope team:platform --class episodic ...  exit 1
 enter choose  v plain  J json  c copy  ? help  esc back
```

Lines the CLI prints wider than the pane wrap with a two-space hanging indent; plain view (`v`) shows them unwrapped and scrolls sideways.

### 8.8 Promote

Item comes from the selected item (`p` on Read, Events or the item page) or a picker of items the last read returned; it can be typed, and is checked as the CLI checks it ("nope is not an item id (a UUIDv7)"). To scope is a scope field with suggestions from the actor's memberships and `org`. "Approve as reviewer" is `--review`; turning it on shows the CLI's limit text verbatim. The result shows the decision and every further event the promotion recorded, as the CLI prints them, and no advice of its own. The reviewer handoff is always offered after a promotion that did not land, whatever the reason: "Switch to a reviewer and approve" asks for the reviewer's principal, sets Acting as to it and Member of to the target scope for this session only (both shown before they apply; the switch is never written to the saved workspace), and reopens Promote with As reviewer on. The title bar then marks the reviewer "for this session", and "Switch back" in the workspace panel (ctrl+o) restores the previous actor and memberships. Whether that reviewer may approve is the plane's answer, as for any promotion. Against a server with credentials (card E8.12) the handoff is not offered: the identity comes from the key or token, not from Acting as, so the reviewer approves in their own session with their own credential, and the screen says so.

Promote (80x24):

```text
 engram  Promote an item                       in process  person:dana (person)
 Item          [ 01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c ]  semantic person:dana
               The deploy key rotates every 90 days.
 To scope      [ team:platform               ]  the item's own or wider
 As reviewer   [ ] approve as a member of the target who does not own it

┌─ Result ─────────────────────────────────────────────────────────────────────┐
│ ✗ deny   exit 1                                                              │
│ promote 01a1ff1b-1d02-78ca-8d42-9af2cfaea621 at 2026-11-21T17:15:29.408Z by  │
│   person:dana                                                                │
│ deny: not promoted: widening person:dana to team:platform needs a            │
│   reviewer's approval                                                        │
│ policy engram/promote/no-evidence                                            │
│                                                                              │
│ [ Switch to a reviewer and approve ]   [ Edit and retry ]                    │
│ Promotions cannot be undone from here.                                       │
└──────────────────────────────────────────────────────────────────────────────┘





$ engram promote 01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c --to team:platform ...
 ctrl+s promote  tab next  v plain  J json  c copy  ? help  esc back
```

### 8.9 Retention sweep

One field, Scope, with the actor's member scopes offered. The confirmation is the strong dialog of 9.5, because a sweep retires expired items for good and evicts over-budget ones: the action button is not focused, and it says "Retiring cannot be undone. Retired items stay in the log; reads no longer return them." There is no preview route for a sweep, and the screen does not pretend there is.

Retention sweep (80x24):

```text
 engram  Retention sweep                       in process  person:dana (person)
 Scope   [ person:dana        ]   you are a member

 ✓ allow   exit 0

 retain person:dana at 2026-11-21T17:15:31.535Z as person:dana: allow,
   0 expired, 0 evicted
 log ~/demo/engram.db

 Nothing was due. Expired items are retired and items over the scope's
 budget are evicted, in the order the policy's retention rule names.











$ engram retain --scope person:dana --owner dana   exit 0
 ctrl+s sweep  v plain  J json  c copy  ? help  esc back
```

### 8.10 Lint

Scope, then the findings as a list: severity as a symbol and word, the lint id, the item, and the reason, with the evidence lines folded under it. `enter` opens the item page of the finding's item. The header names the lints the policy enables (from `engram policy`), so an empty result says which lints ran. Lints in flight (`near-duplicate-tier`, card L5; `contradiction-nli`, card L7) appear like any other when the policy enables them; a policy load error from them shows in the error state (10.3) with the CLI's message.

Lint, one finding (80x24):

```text
 engram  Lint a scope                          in process  person:dana (person)
 Scope  [ team:core         ]   lints enabled by the policy: duplicate, ...

 lint team:core at 2026-11-06T12:00:00Z as person:dana: allow, 1 finding

 ▲ warn  duplicate   01950000-0000-7000-8000-000000000002
   it restates 01950000-0000-7000-8000-000000000001, an earlier active
   semantic item in team:core
   ▸ evidence  duplicate of 01950000-0000-7000-8000-000000000001; strict
     content hash sha256:210227b734cd7daccab35f377fb17325b8ce6c9facc98...
   rule fixture.faults/lint/duplicate

 exit 1: a finding. Each finding is a lint event in the log.









$ engram lint --scope team:core --as person:dana --member team:core ...
 enter item page  ctrl+s lint again  v plain  J json  c copy  ? help  esc back
```

This sample is the `duplicate.flag` fault fixture (`make fault-workspace FAULT=duplicate.flag`), linted with the fixture's own `--at` and `--test-clock`, so the screen shows Test clock on in its title bar in the real run.

### 8.11 Simulate

Workload (a file picker filtered to `.json`), Policy (the baseline, from the workspace) and Candidate (preset or file). The comparison is the CLI's table, with a bar beside each pair of numbers so a difference is seen at a glance; the bar is drawn in glyphs, never colour alone. Changed steps are a list; `enter` on one shows both outcomes and the candidate's rule and reason. Simulate never touches the real log or store, and the screen says so; it asks no confirmation.

Simulate (80x24):

```text
 engram  Simulate a policy                     in process  person:dana (person)
 workload e8-9-two-presets: 10 steps, 0 model calls
 baseline preset.medium v1, candidate preset.strict v1

                           baseline  candidate
 allow                           10          7  ██████████ ███████
 deny                             0          3             ███
 items returned                   5          1  █████      █
 mean returned per read        1.67       0.33
 expired by ttl                   0          1             █
 active items at the end          5          1  █████      █

 6 steps differ
 > step 1 write person:dana 01950000-...0002: allow -> deny
     confidence 0.75 is below the team floor 0.8; provenance set by the
     plane: source user, actor person:dana (preset.strict/write/team)
   step 2 write person:dana 01950000-...0003: allow -> deny
   step 4 write person:dana 01950000-...0005: allow -> deny
 Replayed on scratch logs and stores: your log and store are not touched.



$ engram simulate --workload e8-9-two-presets.json --candidate strict   exit 0
 enter step  a all rows  v plain  J json  c copy  ? help  esc back
```

At 80 columns the table shows the rows that differ first and `a` shows all eleven; the selected step's reason is shown whole, wrapped, under that step, and `enter` lists the rest; the wide layout shows them all. Ids in list columns are cut in the middle; the step's detail and every copied command carry them whole.

Simulate, wide (120x40):

```text
 engram  Simulate a policy                                                             in process  person:dana (person)
 Workload [ fixtures/workloads/e8-9-two-presets.json ]  Policy [ medium v]  Candidate [ strict v]

┌─ Comparison ───────────────────────────────────────────────────────┐┌─ Step ─────────────────────────────────────────┐
│ workload e8-9-two-presets: 10 steps, 0 model calls                 ││ step 1  write  person:dana                     │
│ baseline preset.medium v1, candidate preset.strict v1              ││ item 01950000-0000-7000-8000-000000000002      │
│                                                                    ││                                                │
│                           baseline  candidate                      ││ baseline   ✓ allow                             │
│ allow                           10          7   differs            ││ candidate  ✗ deny                              │
│ deny                             0          3   differs            ││                                                │
│ ask                              0          0                      ││ confidence 0.75 is below the team floor        │
│ reads                            3          3                      ││ 0.8; provenance set by the plane: source       │
│ items returned                   5          1   differs            ││ user, actor person:dana                        │
│ reads with recall                2          1   differs            ││ (preset.strict/write/team)                     │
│ mean returned per read        1.67       0.33   differs            ││                                                │
│ evicted over budget              0          0                      ││                                                │
│ expired by ttl                   0          1   differs            ││                                                │
│ manual eviction asks             0          0                      ││                                                │
│ active items at the end          5          1   differs            ││                                                │
│                                                                    ││                                                │
└────────────────────────────────────────────────────────────────────┘└────────────────────────────────────────────────┘
┌─ 6 steps differ ─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ > step 1 write person:dana 01950000-0000-7000-8000-000000000002: allow -> deny                                       │
│   step 2 write person:dana 01950000-0000-7000-8000-000000000003: allow -> deny                                       │
│   step 4 write person:dana 01950000-0000-7000-8000-000000000005: allow -> deny                                       │
│   step 6 read person:sam: returned 2 -> returned 0                                                                   │
│   step 8 retain person:dana: allow -> allow, expired 01950000-0000-7000-8000-000000000004                            │
│   step 9 read person:dana: returned 3 -> returned 1                                                                  │
│                                                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 Replayed on scratch logs and stores; your log and store are never read or written, and no model is called.







$ engram simulate --workload fixtures/workloads/e8-9-two-presets.json --policy medium --candidate strict   exit 0
 enter step  up/down steps  v plain  J json  c copy  ? help  esc back
```

### 8.12 Doctor

Doctor's checks as a list, each with its status as symbol and word, its name and its detail, exactly the CLI's text. A failing check is sorted first in the TUI (the plain output keeps its order), with "What this means" and "What to do" text taken from a fixed table keyed by check name (log, policy, store, adapter files, adapter mem0, adapter letta, provider keys, benchmark pins, pi pin, node; in flight the serve-flags check of card E8.12), never from parsing the detail. `r` reruns it. Doctor's own flags (`--db`, `--policy`, `--root`) are the workspace's. Card E8.12 adds `--host` and serve's credential flags to doctor, which check the bind `engram serve` would make; the Doctor form takes them from the Serve screen's answers, so doctor checks what Serve would start.

Doctor (80x24):

```text
 engram  Doctor                                in process  person:dana (person)
 ✗ fail  policy          --policy nosuch.yaml is neither a preset (strict,
                         medium, permissive) nor a readable file
 ✓ ok    log             sqlite ~/demo/nothere.db: no log yet; the first
                         read or write creates it
 · skip  store           no --root given
 · skip  adapter files   no --root given
 ✓ ok    adapter mem0    in-memory Mem0 with the hashing embedder: a write
                         and a read round-trip through the plane, offline
 ✓ ok    adapter letta   git version 2.53.0.windows.1; a MemFS repository...
 ✓ ok    provider keys   none of 38 key variables for 40 providers is set...
 ✓ ok    benchmark pins  packages/bench/PINS.md: 6 benchmarks, 6 pinned...
 ✓ ok    pi pin          pi-ai 1.3.0, pi-coding-agent 1.3.0: package.json...
 ✓ ok    node            Node 24.14.0

 doctor: 1 check failed      exit 1

 What to do: choose a preset or a readable policy file in the workspace.




$ engram doctor --db ~/demo/nothere.db --policy nosuch.yaml   exit 1
 r rerun  enter details  ctrl+o workspace  v plain  J json  c copy  ? help
```

Doctor, wide (120x40):

```text
 engram  Doctor                                                  in process  log ~/demo/engram.db  person:dana (person)

┌─ Checks ─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ status  check           detail                                                                                       │
│ ✓ ok    log             sqlite ~/demo/engram.db: opens; up to date                                                   │
│ ✓ ok    policy          preset.medium v1 loads and validates                                                         │
│ ✓ ok    store           ~/demo/mem is a readable folder                                                              │
│ ✓ ok    adapter files   ~/demo/mem: 4 memories listed through the plane, 4 admitted, 0 denied (medium preset, in-    │
│                         memory log)                                                                                  │
│ ✓ ok    adapter mem0    in-memory Mem0 with the hashing embedder: a write and a read round-trip through the plane,   │
│                         offline                                                                                      │
│ ✓ ok    adapter letta   git version 2.53.0.windows.1; a MemFS repository in a temporary folder: a write and a read   │
│                         round-trip through the plane, one commit, and a delete, offline                              │
│ ✓ ok    provider keys   none of 38 key variables for 40 providers is set; live model calls need one, scripted and    │
│                         cassette runs do not; not checked: amazon-bedrock, google-vertex (ADC), openai-codex         │
│                         (credentials that are not a key variable)                                                    │
│ ✓ ok    benchmark pins  packages/bench/PINS.md: 6 benchmarks, 6 pinned; fixtures match their manifests: gatemem 24   │
│                         lines at a983828, longmemeval 881 lines at 9e0b455, mem-inv-bench 1355 lines at cf3c9a4      │
│ ✓ ok    pi pin          pi-ai 1.3.0, pi-coding-agent 1.3.0: package.json pins and installed copies match             │
│                         docs/deps.md                                                                                 │
│ ✓ ok    node            Node 24.14.0                                                                                 │
│                                                                                                                      │
│ doctor: all checks passed      exit 0      ran 18:17:02, 4.1 s                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ What doctor checks                                                                                                   │
│                                                                                                                      │
│ It never creates, migrates or changes a log, never prints a provider key's value (only whether it is set), and       │
│ reaches no network beyond a Postgres server the log names. The adapter checks run through a plane on an              │
│ in-memory log, so nothing is recorded.                                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘






$ engram doctor --db ~/demo/engram.db --root ~/demo/mem   exit 0
 r rerun  enter details  ctrl+o workspace  v plain  J json  c copy  ? help  esc back
```

While doctor runs, each check's row shows "running" with the static busy marker of 11.5 and fills in as it finishes, so a slow Letta check (git on Windows) never leaves the screen blank.

### 8.13 Serve

Designed for card E8.12, merged on 2026-11-22: `engram serve` refuses to start without a credential or the explicit waiver, so the screen starts with "Who may call this server?" and three answers. The default is API keys from a key file, with "Create a key" one press away (it opens Keys, 8.23, with the file filled in, and comes back). The second is a token issuer (`--issuer`, `--jwks`, `--subjects`, with `--audience` and `--resource` under Advanced). The third is labelled in words, not as a default: "No authentication: this machine only, anyone on it can act as anyone" (`--insecure-loopback`). Host, Port and the inspector's viewer follow. Start runs `serveCommand` in the TUI's process with an `Io.stop` the screen controls; the screen shows the server's start line, which names how it authenticates, the inspector's URL as an OSC 8 link, and a live request count from the client transport. A refusal from the server (`bindRefusal`) is shown verbatim with the field it names focused. `s` stops it and shows the stop line. Quitting the TUI stops a running server first and says so.

Serve (80x24):

```text
 engram  Serve the API and inspector           in process  person:dana (person)
 Who may call this server?
   (o) API keys     [ ~/.engram/keys.json         ]  2 keys  [ Create a key ]
   ( ) a token issuer  --issuer, --jwks, --subjects   ▸ Advanced
   ( ) No authentication: this machine only, anyone on it can act as anyone
       (--insecure-loopback)
 Host    (o) 127.0.0.1   ( ) ::1   ( ) localhost
 Port    [ 7313  ]   Viewer [ person:dana    ]  shown by the inspector

 ● running
 engram serve: listening on http://127.0.0.1:7313 (log sqlite ~/demo/engram.db,
   preset.medium v1, store files at ~/demo/mem, viewer person:dana,
   authenticated, resource http://127.0.0.1:7313)

 Inspector  http://127.0.0.1:7313/        open: o
 It stops when you press s or quit the TUI.






$ engram serve --keys ~/.engram/keys.json --as person:dana --root ~/demo/mem
 s stop  o open inspector  k keys  c copy  ? help  esc back (keeps it running)
```

The start line is the shape `serve.ts` prints since card E8.12 merged: it ends with "authenticated, resource <url>", or "insecure loopback: actors are self-asserted" under the waiver; `sqlite ~/demo/engram.db` stands for whatever `workspace.target.label` prints.

### 8.14 MCP server

The MCP server is normally launched by the harness, not by a person, so this screen is setup: it builds the `engram mcp` command for the actor and memberships chosen, shows the configuration for Claude Code's `.mcp.json` and Codex's `config.toml` in exactly the shape of the repository's tested fixtures (`fixtures/harness/claude-code/.mcp.json`, `fixtures/harness/codex/config.toml`: `command` and an `args` list), and copies each with `c`. "Offer memory_supersede" is `--supersede` (card L6). The HTTP transport takes the same three authentication answers as Serve (card E8.12).

The command in the snippet must run where the harness runs it. `engram` is a private workspace binary, not on the PATH unless the person installed it, and a hook or server command that cannot start fails open for the hook (8.15) and silently for MCP. So the TUI looks `engram` up on the PATH (with `PATHEXT` on Windows) and uses it only when it resolves to this same CLI and, on Windows, to an `.exe`: both Claude Code's command-and-args form and Node's `spawn` without a shell start a real executable only, so an `engram.cmd` or `engram.ps1` shim (what `npm` and `pnpm` install) would not start and the hook would fail open. Otherwise it writes the absolute command it is itself running (`process.execPath`, `node.exe` on Windows, then the absolute path of `packages/cli/src/main.ts` as the first argument) and says why above the snippet: "engram is not on your PATH", or "engram on your PATH is a .cmd shim, which this form cannot start on Windows".

"Try it" spawns exactly the command and arguments of the snippet, as a child process with piped stdin and stdout (never the TUI's own terminal), speaks the MCP handshake to it as layer 6 does, lists its tools, and stops it. It runs on a scratch log and reaches no server: the child's environment sets `ENGRAM_DB_URL=:memory:` and has `ENGRAM_SERVER_URL` removed, a `--db` in the snippet is replaced by `:memory:`, and a `--server <url>` in the snippet is replaced by `--db :memory:`; the screen lists each replacement ("Try it ran with --db :memory: in place of --server http://127.0.0.1:7313"), so the person knows what was and was not tried. A child that does not start (exit 127, a missing file) or exits before the handshake is shown as a failure in words: "✗ the command did not start (exit 127): the harness would get no Engram tools".

MCP server (80x24):

```text
 engram  MCP server                               in process  agent:claude-code
 Acting as   [ agent:claude-code ]  source model, fixed at launch
 Member of   person:dana  [+ add]     Level [ own v]
 Transport   (o) stdio, launched by the harness   ( ) HTTP, needs authentication
 [ ] Offer memory_supersede (--supersede)                       card L6

 engram is not on your PATH; the snippet uses the full path of this CLI.
 For Claude Code, .mcp.json:
   { "mcpServers": { "engram": { "command": "C:\\Program Files\\nodejs\\
     node.exe", "args": ["C:\\src\\engram\\packages\\cli\\src\\main.ts",
     "mcp", "--as", "agent:claude-code", "--member", "person:dana"] } } }

 [ Copy .mcp.json ]  [ Copy Codex config.toml ]  [ Try it ]

 ✓ Try it on a scratch log: handshake ok as agent:claude-code; tools
   memory_read, memory_write, memory_explain, memory_simulate; stopped






$ engram mcp --as agent:claude-code --member person:dana
 enter choose  c copy command  ? help  esc back
```

The tool names listed come from the handshake at run time; the four shown are the ones `packages/mcp` registers today. The paths in the snippet are this checkout's, escaped as JSON requires.

### 8.15 Claude Code hook setup

The hook reads JSON on stdin from Claude Code, so a person never runs it by hand. The screen builds the `engram hook claude-code` command from Store roots (`--root`, repeatable, written as absolute paths: the fixture's `${CLAUDE_PROJECT_DIR}/memory` relies on Claude Code expanding the variable inside `args`, which its documentation does not promise, and an unexpanded root would protect nothing), Protected files (`--protect`, repeatable; with a server, the TUI fills in the log `engram serve --db` names and says why, as `docs/dogfood.md` asks), the block actor (`--as`, default `agent:claude-code`) and the log or server. It shows the `.claude/settings.json` entry in exactly the shape of the tested fixture (`fixtures/harness/claude-code/.claude/settings.json`: `"matcher": "*"`, a `command` and an `args` list), with the command resolved as in 8.14 (on Windows, `node.exe` and the absolute `main.ts` unless `engram` on the PATH is an `.exe`). The entry differs from the fixture only in those two ways, both so it runs as pasted. The TUI writes no settings file itself.

"Try it" never touches the workspace's log and reaches no server. It spawns exactly the copied command and arguments as a child process, with `ENGRAM_DB_URL=:memory:` in its environment and `ENGRAM_SERVER_URL` removed (a `--db` in the entry replaced by `:memory:`, a `--server <url>` replaced by `--db :memory:`, each replacement listed on screen), `CLAUDE_PROJECT_DIR` set to the project, and two sample PreToolUse inputs on stdin: one that touches a store root (expect a deny printed) and one that does not (expect nothing). Each result shows the child's exit code. Claude Code acts on a hook's JSON only on exit 0 and lets the call through on any other code but 2, so a failure to start is shown loudly: "✗ the hook did not run (exit 127). Claude Code would let every tool call through. Fix the command before pasting it."

Claude Code hook setup (80x24):

```text
 engram  Claude Code hook setup                in process  person:dana (person)
 Store roots     C:\src\lantern\memory  [+ add]
 Protected files [+ add]     the log is protected already
 Block events as [ person:dana     ]

 engram on your PATH is a .cmd shim, which this form cannot start on Windows.
 .claude/settings.json, hooks.PreToolUse:
   { "matcher": "*", "hooks": [ { "type": "command",
     "command": "C:\\Program Files\\nodejs\\node.exe",
     "args": ["C:\\src\\engram\\packages\\cli\\src\\main.ts", "hook",
     "claude-code", "--root", "C:\\src\\lantern\\memory", "--as",
     "person:dana"] } ] }

 [ Copy the entry ]   [ Try it on a scratch log ]

 ✓ Read memory\user_role.md   exit 0, blocked: permissionDecision deny
 ✓ Read README.md              exit 0, allowed: the hook printed nothing





$ engram hook claude-code --root C:\src\lantern\memory --as person:dana
 enter choose  c copy command  ? help  esc back
```

### 8.16 Events

The inspector's timeline in the terminal, through `engram events` (3.6): the events the actor may see, newest last, with the inspector's columns (seq, time, op, decision, actor, scope, policy id, reason) and its filters (scope, op, decision, actor; `filterEvents`). Columns that do not fit at 80 are dropped right to left and shown in the detail pane. `/` searches reasons. `f` follows new events (a poll every 2 s with `--after <seq>`, off by default and off under `--reduced-motion` until asked). `enter` opens the event detail (`eventDetail`'s labelled fields); on a read, `e` explains it; on an item, `o` opens the item page. Follow polls only while this screen is open, and each poll asks only for events after the last seq seen.

Events (80x24):

```text
 engram  Events                                in process  person:dana (person)
 Filters  scope [ any v]  op [ any v]  decision [ any v]  actor [ any v]
 11 of 11 events

 seq  time      op       decision  scope           policy id
   4  17:15:15  read     ✓ allow   -               preset.medium/read/person
   5  17:15:16  write    ✓ allow   person:dana     preset.medium/write/person
 > 6  17:15:17  write    ✗ deny    team:platform   preset.medium/write/team
   7  17:15:29  promote  ✗ deny    person:dana to  engram/promote/no-evidence
   8  17:15:30  promote  ✗ deny    person:dana to  engram/write/membership
   9  18:17:08  read     ✓ allow   -               preset.medium/read/person

 event 6  write  ✗ deny  by person:dana  item 01a1ff1a-ef40-749b-9f85-...
 reason  episodic items are forbidden in team scope; provenance set by the
         plane: source user, actor person:dana







$ engram events --owner dana
 enter detail  o item  e explain  / search  f follow  J json  c copy  ? help
```

The rows are the sample log of this design's runs (seq 0 to 3 are the four adopted memories); scope "person:dana to" is `scopeText` cut at the column, and the detail pane shows it whole.

### 8.17 Item page

The inspector's item page (card E8.11) as a screen: the item's current state, its provenance as an indented tree instead of a graph (the same `provenanceGraph` nodes and edges; an ancestor the viewer may not see leaves no node, no edge and no count, exactly the inspector's leak rule), the versions with a line diff between any two (`itemVersions`, `versionText`), and "Events naming this item" (`itemEvents`). Actions on the item: `p` promote, `g` grants, `w` who can read (card E2.13), `S` supersede (card L6). The page is built from what the session's last read and `engram events` returned, so its command row shows the last of those commands as it ran; once card E8.14 merges, an item page opened by id runs `engram read --item <id>`, which is a read with a store folder's sweep and adoption (8.5).

Item page (80x24):

```text
 engram  Item page                             in process  person:dana (person)
 01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c   semantic   person:dana   active
 The deploy key rotates every 90 days.
 owner person:dana  source user engram-cli  confidence 0.9  valid from
 2026-11-21T17:15:16.620Z, open  grants none  stored files:01a1ff1a-...md
┌─ Provenance ─────────────────────────────────────────────────────────────────┐
│ This item  v1                                                                │
│ └─ written by event 5, write ✓ allow, person:dana                            │
│    no earlier version                                                        │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ Versions  1 of 1 ───────────────────────────────────────────────────────────┐
│ one version; nothing to compare                                              │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ Events naming this item ────────────────────────────────────────────────────┐
│   5  write    ✓ allow  preset.medium/write/person                            │
│   7  promote  ✗ deny   engram/promote/no-evidence                            │
│   8  promote  ✗ deny   engram/write/membership                               │
└──────────────────────────────────────────────────────────────────────────────┘




$ engram events --owner dana   exit 0
 p promote  g grants  w who  S supersede  enter event  tab pane  ? help
```

### 8.18 Policy

The policy in force (`engram policy`, 3.6): its label, then each block (write, read, retention, promotion, lints, and the optional content_guards and trust blocks, shown as "off" when absent) as a foldable tree of the YAML the loader parsed. `GET /policy` takes no actor, so the command carries only the workspace's `--policy` (or `--server`) and no actor flags. It is read only; policies are edited in files and the screen's `o` opens the file in `$EDITOR` when the policy is a file. A rule id shown in a denial elsewhere jumps here with that rule unfolded. Card E2.12 (merged) exports a policy to Cedar from core only; "Export to Cedar" appears here if a command for it is ever added.

Policy (80x24):

```text
 engram  Policy in force                       in process  person:dana (person)
 preset.medium v1                                 a bundled preset, read only

 ▾ write
   ▾ team    sources user, document, tool, import   confidence floor 0.7
             forbidden classes episodic   requires review no
   ▸ person  ▸ role  ▸ org
 ▸ read      scope matrix, grants honoured
 ▸ retention
 ▸ promotion
 ▸ lints     enabled duplicate, expired-validity, missing-provenance, ...
   content_guards  off (absent)                        ADR 0039
   trust           off (absent)                        ADR 0040









$ engram policy
 enter fold  / find rule  J json  c copy  ? help  esc back
```

The field names follow `packages/core/src/schema.ts`'s policy contract; the values shown here are illustrative of the layout, and the implementation renders whatever `GET /policy` returns, never a hand-kept copy.

### 8.19 Grants

The inspector's grants editor (card E9.4) through `engram grants` (3.6). It lists the item's grants as the inspector shows them (all of them to the owner, only the viewer's own to anyone else, `shownGrants`) with `grantLabel`'s text, and adds a grant from a draft checked by `grantFrom` with its messages ("a grant names who it is for, such as person:sam"). Each change is one governed call whose decision is shown. After an allowed change, `u` offers the inverse change (9.6).

Grants (80x24):

```text
 engram  Grants on an item                     in process  person:dana (person)
 Item  01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c  The deploy key rotates every 90...
 You own this item: every grant is shown.

 Grants
   person:sam: semantic, read, until 2026-12-01T00:00:00Z     [ remove ]

 Add a grant
   To       [ person:sam      ]
   Class    [ semantic v]   Mode [ read v]
   Expires  [ 2026-12-01      ]  a UTC date or timestamp

 ✓ allow  grant added; u undo (removes it again, a new governed change)









$ engram grants 01a1ff1a-eb0e-... --add person:sam,class=semantic,mode=read,...
 ctrl+s apply  u undo  tab next  c copy  ? help  esc back
```

### 8.20 Export (in flight, card E9.8)

From the registry entry of `engram export`: Out (a file; default stdout, which the TUI never uses, so it asks for a file), encryption (none, recipients `--recipient` repeatable, or a passphrase file). The result is the CLI's line. Export writes a file, not the log, so its confirmation names the file and whether it will be overwritten.

Export (80x24):

```text
 engram  Export a bundle                       in process  person:dana (person)
 Out          [ ~/demo/dana-bundle.jsonl          ]   a new file
 Encryption   ( ) none   (o) age recipients   ( ) passphrase file
 Recipients   age1qyqszqgpqyqszqgpqyqszqgpqyqszqgp...  [+ add]

 The bundle holds the items person:dana owns, with their events.

 ✓ exported 5 items with 9 events as person:dana under preset.medium v1
   to ~/demo/dana-bundle.jsonl, encrypted to 1 recipient













$ engram export --owner dana --out ~/demo/dana-bundle.jsonl --recipient age1...
 ctrl+s export  tab next  c copy  ? help  esc back
```

The result line follows the shape the E9.8 branch prints; its counts here are illustrative until that card merges.

### 8.21 Import (in flight, card E9.8)

Bundle file or a pasted Claude memory list (`--claude`), target scope, confidence (Claude lists only), decryption (`--identity`, repeatable, or `--passphrase-file`). Every row is a governed candidate write by the import actor, so the confirmation says how many rows will be offered and that each is decided by the write gate. The result is one row per item with its decision, and the id map, as the CLI prints them; exit 1 if any row was denied is shown, not exited on.

Import (80x24):

```text
 engram  Import a bundle                       in process  person:dana (person)
 Source       (o) bundle [ ~/demo/dana-bundle.jsonl ]   ( ) Claude list
 Scope        [ default each row's own ]
 Identity     ~/.config/age/key.txt  [+ add]

 import as import:person:dana for person:dana: 5 rows, 4 allowed, 1 denied
   01a1ff1a-eb0e-... -> 01a20000-1111-...: ✓ allow as candidate
   00000000-0000-7fec-... -> 01a20000-2222-...: ✓ allow as candidate
   00000000-0000-705b-... -> 01a20000-3333-...: ✗ deny: episodic items
     are forbidden in team scope (preset.medium/write/team)

 exit 1 as a plain command: a row was denied.










$ engram import ~/demo/dana-bundle.jsonl --owner dana --identity ~/.config/...
 enter row  ctrl+s import  J json  c copy  ? help  esc back
```

The rows are illustrative of the shape `import as <actor> for <importer>: N rows, A allowed, D denied` and `<from> -> <to>: <decision> as <status>: <reason> (<policy_id>)` that the E9.8 branch prints.

### 8.22 Who can read (in flight, card E2.13)

An item (from any item, `w`) or a scope. The answer is the reader set the plane computed, each reader with the rule or grant admitting it (`ReaderEntry`: members of a scope at a level by a policy id, or a grant holder), the closed reason when no one else can, and dormant grants with why they admit no one. Grant holders are named to the owner only, as the route answers. A refusal shows the route's reason; nothing is guessed.

Who can read (80x24):

```text
 engram  Who can read                          in process  person:dana (person)
 Item  01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c   or scope [            ]

 who can read item 01a1ff1a-eb0e-... at 2026-11-21T18:20:00Z as person:dana:
 ✓ answered

   members of person:dana (person)    preset.medium/read/person
   grant to person:sam: semantic, read, until 2026-12-01T00:00:00Z

 Dormant
   none











$ engram who-can-read 01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c --owner dana
 tab item or scope  J json  c copy  ? help  esc back
```

### 8.23 Keys (card E8.12, merged)

`engram key create | list | revoke` from the registry; every call names the key file (`--keys <file>`), which the screen holds at the top and saves with the workspace (its path only). List shows each key as `engram key list` prints it: the masked key, its status, its actor with level and source, and its expiry. Create asks for the actor (`--as`, `--level`, `--member`), its source (`--source`) and an expiry (`--expires`, required), then shows the new key once, in full, with "copy it now; it is not shown again" and the file holding only its hash. Revoke asks with a typed confirmation of the key's id, since it cannot be undone. Serve and MCP open this screen for "Create a key" and return to where they were.

Keys (80x24):

```text
 engram  Keys                                  in process  person:dana (person)
 Key file   [ ~/.engram/keys.json            ]

   egk_7f3a9c2e1b04_****9d1e  active   person:dana (person, source user)
                                       expires 2027-01-01T00:00:00Z
 > egk_2b8e4f6a0c13_****04aa  active   agent:ci (role, source model)
                                       expires 2026-12-31T00:00:00Z
   egk_0c55d1e9a7b2_****71f0  revoked  person:sam (person, source user)
                                       expires 2026-12-01T00:00:00Z

 [ Create a key ]   [ Revoke the selected key ]

 A key is shown in full once, when it is created. Revoking cannot be undone.









$ engram key list --keys ~/.engram/keys.json
 n new  r revoke  c copy  ? help  esc back
```

The rows follow `key.ts`'s list line, `<masked>  <status>  <actor> (<level>, source <kind>)  expires <iso>`, wrapped at 80 columns; the keys themselves are illustrative.


### 8.24 Log verify (in flight, card E1.6)

From card E1.6's card only (its branch had no commits when this was written). `engram log verify` checks the event log's tamper-evident chain and its checkpoints. The screen shows the verdict as status and word (verified, broken at seq n, unsigned checkpoint), the first broken link when there is one, and the CLI's lines. Its flags are not fixed yet; the form is generated from the registry entry when the card merges, and signing, which adds a checkpoint (it removes nothing), asks first as a `state` change.

Log verify (80x24):

```text
 engram  Verify the log                        in process  person:dana (person)
 Log  ~/.engram/engram.db

 ✓ verified   11 events, chain intact to seq 10
 ! unsigned   the latest checkpoint carries no signature

 The chain proves no event was changed or removed after it was written.
 A signed checkpoint also proves who vouched for it.














$ engram log verify
 enter details  v plain  c copy  ? help  esc back
```

The verdict words are the card's (first broken link, UNSIGNED); the exact lines come from the command when it lands.

### 8.25 Procedures (Distill): not a screen

There is no Procedures screen and no Home entry. `POST /distill` answers 501 naming the backlog, no card implements it, and no card plans an `engram distill` command (card D2's induction runs in the runner, card D3's admission through Promote). The palette lists "Procedures: not yet available (backlog)" with no action, so a person searching for it learns why. D3's promotion rule (`engram/promote/validation-source`) and its replay reasons already show on Promote as the CLI prints them. If a command is ever added, its registry entry gives this screen its form.

### 8.26 Supersede (in flight, card L6)

On an item, `S` runs `engram supersede <itemId>` without `--accept`: the plan, which names the head of the item's chain and, for each ancestor the actor may read, a proposed close (`valid_to` set to the item's `valid_from`) or a review flag. Each proposal row shows the ancestor's id, which is what `--accept` takes. Only a close can be accepted, so only close rows have a checkbox; a review row is shown for the person to act on elsewhere, with no control. Choosing proposals and applying runs `engram supersede <itemId> --accept <ancestor id>...`: each accepted close is a new version through the write gate, so it asks first and shows each write's decision. Nothing is retired, and an id with no proposed close refuses the whole call before anything is written, as the CLI does.

Supersede (80x24):

```text
 engram  Supersede                             in process  person:dana (person)
 Item  01a20000-0000-7000-8000-00000000000b  v3  The Lantern release
       freezes merges from Thursday noon until the release is tagged.
 head  this item, the newest of a chain of 3: two ancestors, then this item

 Proposals, one per ancestor you may read
   [x] close   00000000-0000-7fec-aeaa-eb2bfa22eb9b  valid_to
               2026-11-22T09:00:00Z, this item's valid_from
       review  00000000-0000-705b-a9ef-bd1e9ea92409  flagged for review

 Accepting writes a new version of each chosen ancestor with that end date;
 the write gate decides each, as for any update.










$ engram supersede 01a20000-...-00000000000b --accept 00000000-...-eb2bfa22eb9b
 space choose  ctrl+s accept chosen  c copy  ? help  esc back
```

The ids, dates and the second proposal are illustrative of the response's `head`, `chain` and `proposals` (`item_id`, `action`, `valid_to`, `reason`) on the L6 branch; the reason text shown is the response's `reason` field.

### 8.27 Command palette

`;` (outside a text field) or `ctrl+p` (where the terminal passes it; VS Code's terminal keeps ctrl+p for Quick Open) opens the palette over any screen. It is not `:`, which every scope id contains. It fuzzy-searches (pi-tui's `fuzzyFilter`) every registry command by its label, its command name, its flags and its help line, plus the TUI's own actions (switch actor, open workspace, forget saved workspace, line mode, toggle plain view, rerun, copy), and the one entry with no action, "Procedures: not yet available (backlog)". Each row shows the label and the command. A query that names a flag (`--review`) finds the command that takes it. Typing a full command line (`read release --owner dana`) and pressing enter opens that screen with the form filled from the flags, so a person can paste a command they know.

Command palette (80x24):

```text
 engram  Read and explain                      in process  person:dana (person)
 Query [ release ]

         ┌─ Commands ─────────────────────────────────────────────────┐
         │ > prom                                                     │
         │                                                            │
         │ > Promote an item            engram promote <itemId> --to  │
         │   Approve a promotion        engram promote --review       │
         │   Promotion rules            engram policy                 │
         │                                                            │
         │ enter open   tab fill   esc close                          │
         │                                                            │
         └────────────────────────────────────────────────────────────┘









$ engram read release --owner dana
 ? help  esc back
```

### 8.28 Help overlay

`?`, or `ctrl+g` while typing in a field, shows the keys of the current screen first, then the global keys, then the screen's command and its help section from HELP verbatim, so the overlay and `engram --help` never disagree. `?` or `esc` closes it.

Help overlay (80x24):

```text
 engram  Read and explain                      in process  person:dana (person)
 Query [ release ]

    ┌─ Help: Read and explain ─────────────────────────────────────────────┐
    │ This screen                                                          │
    │   enter  item page      e  explain        p  promote                 │
    │   w      who can read   g  grants         S  supersede               │
    │   v      plain view     J  JSON view      c  copy command            │
    │ Everywhere                                                           │
    │   ; or ctrl+p  commands     ctrl+o  workspace    esc  back           │
    │   ? (ctrl+g in a field)  this help   L line mode   ctrl+c quit       │
    │   The mouse is on: Shift+drag selects text. --no-mouse turns it off. │
    │ engram read [query]                                                  │
    │   read through the plane and explain every returned item             │
    │   --at <iso time>  read: the time validity windows are judged at     │
    │                                                                      │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘




$ engram read release --owner dana
 ? help  esc back
```

### 8.29 Confirmation

One dialog shape for every action whose registry entry says it writes state or erases (9.5): what will happen in one sentence, the exact command, the preview when a check exists, whether it can be undone, and two buttons with the safe one focused. `y` or enter on the action button runs it; `n` or `esc` cancels.

Confirmation (80x24):

```text
 engram  Write a memory                        in process  person:dana (person)
 Content  The deploy key rotates every 90 days.



       ┌─ Write this memory? ───────────────────────────────────────────┐
       │ Writes one semantic item to person:dana as person:dana.        │
       │                                                                │
       │ $ engram write --content "The deploy key rotates every 90      │
       │   days." --owner dana --root ~/demo/mem                        │
       │                                                                │
       │ The gate would  ✓ allow  (preset.medium/write/person)          │
       │ A write cannot be undone; later changes are new versions.      │
       │                                                                │
       │              [ Cancel ]      [ Write ]                         │
       └────────────────────────────────────────────────────────────────┘






$ engram write --content ... --owner dana
 ? help  esc back
```

### 8.30 ASCII fallback

`--ascii`, `ENGRAM_TUI_ASCII=1`, or a terminal the TUI detects as unable to show box drawing (11.7) draws the same layout with ASCII only. In conhost the symbols are ASCII by default and the box drawing stays Unicode (11.7). The Home screen of 8.1, with no colour:

ASCII fallback (80x24):

```text
 engram  Home                                  in process  person:dana (person)
+----------------------------------++------------------------------------------+
| Memory                           || Read and explain                         |
| > [r] Read and explain           ||                                          |
|   [w] Write a memory             || engram read [query]                      |
|   [p] Promote an item            ||                                          |
| Policy                           || + allow   x deny   ? ask                 |
|   [l] Lint a scope               || + ok   x fail   - skip   ! warn          |
| Machine                          ||                                          |
|   [d] Doctor                     ||                                          |
|                                  ||                                          |
|                                  ||                                          |
|                                  ||                                          |
|                                  ||                                          |
|                                  ||                                          |
|                                  ||                                          |
|                                  ||                                          |
|                                  ||                                          |
|                                  ||                                          |
|                                  ||                                          |
+----------------------------------++------------------------------------------+
 + doctor: all checks passed 18:17   log ~/.engram/engram.db   preset.medium v1
$ engram read --owner dana --root ~/demo/mem
 enter open  1-6 group  letter action  ? help  ; commands  q quit
```

### 8.31 Line mode

`engram tui --line`, or `ENGRAM_TUI_LINE=1` (saved too, so a screen-reader user sets it once), is the plain CLI with prompts, for screen readers and for terminals where a full-screen layout is a burden. `engram --help` names it on the `tui` line. It never redraws, never moves the cursor up, uses no colour and no box drawing, and writes each prompt as one line ending in a colon. An empty Enter at the `command:` prompt lists the commands again; only `quit` (or ctrl+d, end of input) leaves. `mcp` and `hook` are offered as setup only: line mode prints the configuration to paste (8.14, 8.15) and, on request, runs Try it on a scratch log; it never runs either command on its own terminal. A transcript (`>` marks what the person typed):

Line mode transcript (not a fixed-size frame; lines wrap as the terminal wraps them):

```text
engram tui, line mode. Type a number or a command name; help explains; quit leaves.
1 read  2 write  3 check  4 promote  5 explain  6 retain  7 lint  8 simulate
9 events  10 policy  11 grants  12 doctor  13 serve  14 key
15 mcp setup  16 hook setup
command: >
1 read  2 write  3 check  4 promote  5 explain  6 retain  7 lint  8 simulate
9 events  10 policy  11 grants  12 doctor  13 serve  14 key
15 mcp setup  16 hook setup
command: > 2
write one item through the plane's write gate
content (required): > The deploy key rotates every 90 days.
scope (default person:dana): >
class, semantic or episodic (default semantic): >
confidence, 0 to 1 (default 0.9): >
valid from (default now): >
valid to (default open): >
the gate would: allow, preset.medium/write/person (engram check, nothing stored)
run: engram write --content "The deploy key rotates every 90 days." --owner dana
write it? yes or no (default no): > yes
write 01a1ff1a-eb2f-7796-86da-f7ba06d213c8 at 2026-11-21T17:15:16.645Z by person:dana
allow: semantic item from source user passes the person write rule; provenance set by the plane: source user, actor person:dana
policy preset.medium/write/person
item 01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c semantic in person:dana, status active, stored at files:01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c.md
log ~/demo/engram.db
exit 0
command: > quit
```

The output after "write it?" is `engram write`'s own text, unchanged, because line mode runs the command through `run(argv, io)` with the same `Io`. A screen reader therefore reads exactly what the CLI prints. The menu is the registry's, so commands of cards in flight join it when they merge.

## 9. Interaction

### 9.1 Keys

Keys are defined once in `app.ts` as a table (action, keys, description, screens) that the help overlay, the footer hints and the key-flow tests all read; pi-tui's `KeybindingsManager` holds them, so a person can rebind them in `~/.engram/tui-keys.json` (an object of action to key list, validated at start; a conflict is reported and the default kept). Every action has a binding that needs no function key, no Alt and no chord that Windows Terminal, conhost, VS Code's integrated terminal, tmux or macOS Terminal keeps for itself; where a familiar key is taken by one of them (VS Code keeps ctrl+p for Quick Open and F1 for its Command Palette), it is only ever a second binding. On each screen a key has one meaning, and a test holds the table to that (section 13).

| keys | action | where |
|---|---|---|
| `?`; `ctrl+g` in a text field (also F1 where it reaches the TUI) | help overlay | everywhere |
| `;`; also `ctrl+p` where the terminal passes it | command palette (`;` is not in any scope id or principal, unlike `:`) | everywhere; `;` outside a text field |
| `ctrl+o` | workspace panel | everywhere |
| `esc` | back, close an overlay, cancel a form (asks if the form has input) | everywhere |
| `q` | quit | Home; on other screens `q` is `esc` unless typed in a field |
| `ctrl+c` | quit now; stops a running serve first; never asks | everywhere |
| `L` | switch to line mode, keeping the workspace | Home, first run |
| `up`, `down`, `k`, `j` | move | lists |
| `pgup`, `pgdn`, `home`, `end` | page, first, last | lists, plain view |
| `tab`, `shift+tab` | next and previous field or pane | forms, split screens |
| `enter` | open, choose, or the default button | everywhere |
| `space` | toggle a checkbox or radio | forms |
| `ctrl+s` | submit the form (opens the confirmation where 9.5 asks for one) | forms |
| `ctrl+x ctrl+e` | open the content in `$EDITOR`, read it back on save (as in bash and zsh) | Write |
| `ctrl+r` | refresh the session's cached scopes (one `engram scopes` call) | a scope picker |
| `/` | find in the current list or text | lists, plain view |
| `c` | copy the command line | everywhere a command is shown |
| `v` | plain view: the command's exact text output | results |
| `J` | JSON view: the exact `--json` output | results |
| `r` | run again with the same flags | results, Doctor |
| `e`, `o`, `p`, `g`, `w`, `S` | explain, item page, promote, grants, who can read, supersede | on a selected item or read |
| `u` | undo the last grant change (9.6) | Grants only |
| `1` to `6`, letters | jump to a group or an action; never `j`, `k`, `c`, `q`, `v`, `J`, `L`, `/`, `;` or `?` | Home |
| `ctrl+l` | redraw the screen | everywhere |

In a text field every printable key types, `:` included, so a scope can be typed whole; only `esc`, `tab`, `enter`, `ctrl+s`, `ctrl+c`, `ctrl+g`, `ctrl+x ctrl+e` in Write, and the pi-tui editing keys (`ctrl+a`, `ctrl+e`, `ctrl+w`, `ctrl+u`, `ctrl+k`, arrows) act. A picker is a text field with a list under it: typing filters, `up` and `down` choose. The workspace panel's "Reset to the flags given" is a button, not a key, since the panel holds scope pickers that use `ctrl+r`.

### 9.2 Help overlay

As drawn in 8.28. It is generated from the key table and the registry entry of the screen's command, so it cannot drift from either. It says that the mouse is on and that Shift+drag selects text.

### 9.3 Command palette

As drawn in 8.27. Ranking is pi-tui's `fuzzyFilter` (all query tokens in order; lower score first), with ties broken by the registry's order. An unknown query shows "No command matches. Did you mean read?" using the same suggestion function as the plain CLI (12.2). The palette also lists recent commands of the session, so `;` then `enter` reruns the last one.

### 9.4 Forms and validation

- A form is generated from the command's registry entry: one control per option, in the order of its HELP section, advanced options folded. A hand-made screen can lay the same controls out differently but may not add a control without a flag.
- Validation runs on leaving a field and on submit, and uses the CLI's own checks, imported from `setup.ts` and `commands.ts` (`checkTime`, `checkNumber`, `buildActor`, the `Id` and `Scope` parsers, the port check). The message under the field is the `UsageError` message the CLI prints, minus the `engram <command>: ` prefix, for example "--confidence \"high\" is not a number" or "--to org is not a scope (person:<id>, role:<id>, team:<id> or org)". The flag name stays in the message on purpose: it teaches which flag the field is.
- Cross-field rules are the CLI's too: "give the item with --content or --file", "give the target scope with --to <scope>", the `--at` refusals, the workspace flags refused with a server, E8.12's "the server needs authentication". They show at the top of the form with the cursor on the first field involved.
- A submit with errors runs nothing. The command line row shows the command as far as it can be built, with the faulty flag marked `<here>`.
- What the CLI does not check, the form does not check: a scope the actor is not a member of is a valid form, and the plane's denial is the answer, shown as a decision.

### 9.5 Confirmation

From the registry's `writes` function (6.1), evaluated with the form's values and the workspace:

| writes | commands | confirmation |
|---|---|---|
| `none` | doctor, simulate, explain, policy, check, events, who-can-read (its routes append no event), key list, log verify, and the Try it of MCP and hook setup (a child process on a scratch `:memory:` log, 8.14 and 8.15) | none |
| `audit` | lint (appends lint events); read and `read --item` with no store folder (append one read event); `scopes`, which appends a read event | none |
| `state` | read and `read --item` with a store folder (adoption, and as the store's owner the retention sweep, 8.5); write, promote, grants, import, supersede with `--accept`, key create, log checkpoint signing (it adds a checkpoint and removes nothing) | the dialog of 8.29; for a read, the dialog of 8.5, once per session per workspace, its first line then repeated in the command row of every later read |
| `retire` | retain | the strong dialog of 8.9: the action button not focused, and "Retiring cannot be undone. Retired items stay in the log; reads no longer return them." |
| `erase` | key revoke, and any erasure command a later card adds | the dialog, with the action button not focused and a typed confirmation: the key id, item id or the word `erase` |
| `file` | export (writes the bundle file) | the dialog names the file and says whether it exists and will be overwritten |
| `process` | serve, and mcp over HTTP | none to start; the screen shows it running and how it authenticates; quitting the TUI stops it and says so |

A read through the TUI can therefore never retire an item without the person having been told, in that session, that reading sweeps.

### 9.6 Undo

Undo exists only where the plane has a governed inverse, and that is one place today: a grant change. After an allowed `grants` call, `u` on the Grants screen builds the inverse call (remove what was added; add back what was removed, if it has not expired) and shows it in the confirmation dialog as a new command. It is a new governed change with its own event, not an erasure, and it may be denied. Nowhere else is undo offered: a write cannot be unwritten (a later update is a new version), a promotion cannot be reversed from the CLI, a sweep's retirements are final, an import's rows are candidates the person reviews, a revoked key stays revoked. Form editing has its own local undo (`ctrl+z` in text fields, pi-tui's editor undo), which changes nothing outside the form.

## 10. States

### 10.1 Decisions

Every decision is shown the same way on every screen, in the inspector's terms:

```
✓ allow   ✗ deny   ◆ ask            (ASCII: + allow   x deny   ? ask)
reason     the event's reason, whole, wrapped, never cut
policy id  the event's policy_id, as the inspector shows it in code style
event      seq and id, with o to open the item and enter to open the event
exit       the exit code the plain command returns for it
```

A deny or an ask is not an error state: the screen is the result screen with the decision first. The TUI quotes the reason and offers no remedy derived from it or from the rule id: no "use this class", no "ask this person". The only follow-ups are neutral and always the same for a screen (change a field and preview again, open the rule in Policy, the reviewer handoff of 8.8), so a policy change never leaves the TUI giving stale advice. A read shows its counts line and filtered categories with the explain view's labels ("outside the validity window", "not active", "past their ttl", "by a grant's class or expiry") and the out-of-reach line.

### 10.2 Loading

A call shows "working" in the command line row at once, with the command. After 300 ms the pane shows a busy line naming what is happening ("reading through the plane", "adopting ~/demo/mem", "running doctor: adapter letta"); under `--reduced-motion` it is a static `…` (ASCII `...`), otherwise a pi-tui `Loader` with a four-frame indicator at 120 ms. Doctor and import fill row by row. `esc` during a call cancels the wait but not the call (a plane call is not abortable halfway); the screen says "the call is still finishing; its result will be in the log".

### 10.3 Errors

The error state shows the CLI's stderr line verbatim, the exit code the plain command would return, and one next step:

| error | shown as | next step offered |
|---|---|---|
| `UsageError` (exit 2) | the message under the field it names, or at the top of the form | the field focused |
| 501, a card not landed | "· not yet: <message>", naming the card or the backlog as the route does | back |
| a log that cannot be used (`logRefusal`, a bad `ENGRAM_DB_URL`) | the message, with the log's label redacted as the CLI redacts it | open the workspace, run doctor |
| a policy that does not load (including lints in flight with bad thresholds) | the loader's message | open the workspace |
| a server that refuses to start (`bindRefusal`, card E8.12) | the message, verbatim | the authentication field focused |
| a 500 in process | "internal error" and the error as `onError` printed it to stderr, kept in the session log | rerun, run doctor |
| `CallError` from a server | the server's message and status | open the workspace |
| a decision export that failed (card E8.13) | the stderr line, in the status bar; the call's result is unaffected, as in the CLI | open the workspace |

Secrets never appear: every message the TUI shows has passed the same `redactSecrets` the CLI applies, and a test holds the TUI to `packages/cli/test/redaction.property.test.ts`'s property. The saved workspace never holds one (8.3).

### 10.4 Empty

- A read that returns nothing: "No items returned" with the counts line, which says why (filtered or out of reach), and "Write one" and "Change who you act as" buttons.
- Lanes the viewer is a member of but that hold nothing: "nothing to read", as the inspector says.
- No events visible: "No events you may see. Events show to their maker and to readers of their scopes."
- No store folder: Read works on the log alone and says "no store: reading the log only"; Write says the CLI's 503 message.

### 10.5 Offline and server states

- Server mode checks `GET /health` on entering the workspace and before each call only after a failure; the title bar shows "server 127.0.0.1:7313" or "server unreachable". A refused connection shows "The server at http://127.0.0.1:7313 did not answer. Start it with engram serve, or switch to in process." with both actions. The TUI never falls back to in process by itself, since that would change which log the next call writes.
- `ENGRAM_OFFLINE=1` changes nothing in the TUI. The TUI reaches the network only where the CLI would: a named server, a Postgres log, and, when the person turns decision export on (card E8.13, `--otlp` or `ENGRAM_OTLP_URL`), the named collector, which the workspace bar then shows by URL.
- A 401 or 403 `forbidden_actor` (card E8.12) shows the reason and "set ENGRAM_TOKEN to a token or key this server accepts", never the token; the CLI has no token flag, so the variable is the only way to send one.

## 11. Accessibility

### 11.1 Keyboard first, mouse optional

Everything is reachable from the keyboard alone, with a visible focus marker (reverse video plus `>`), and focus order follows reading order. Decided on 2026-11-22 (section 14, item 5): the mouse is captured by default (pi-tui's `mouse` option) for clicks, the wheel and pi-tui's own text selection with copy on select, and Shift+drag selects text with the terminal's own selection in Windows Terminal, VS Code, iTerm2, kitty and most others; the help overlay says so. `--no-mouse` or `ENGRAM_TUI_MOUSE=0` (saved too) leaves the mouse to the terminal, so its own selection, screen magnifiers and accessibility tools work unchanged.

### 11.2 No colour

`NO_COLOR` (any non-empty value, per no-color.org) or `--no-color` removes every colour escape. Attributes that are not colour (bold, reverse video for focus and the title bar, underline for the access letter) stay, since they carry no hue. With no colour the screens look exactly as the mockups are drawn. The plain CLI prints no colour today and stays that way (12.4).

### 11.3 Palettes

Colour is applied to the status symbol only; the status word and every other text stay in the terminal's default foreground, so reading never depends on a hue's contrast. Every status has a symbol and a word, so colour is never the only carrier. The hues are Okabe-Ito's, distinguishable with the common colour-vision deficiencies, in a dark and a light variant, each at 4.5:1 or better against the background it is meant for (computed with the WCAG relative-luminance formula against `#1e1e1e` and `#ffffff`):

| status | symbol and word | dark theme | light theme | high contrast |
|---|---|---|---|---|
| allow, ok | `✓ allow`, `✓ ok` | `#00A67A` (5.35:1) | `#00684C` (6.81:1) | bold symbol |
| deny, fail | `✗ deny`, `✗ fail` | `#E86A1A` (5.17:1) | `#A33F00` (6.43:1) | bold underlined symbol and word |
| ask, warn | `◆ ask`, `▲ warn` | `#E69F00` (7.40:1) | `#8A5A00` (5.93:1) | bold symbol |
| info, running | `ℹ`, `● running` | `#56B4E9` (7.22:1) | `#005A8C` (7.39:1) | plain |
| skip, not yet | `· skip`, `· not yet` | the terminal's default foreground | the same | plain |

The variant is chosen from the terminal's background: pi-tui's terminal colour query (an OSC 11 report, parsed by `parseTerminalColorSchemeReport`), else `COLORFGBG`. When neither answers, the TUI uses the terminal's own indexed colours (green, red, yellow, blue), which the person's theme already tunes for its background, rather than guessing. Truecolor is used when `COLORTERM` says so and the 256-colour nearest otherwise (pi-tui's `styleText` with `getTerminalColorMode()`). `--high-contrast` (or `ENGRAM_TUI_CONTRAST=high`) uses no hue at all, only bold and underline on the terminal's own colours, which is what Windows high-contrast themes render best; there deny is bold and underlined, unlike focus, which is reverse video everywhere, so a focused denied row shows both and neither is mistaken for the other.

### 11.4 Sizes

The minimum is 80x24, the classic terminal and the conhost default. At 120 columns the wide layouts of section 8 apply; between, panes grow. Below the minimum the screen of 8.4 is shown and the state kept. Long ids are cut in the middle with `...` only in list columns and, when a command is wider than the terminal, in the command line row; the detail pane, the wide layout and every copied command carry them whole.

### 11.5 Reduced motion

`--reduced-motion` or `ENGRAM_TUI_MOTION=reduce`: no spinner frames (the `Loader` gets `frames: []` and the static marker), no follow mode unless asked, no smooth scrolling. Without the flag the only motion is the busy indicator during a call; nothing blinks.

### 11.6 Screen readers: line mode

A full-screen TUI redraws regions, which screen readers read poorly. `engram tui --line` (8.31) is the accessible mode: sequential prompts, each a full sentence ending in a colon, defaults stated in words, no redraw, no colour, no box drawing, and the command's own output printed as the CLI prints it. It runs on `node:readline` only, with no pi-tui import, so it works wherever the CLI works with a TTY. It is found without the full-screen TUI: `engram --help` names it on the `tui` line, `ENGRAM_TUI_LINE=1` starts it every time (and is saved with the workspace when chosen), and `L` switches to it from Home and first run, whose first screen also says "Using a screen reader? Press L for line mode, or set ENGRAM_TUI_LINE=1." Every screen of section 8 has a line-mode equivalent generated from the same registry entry; the rich views (lanes, item page) become their plain-view text; mcp and hook are setup only.

### 11.7 Terminals and glyphs

| terminal | expectation | how checked |
|---|---|---|
| Windows Terminal (PowerShell, cmd, Git Bash) | full: truecolor, Unicode, mouse, OSC 52 | spike under ConPTY; manual check in E8.15e |
| conhost (legacy console) | full layout; 256 colours; Unicode box drawing kept; status symbols ASCII by default, since its fonts have no fallback and Consolas may lack ✓ ✗ ◆ ▲ ● ℹ ▸ ▾; copy through pi-tui's native clipboard | spike under ConPTY (which conhost hosts) checked the bytes, not the glyphs; card E8.15e's manual check rendered them in a real conhost window (`docs/design/tui-manual-check.md`) |
| VS Code's integrated terminal | full; ctrl+p and F1 go to VS Code, so `;` and `?` (`ctrl+g` in fields) are the bindings and the hints show them when `TERM_PROGRAM` is `vscode`; copy through the native clipboard | manual check in E8.15e |
| Git Bash in mintty | with ConPTY: full; without: Node sees pipes and the refusal of 5.2 suggests `winpty engram tui` | spike under bash in ConPTY; manual check of mintty |
| macOS Terminal | full layout; 256 colours (no truecolor), so the 256 palette; Option is not Meta by default, so no key uses Alt; copy through the native clipboard | manual check in E8.15e |
| tmux (and screen) | full; OSC 52 only with `set-clipboard on`; pi-tui's synchronized output is skipped where unsupported | headless tests with `TERM=tmux-256color`; manual check |

Glyphs: the Unicode set is `┌ ┐ └ ┘ ─ │ ▸ ▾ ✓ ✗ ◆ ▲ · ● ℹ █`. The ASCII set is `+ + + + - | ~ v + x ? ! - * i #`: the closed fold is `~`, no other ASCII glyph and not the `>` that marks the selection (card E8.15c's verification, `docs/log/2026-11-23-e8-15c-decision-ascii-glyphs.md`). ASCII is used when `--ascii` or `ENGRAM_TUI_ASCII=1` is given, when `TERM` is `linux` or `vt100`, or when the locale is not UTF-8 on a POSIX system (`LC_ALL`, `LC_CTYPE`, `LANG` without `UTF-8`). On Windows with `WT_SESSION` and `TERM_PROGRAM` both unset (conhost; VS Code, mintty and WezTerm set `TERM_PROGRAM`), the status symbols are ASCII and the box drawing stays Unicode. Card E8.15e's manual check (`docs/design/tui-manual-check.md`) kept that default: Windows 11's conhost renders the other status symbols, but `ℹ` overlaps the cell after it, and Windows 10's renderer could not be checked. Widths are measured with pi-tui's `visibleWidth` (east Asian widths included), so content in any script lays out correctly.

## 12. The plain CLI

### 12.1 What is pinned

Byte for byte, with the existing tests as the proof: every existing command's stdout, stderr and exit code for every input; `HELP`'s existing lines but its first; bare `engram` (help on stderr, exit 2) but for that first line; `-h`, `--help` and `help` (help on stdout, exit 0); `<command> --help` (the full help); the first line of an unknown command's error; the hook's JSON; `mcp`'s stdout.

### 12.2 What changes

1. **HELP's first line** (decided on 2026-11-22, section 14 item 2): `engram: the Engram control plane from the command line; engram tui opens the terminal interface`, so people find the TUI from bare `engram` and from `--help`. The help snapshot test is updated by that line, in E8.15a.
2. **New commands**: `tui`, whose help line is `tui               the terminal interface; --line or ENGRAM_TUI_LINE=1 for one prompt a line`; `check`, `events`, `policy`, `grants`; and after card E8.14 merges, `scopes` and `read --item <id>` (3.6). Each adds its HELP lines in the commands list and its own options block, exactly as cards E9.8 and E2.13 do.
3. **"Did you mean"**: an unknown command whose name is within edit distance 2 of a registry name gets a second stderr line, `engram: did you mean "read"?`. An unknown flag gets `engram read: did you mean --root?` after the parseArgs message. The first line, the exit code (2) and stdout do not change; with no close match nothing is added.
4. **The registry**: `HELP` is generated from it. The existing snapshot test proves the generation is byte-identical before anything is added.

### 12.3 What does not change, on purpose

- `<command> --help` keeps printing the whole help. A per-command help is the TUI's `?` and the palette; changing `--help` output would break the pin.
- `engram help <command>` keeps printing the whole help, for the same reason.
- Error shape stays `engram <command>: <message>` on stderr, which is already consistent across commands; the TUI shows the same message.

### 12.4 Colour

The plain CLI adds no colour, on a TTY or not. Colour lives in the TUI. This keeps every pinned output and every screen reader transcript of the plain CLI unchanged.

## 13. Tests the implementation must have

Following `docs/conventions/testing.md`: fakes, no mocks; an injected clock and ids; every test headless.

| layer | file | what it checks |
|---|---|---|
| registry | `packages/cli/test/registry.test.ts` | `HELP` from the registry equals the pinned snapshot byte for byte (then with only the first line and the new commands' lines changed); every handler's option object is the registry's; every command has exit codes and a `writes` function |
| snapshot frames | `packages/cli/test/tui/frames.test.ts` | each screen of section 8 rendered through a `FakeTerminal` into `@xterm/headless` at 80x24 and 120x40, in the default, `--no-color`, `--high-contrast` and `--ascii` modes, against committed text snapshots under `packages/cli/test/tui/__frames__/`; no snapshot line exceeds its width; the 79x24 and 80x23 frames are the too-small screen |
| keys | `packages/cli/test/tui/keys.test.ts` | on every screen no key is bound to two actions; every action has a binding with no function key, no Alt and neither ctrl+p nor F1 alone; Home's letters avoid the global and list keys |
| key flows | `packages/cli/test/tui/flows.test.ts` | first run to the guided first loop; a second start with a saved workspace opens Home with no doctor call; Forget saved workspace deletes the file; the first read with a store folder in a session, with an expired item in the owner's scope, shows the dialog of 8.5 before any call is made, and a second read does not; write with a denied preview, its neutral shortcuts and "Record this write"; promote with the reviewer handoff, which is not saved to `tui.json`, is undone by Switch back, and is not offered against a server with credentials; grant add then undo; palette search and paste of a command line; resize during a form keeps its input; `ctrl+c` stops a running serve; a scope picker opened five times makes one `scopes` call |
| snippets | `packages/cli/test/tui/snippets.test.ts` | the Claude Code entry and the MCP and Codex configuration have the shape of `fixtures/harness/claude-code/.claude/settings.json`, `.mcp.json` and `fixtures/harness/codex/config.toml`; an `engram` that does not resolve on the PATH gives the absolute command and the warning; on Windows an `engram.cmd` put on the PATH gives the `node.exe` and absolute `main.ts` form, and only an `engram.exe` is used as is; the roots in the generated entry are absolute; Try it of the generated entry blocks the store sample and allows the other; Try it of a command that cannot start shows the loud failure; after Try it the workspace log's event count is unchanged; with `ENGRAM_SERVER_URL` pointing at a counting fake server, and with `--server` in the snippet, Try it makes zero requests to it |
| parity | `packages/cli/test/tui/parity.test.ts` | for every registry command and every flag: the TUI action issues the same request (method, path, body) through `Io.transport` as `run(argv, io)` with the argument vector it shows, in process and against a server (`createApp` behind a fetch); the argument vector shown equals the one run; `v` shows `run`'s stdout byte for byte, `J` the `--json` stdout; card E8.12's serve, mcp and key entries included |
| refusals | `packages/cli/test/tui/entry.test.ts` | each row of 5.2 prints its line, exits 2 and writes no escape sequence; bare `engram` prints the help with its new first line and exits 2 |
| line mode | `packages/cli/test/tui/line.test.ts` | a scripted stdin produces the transcript of 8.31 with the command's exact output; an empty Enter lists the commands and does not quit; `quit` and end of input leave; mcp and hook print their configuration and never run on the terminal; `ENGRAM_TUI_LINE=1` starts it |
| no policy | `packages/cli/test/tui/no-policy.test.ts` and a `biome.json` override | no file under `packages/cli/src/tui` contains a policy id literal (`preset.`, `engram/write/`, `engram/promote/` and the rest) or a preset name; `packages/cli/src/tui/**` may import pi-tui and nothing else in `packages/cli` may; core and adapters still may not import any pi package |
| saved workspace | `packages/cli/test/tui/saved.test.ts` | `tui.json` holds only the listed flags and options; a Postgres URL is saved redacted; no content, id, token or key is ever written |
| redaction | `packages/cli/test/tui/redaction.property.test.ts` | the redaction property over every TUI frame that shows a log label or an error |
| manual | `docs/design/tui-manual-check.md` (E8.15e) | Windows Terminal, conhost (glyphs rendered), VS Code's terminal, Git Bash in mintty, macOS Terminal and tmux, each screen once; the result logged as a `finding` |

The `FakeTerminal` of the spike (ADR 0044) is the seam: it implements pi-tui's `Terminal` interface, feeds its writes into `@xterm/headless`, and takes keys and resizes from the test.

## 14. Decided, and left for the lead

The six calls this design raised were decided on 2026-11-22 under the lead's delegation and are recorded in `docs/tasks/lead-decisions.md`, item 62, with their reasons; the lead may overturn any.

1. **Library.** pi-tui 1.3.0, at the pi pin, imported only under `packages/cli/src/tui/`, with AGENTS.md's "What not to do" line amended. ADR 0044 stays proposed until the lead accepts it; the design proceeds on pi-tui.
2. **Entry.** Bare `engram` keeps its help and exit 2; the TUI opens only with `engram tui`; HELP's first line names `engram tui` (12.2).
3. **New commands.** `check`, `events`, `policy` and `grants` in E8.15a; `scopes` and `read --item <id>` in E8.15a once card E8.14 merges.
4. **Shared view logic.** Not an export of `@engram/ui`: `view.ts` and `provenance.ts` move into a new React-free package, `@engram/view`, which the inspector and the TUI both import (E8.15c), so the CLI never depends on React.
5. **Mouse.** On by default, `--no-mouse` to turn it off; the help overlay says Shift+drag selects text.
6. **Commands on quit.** Printed as a short list on every quit; `--quiet` turns it off.

Left for the lead: accepting ADR 0044 itself. For the plane's backlog, not this card: a read-only preview of a retention sweep (how many items a sweep, or a read's sweep, would retire), which would let the read dialog of 8.5 give a number instead of "any expired item".
