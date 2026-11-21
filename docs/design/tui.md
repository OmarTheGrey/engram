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

## 4. Principles

1. **The TUI teaches the CLI.** Every action is labelled in plain language with its exact command line beside it, kept up to date as the form changes (`engram write --content "..." --scope person:dana`). Before an action runs, the confirmation shows the command; after it runs, the result shows it again with its exit code. `c` copies it (OSC 52, which Windows Terminal, iTerm2, kitty, WezTerm and tmux with `set-clipboard on` accept; where the copy cannot be confirmed the status bar says "printed on exit" instead). Quitting prints the session's commands to stdout, one a line, under `# engram tui: the commands this session ran`, so a person can paste them into a script.
2. **Nothing new is decided here.** The TUI shows what the plane decided, in the inspector's words: the decision, the reason, the policy id, the explanation. It holds no policy `if` (AGENTS.md rule 1). A form validates only what the CLI's own usage checks validate, with the same messages (9.4).
3. **One call per action, the same call.** An action is the plain command's client call, through the same `connect`, so it behaves the same in process and against `--server`, and prints the same text when shown in plain view (6.2).
4. **Calm by default.** Nothing moves unless work is under way; nothing beeps; no colour carries meaning alone; the screen never scrolls under the reader's cursor.
5. **Every state is a screen.** Empty, loading, error, offline, refused and denied each have a designed state with a next step (section 10). A blank pane is a bug.
6. **No dead ends.** Every screen has `esc` back, `?` help and the palette. Every error names the field or flag at fault and puts the cursor there.
7. **Safe by construction.** Anything that writes an item, retires, promotes, changes a grant, imports or erases asks first and names what it will do and whether it can be undone (9.5). Reads and lints, which only append audit events, do not ask; the first read of a store folder in a session says once that reading adopts its memories into the log (8.5).

## 5. Entry and compatibility

### 5.1 How the TUI is entered

`engram tui [options]`. One entry, chosen over the alternatives for these reasons:

- **Bare `engram` stays as it is.** It prints the help to stderr and exits 2, and `packages/cli/test/commands.test.ts` pins that byte for byte. Making the same word do two things depending on TTY detection surprises people in tmux, over SSH and in Git Bash's mintty, where Node may see pipes. Bare `engram` on a TTY opening the TUI is offered to the lead as an option (section 14, item 1); if accepted it is one branch in `run`, after the TTY checks of 5.2, and the non-TTY behaviour stays pinned.
- **Not `engram ui`.** "ui" already names the web inspector (`packages/ui`, `make ui`, served by `engram serve`). Two things called ui would confuse the help, the docs and the thesis.
- **`tui` is a new command name**, so no existing script or test can call it by accident.

`engram tui` takes the workspace flags (`--server`, `--store`, `--root`, `--owner`, `--import-valid-from`, `--policy`, `--db`, `--as`, `--level`, `--member`, and in flight `--otlp`, `--export-jsonl`), which prefill the workspace bar, plus its own:

| flag | meaning |
|---|---|
| `--line` | line mode: the plain CLI with prompts (11.6) |
| `--no-color` | no colour; also `NO_COLOR` set to anything non-empty |
| `--high-contrast` | the high-contrast palette (11.3) |
| `--ascii` | ASCII box drawing and symbols (11.7) |
| `--reduced-motion` | no animation: the busy indicator is a static word (11.5) |
| `--no-mouse` | do not capture the mouse; the terminal's own selection works |
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

Every existing invocation of every existing command keeps its exact stdout, stderr and exit code. In particular: `HELP` for the existing commands, every text and `--json` output, every usage error message, the hook's JSON and `mcp`'s stdout. The help snapshot changes only by the lines each new command adds (`tui`, `check`, `events`, `policy`, `grants`), exactly as cards E9.8 and E2.13 add theirs; section 12 lists every change.

## 6. Architecture

### 6.1 One registry

`packages/cli/src/registry.ts` (new, card E8.15a) is the single description of the CLI. Each entry:

```ts
interface CommandSpec {
  name: string;                    // "read", "hook claude-code", "key create"
  summary: string;                 // the HELP line, verbatim
  group: "memory" | "policy" | "surfaces" | "machine" | "data";
  positionals: PositionalSpec[];   // name, label, required, picker ("item" | "read" | "scope" | "file")
  options: Record<string, OptionSpec>;  // the parseArgs config the handler already uses, plus label,
                                   // help line, default text, control ("text" | "scope" | "time" | "number" |
                                   // "choice" | "file" | "list" | "toggle"), "advanced" flag, and the card
                                   // that added it
  helpSection: string[];           // the "<name> options:" block of HELP, verbatim
  exitCodes: { code: number; when: string }[];
  writes: "none" | "audit" | "state" | "erase";  // drives confirmation (9.5); "audit" appends events only
  handler: (args: string[], io: Io) => Promise<number>;
  card?: string;                   // set while the command is in flight
}
```

- `run.ts` keeps its exported `run` and `HELP`, built from the registry. The test that pins `HELP` keeps passing, which proves the registry reproduces the text byte for byte before any new command is added.
- The handlers keep their own `parse(...)` calls with the same option objects, now read from the registry, so parsing and its error messages do not change.
- The TUI builds its home menu, palette, forms, help overlay and parity test from the registry. A new command, such as `engram export` from E9.8, is one registry entry; it then appears in `--help`, the palette and a generated form with no TUI code. A hand-made screen (Read, Write, Doctor and the others in section 8) is an optional richer view over the same entry.

### 6.2 One call, the same call

- A TUI action builds the argument vector the plain command would get (`["write", "--content", "...", "--scope", "person:dana", ...]`) from the form and the workspace bar. That vector is the command line shown and copied, quoted for the shell detected (POSIX quoting under bash and zsh, PowerShell quoting when `PSModulePath` is set and `SHELL` is not).
- To run it, the TUI calls the command's client call through `connect(io, flags, ...)` with the same flags, so in process and `--server` behave as the CLI does. The command modules expose each command as two parts: `prepare(values, io)` (the flag checks, the actor, the request body; throws the same `UsageError`) and `call(conn, request)` (the one client call), with `readCommand` and the rest kept as `prepare`, `call`, `print`. The TUI renders the typed response; its plain view renders it with the same `format.ts` functions, so the text is the CLI's.
- Commands that are not plane calls: `doctor` runs its checks through the same `doctorCommand` with an `Io` whose `out` the TUI captures (`--json`, parsed), so the checks are not duplicated. `serve` and `mcp` run their own handlers with an `Io.stop` the TUI aborts. The hook is never run by the TUI; its screen writes the Claude Code settings snippet (8.15).

### 6.3 Rules it keeps

- **No policy logic** (rule 1). Everything a screen shows about a decision is a field the response carries. Grouping and labels reuse the inspector's pure functions where they exist (`buildLanes`, `laneGroups`, `filterEvents`, `eventDetail`, `explainView`, `provenanceGraph`, `itemVersions`, `itemEvents`, `grantFrom`, `grantLabel`), imported from `@engram/ui` through a subpath export of its pure modules only (`@engram/ui/view`), never React; card E8.15c adds that export, which changes no inspector behaviour.
- **Stores through the plane** (rule 2). The TUI opens no store and no log itself; the workspace does, inside `connect`.
- **The clock.** The TUI reads time only through `Io.now`, where and when the plain command does: never for a decision, only for what the CLI prints. `--at` is offered on Read only; on other screens it appears only when "Test clock" is on, as the CLI requires `--test-clock`.
- **Ids** come from `Io.newId`, as in the CLI.
- **pi packages.** Only `@earendil-works/pi-tui`, and only under `packages/cli/src/tui/`; ADR 0044 amends ADR 0033's list and adds a biome restriction keeping pi-tui out of every other CLI file and out of core and the adapters.

### 6.4 Modules

```
packages/cli/src/registry.ts          the command registry (E8.15a)
packages/cli/src/tui/main.ts          engram tui: flags, the refusals of 5.2, theme, start and stop
packages/cli/src/tui/term.ts          the TuiTerminal seam: ProcessTerminal in main, FakeTerminal in tests
packages/cli/src/tui/theme.ts         palettes (default, high contrast, no colour), glyph sets (unicode, ascii)
packages/cli/src/tui/app.ts           the router, the status bar, the key map, overlays (help, palette, confirm)
packages/cli/src/tui/workspace.ts     the workspace bar state, flags in and argument vectors out
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
      │            Procedures                                    501 until card D2
      ├─ Surfaces  Serve (HTTP API and inspector)
      │            MCP server
      │            Claude Code hook setup
      │            Keys                                          in flight, card E8.12
      └─ Machine ─ Doctor
Overlays everywhere: Workspace (ctrl+o), Help (?), Palette (ctrl+p or :), Confirm, Plain view (v), JSON view (J)
```

The home screen groups the registry by `group`. First run (8.2) replaces Home until a log, a policy and an actor are named. Every screen has the same frame:

```
row 1        title bar: "engram", the screen, the connection (in process or server), the actor
rows 2..n-2  the screen
row n-1      command line: the exact command this screen would run now, or the last one run, with its exit code
row n        key hints for this screen, then "? help  ctrl+p commands  esc back"
```

The command line row is what makes the TUI teach: it is always on screen and always exact.

## 8. Screens

Every mockup is drawn at its exact size and generated by a script that refuses a line wider than the frame. Row 1 is the title bar, row n-1 the command line (principle 4.1), row n the key hints. In the real terminal the title bar is reverse video, the selected row is reverse video with a `>` marker, and status words carry their colour (11.3); the mockups show the symbols and words only, which is also exactly what `--no-color` shows.

### 8.1 Home

The home screen lists the registry's commands in five groups, each with a plain-language label, a one-line summary and its command. The right pane shows, for the selected action, what it does, what it needs from the workspace and whether it writes. Number keys jump to a group; letters to an action (the underlined letter in the real terminal, shown here in brackets). The health strip at the bottom is the last doctor run of this session, or "not run yet".

Home (80x24):

```text
 engram  Home                                  in process  person:dana (person)
┌──────────────────────────────────┐┌──────────────────────────────────────────┐
│ Memory                           ││ Read and explain                         │
│ > [r] Read and explain           ││                                          │
│   [w] Write a memory             ││ Reads through the plane as               │
│   [p] Promote an item            ││ person:dana and explains every           │
│   [g] Grants on an item          ││ item it returns: its score, the          │
│   [k] Who can read      E2.13    ││ rule that admitted it, grants            │
│ Policy                           ││ used, validity.                          │
│   [l] Lint a scope               ││                                          │
│   [t] Retention sweep            ││ Needs: an actor; a store folder          │
│   [s] Simulate a policy          ││ to adopt its memories first.             │
│   [y] Policy in force            ││ Writes: audit events only.               │
│ Audit                            ││                                          │
│   [e] Events                     ││ engram read [query]                      │
│   [v] Verify the log     E1.6    ││                                          │
│ Data, Surfaces, Machine          ││ enter open   c copy command              │
│   [x] Export    [i] Import       ││                                          │
│   [h] Serve  [m] MCP  [c] Hook   ││                                          │
│   [d] Doctor                     ││                                          │
└──────────────────────────────────┘└──────────────────────────────────────────┘
 ✓ doctor: all checks passed 18:17   log ~/.engram/engram.db   preset.medium v1
$ engram read --owner dana --root ~/demo/mem
 enter open  1-5 group  letter action  ? help  ctrl+p commands  q quit
```

Home, wide (120x40):

```text
 engram  Home                                                 in process  log ~/.engram/engram.db  person:dana (person)
┌─ Actions ────────────────────────────────────────────────────────────┐┌─ Selected ───────────────────────────────────┐
│ Memory                                                               ││ Read and explain                             │
│ > [r] Read and explain           engram read [query]                 ││                                              │
│   [w] Write a memory             engram write                        ││ Reads through the plane as person:dana       │
│   [p] Promote an item            engram promote <itemId>             ││ and explains every item it returns: the      │
│   [g] Grants on an item          engram grants <itemId>              ││ score and its components, the rule that      │
│   [k] Who can read               engram who-can-read     E2.13       ││ admitted it, grants used, the validity       │
│   [u] Supersede                  engram supersede        L6          ││ window.                                      │
│                                                                      ││                                              │
│ Policy                                                               ││ With a store folder, the store's own         │
│   [l] Lint a scope               engram lint --scope                 ││ memories are adopted first as its owner,     │
│   [t] Retention sweep            engram retain --scope               ││ and the owner's retention is swept.          │
│   [s] Simulate a policy          engram simulate                     ││                                              │
│   [y] Policy in force            engram policy                       ││ Needs    an actor (--as or --owner)          │
│                                                                      ││ Store    files at ~/demo/mem                 │
│ Audit                                                                ││ Writes   audit events only                   │
│   [e] Events                     engram events                       ││ Exit     0 done, 1 error, 2 usage            │
│   [v] Verify the log             engram log verify       E1.6        ││                                              │
│                                                                      ││ engram read [query] --owner dana             │
│ Data                                                                 ││   --root ~/demo/mem                          │
│   [x] Export a bundle            engram export           E9.8        ││                                              │
│   [i] Import a bundle            engram import           E9.8        ││ Session                                      │
│   [o] Procedures                 engram distill          D2          ││   3 commands run, 1 denied                   │
│                                                                      ││   last read 01a1ff53-a519-707e-...           │
│ Surfaces                                                             ││                                              │
│   [h] Serve the API and inspector  engram serve                      ││ enter open   c copy command                  │
│   [m] MCP server                 engram mcp                          ││                                              │
│   [c] Claude Code hook setup     engram hook claude-code             ││                                              │
│   [a] Keys                       engram key              E8.12       ││                                              │
│                                                                      ││                                              │
│ Machine                                                              ││                                              │
│   [d] Doctor                     engram doctor                       ││                                              │
│                                                                      ││                                              │
└──────────────────────────────────────────────────────────────────────┘└──────────────────────────────────────────────┘
 ✓ doctor: all checks passed at 18:17    log ~/.engram/engram.db (SQLite, up to date)    policy preset.medium v1
 store files ~/demo/mem    owner dana    member of person:dana    decision export off

$ engram read --owner dana --root ~/demo/mem
 enter open  1-5 group  letter action  /  filter ? help  ctrl+p commands  ctrl+o workspace  esc back  q quit
```

### 8.2 First run

The TUI opens on onboarding instead of Home when the workspace is not usable yet. It runs `engram doctor` (with the flags given) silently first and picks the step from its checks: no log yet, a policy that does not load, no actor, or a failing check. Each step is one question with the default the CLI would use, and each shows the command it amounts to. Nothing is written by onboarding itself: the log is created by the first read or write, as the CLI does, and onboarding says so.

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





$ engram doctor --db ~/demo/engram.db --root ~/demo/mem
 tab next  shift+tab back  enter accept  s skip step  ? help  q quit
```

First run, the policy fails to load (80x24):

```text
 engram  Getting started  policy
 The policy did not load.

   ✗ fail  policy  --policy nosuch.yaml is neither a preset (strict, medium,
                   permissive) nor a readable file

 Choose a policy:

   (o) medium       the default preset
   ( ) strict       higher confidence floors, review to widen
   ( ) permissive   fewer floors
   ( ) a file       [ ./policy.yaml                         ]  browse: tab

 The rest of doctor:  ✓ ok 7   · skip 2   ✗ fail 1
 enter d to see every check.







$ engram doctor --db ~/demo/engram.db --policy nosuch.yaml
 enter accept  d doctor  esc back  ? help  q quit
```

First run, doctor failing (80x24):

```text
 engram  Getting started  doctor
 A check failed. You can still continue; the screens it affects say so.

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

The "adapter letta" failure text is the shape doctor prints when `gitVersion()` throws; the exact message comes from the check at run time.

### 8.3 Workspace

`ctrl+o` opens the workspace panel from anywhere. It holds every flag that names where and as whom a command runs: the connection, the log, the policy, the store and the actor (the inspector's viewer picker, with the same validation: "the viewer needs an id, such as person:dana"). Each field shows its value and where it came from (flag, environment, default). Changing the connection to a server greys out the log, policy and store fields with the CLI's own reason, since a server has its own workspace. Applying shows the flags it now adds to every command.

Workspace (80x24):

```text
 engram  Workspace                             in process  person:dana (person)
┌─ Where and as whom ──────────────────────────────────────────────────────────┐
│ Connection   (o) in process   ( ) server [ http://127.0.0.1:7313    ]        │
│                                                                              │
│ Event log    [ ~/.engram/engram.db                    ]  default             │
│ Policy       [ medium      v]  preset.medium v1 loads and validates          │
│ Store kind   (o) files   ( ) letta                                           │
│ Store folder [ ~/demo/mem                             ]  readable            │
│ Owner        [ dana          ]                                               │
│                                                                              │
│ Acting as    [ person:dana   ]  Level [ person v]  (its own)                 │
│ Member of    person:dana  [+ add scope]                                      │
│                                                                              │
│ Advanced     imported valid from [ each file's mtime  ]                      │
│              decision export off            E8.13                            │
│              test clock off (tests and fixtures only)                        │
│                                                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘



$ --owner dana --root ~/demo/mem   (added to every command)
 tab next  enter apply  ctrl+r reset to flags  esc cancel  ? help
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
 tab next  enter apply  esc cancel  ? help
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

The first read of a store folder in a session shows one notice above the results: "Reading adopts this folder's memories into the log as person:dana. It does not change the files." It is shown once and not asked again.

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
 enter item page  e explain  p promote  g grants  w who can read  u supersede  v plain  J json  c copy  ? help  esc back
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
