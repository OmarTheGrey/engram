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

### 8.7 Write

The form has every write flag. Content is a multi-line editor; Scope, Class, Confidence, Valid from and Valid to are fields with the CLI's defaults written in as placeholders ("default person:dana", "default 0.9", "default now", "default open"). "From file" loads an item JSON, and the fields it sets show "from file" until edited, as the CLI lets the flags fill what the file leaves out. Advanced holds Id.

While the form is edited, the "The gate would" line is a live `engram check` (section 3.6): the decision, reason and policy id a write would get now, with nothing stored and no event. It runs after 400 ms without a keystroke, never on every key. It is labelled a preview, because the decision at write time is made again at the server's clock. If the lead does not accept `engram check`, the line is left out and nothing else changes.

`ctrl+s` (or enter on Submit) opens the confirmation (9.5), which shows the command and the preview. The result is the CLI's three or four lines, with the decision as a status word.

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
 ctrl+s write  tab next field  ctrl+e editor  c copy  ? help  esc back
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

 Why: the policy forbids class episodic in team scopes. Choose semantic, or write it to person:dana.
      [ Use semantic ]  [ Use person:dana ]  [ Show the rule in Policy ]

                                                                          [ Write anyway ]   [ Check again ]














$ engram write --content x --scope team:platform --class episodic --member team:platform --owner dana --root ~/demo/mem
 ctrl+s write  tab next field  ctrl+e editor  c copy  J check json  ? help  esc back
```

The "Why" line and its buttons only rephrase fields the check returned (the reason and policy id) into shortcuts that set form fields; they never decide anything, and a policy file whose rule ids are not the presets' shows only "Show the rule in Policy". "Write anyway" is offered because a denied write is still a recorded decision the person may want in the log.

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

Item comes from the selected item (`p` on Read, Events or the item page) or a picker of items the last read returned; it can be typed, and is checked as the CLI checks it ("nope is not an item id (a UUIDv7)"). To scope is a scope field with suggestions from the actor's memberships and `org`. "Approve as reviewer" is `--review`; turning it on shows the CLI's limit text verbatim. The result shows the decision and every further event the promotion recorded, as the CLI prints them.

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
│ Next: a member of team:platform who does not own the item can approve it     │
│ with As reviewer on. Promotions cannot be undone from here.                  │
└──────────────────────────────────────────────────────────────────────────────┘





$ engram promote 01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c --to team:platform ...
 ctrl+s promote  tab next  v plain  J json  c copy  ? help  esc back
```

### 8.9 Retention sweep

One field, Scope, with the actor's member scopes offered. The confirmation is the strongest in the TUI, because a sweep retires expired items for good and evicts over-budget ones: it says "Retiring cannot be undone. Retired items stay in the log; reads no longer return them." There is no preview route for a sweep, and the screen does not pretend there is.

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
   step 2 write person:dana 01950000-...0003: allow -> deny
   step 4 write person:dana 01950000-...0005: allow -> deny
   step 6 read person:sam: returned 2 -> returned 0
     confidence 0.75 is below the team floor 0.8 (preset.strict/write/team)

 Replayed on scratch logs and stores: your log and store are not touched.


$ engram simulate --workload e8-9-two-presets.json --candidate strict   exit 0
 enter step  a all rows  v plain  J json  c copy  ? help  esc back
```

At 80 columns the table shows the rows that differ first and `a` shows all eleven; the wide layout shows them all.

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

Doctor's checks as a list, each with its status as symbol and word, its name and its detail, exactly the CLI's text. A failing check is sorted first in the TUI (the plain output keeps its order), with "What this means" and "What to do" text taken from a fixed table keyed by check name (log, policy, store, adapter files, adapter mem0, adapter letta, provider keys, benchmark pins, pi pin, node; in flight the serve-flags check of card E8.12), never from parsing the detail. `r` reruns it. Doctor's own flags (`--db`, `--policy`, `--root`) are the workspace's.

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

Host (a choice of the three loopback names the server accepts), Port (default 7313), the viewer the inspector shows (`--as`, `--member`, `--level`; "none" by default), and the workspace. Start runs `serveCommand` in the TUI's process with an `Io.stop` the screen controls; the screen shows the server's start line, the inspector's URL as an OSC 8 link, and a live request count from the client transport. `s` stops it and shows the stop line. Quitting the TUI stops a running server first and says so. In flight, card E8.12: an "Authentication" section with the credential flags and `--insecure-loopback`, and the refusal to start without one shown as the CLI prints it.

Serve (80x24):

```text
 engram  Serve the API and inspector           in process  person:dana (person)
 Host    (o) 127.0.0.1   ( ) ::1   ( ) localhost     loopback only
 Port    [ 7313  ]
 Viewer  [ person:dana    ]  member of person:dana     shown by the inspector
 ▸ Authentication                                      in flight, card E8.12

 ● running
 engram serve: listening on http://127.0.0.1:7313 (log sqlite ~/demo/engram.db,
   preset.medium v1, store files at ~/demo/mem, viewer person:dana)

 Inspector  http://127.0.0.1:7313/        open: o
 API        http://127.0.0.1:7313/api/v1

 The server has no authentication yet, so it listens on this machine only.
 It stops when you press s or quit the TUI.







$ engram serve --as person:dana --member person:dana --root ~/demo/mem
 s stop  o open inspector  c copy  ? help  esc back (keeps it running)
```

The start line shape is `serve.ts`'s; the label `sqlite ~/demo/engram.db` stands for whatever `workspace.target.label` prints.

### 8.14 MCP server

The MCP server is normally launched by the harness, not by a person, so this screen is mostly setup: it builds the `engram mcp` command for the actor and memberships chosen, and shows the snippet for Claude Code's `.mcp.json` and Codex's configuration, with `c` to copy each. "Test it" starts it over streamable HTTP on a free loopback port (`--http`), runs the MCP handshake against it as layer 6 does, shows the tool list, and stops it. Over stdio the TUI never starts it, because stdio would be the TUI's own terminal.

MCP server (80x24):

```text
 engram  MCP server                               in process  agent:claude-code
 Acting as   [ agent:claude-code ]  source model, fixed at launch
 Member of   person:dana  [+ add]     Level [ own v]
 Transport   (o) stdio, launched by the harness   ( ) HTTP port [ 7314 ]

 For Claude Code, .mcp.json:
   { "mcpServers": { "engram": { "command": "engram", "args": ["mcp",
     "--as", "agent:claude-code", "--member", "person:dana"] } } }

 [ Copy .mcp.json ]  [ Copy Codex config ]  [ Test it over HTTP ]

 ✓ test: handshake ok as agent:claude-code; tools memory_read, memory_write,
   memory_explain, memory_simulate; stopped









$ engram mcp --as agent:claude-code --member person:dana
 enter choose  c copy command  ? help  esc back
```

The tool names listed come from the handshake at run time; the four shown are the ones `packages/mcp` registers today.

### 8.15 Claude Code hook setup

The hook reads JSON on stdin from Claude Code, so a person never runs it by hand. The screen builds the `engram hook claude-code` command from Store roots (`--root`, repeatable), Protected files (`--protect`, repeatable; with a server, the TUI fills in the log `engram serve --db` names and says why, as `docs/dogfood.md` asks), the block actor (`--as`, default `agent:claude-code`) and the log or server. It shows the `.claude/settings.json` hook entry to copy, and "Try it" pipes two sample PreToolUse inputs through the same `hookCommand` with an in-memory stdin: one that touches a store root (expect a deny) and one that does not (expect nothing). The TUI writes no settings file itself.

Claude Code hook setup (80x24):

```text
 engram  Claude Code hook setup                in process  person:dana (person)
 Store roots     ~/demo/mem  [+ add]
 Protected files [+ add]     the log is protected already
 Block events as [ agent:claude-code ]

 .claude/settings.json, hooks.PreToolUse:
   { "matcher": "", "hooks": [ { "type": "command", "command":
     "engram hook claude-code --root ~/demo/mem" } ] }

 [ Copy the entry ]   [ Try it ]

 ✓ Read ~/demo/mem/user_role.md      blocked: permissionDecision deny
 ✓ Read ./README.md                  allowed: the hook printed nothing









$ engram hook claude-code --root ~/demo/mem
 enter choose  c copy command  ? help  esc back
```

### 8.16 Events

The inspector's timeline in the terminal, through `engram events` (3.6): the events the actor may see, newest last, with the inspector's columns (seq, time, op, decision, actor, scope, policy id, reason) and its filters (scope, op, decision, actor; `filterEvents`). Columns that do not fit at 80 are dropped right to left and shown in the detail pane. `/` searches reasons. `f` follows new events (a poll every 2 s with `--after <seq>`, off by default and off under `--reduced-motion` until asked). `enter` opens the event detail (`eventDetail`'s labelled fields); on a read, `e` explains it; on an item, `o` opens the item page.

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

The inspector's item page (card E8.11) as a screen: the item's current state, its provenance as an indented tree instead of a graph (the same `provenanceGraph` nodes and edges; an ancestor the viewer may not see leaves no node, no edge and no count, exactly the inspector's leak rule), the versions with a line diff between any two (`itemVersions`, `versionText`), and "Events naming this item" (`itemEvents`). Actions on the item: `p` promote, `g` grants, `w` who can read (card E2.13), `u` supersede (card L6).

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




$ engram events --owner dana   (the page is built from the read and the events)
 p promote  g grants  w who  u supersede  enter event  tab pane  ? help
```

### 8.18 Policy

The policy in force (`engram policy`, 3.6): its label, then each block (write, read, retention, promotion, lints, and the optional content_guards and trust blocks, shown as "off" when absent) as a foldable tree of the YAML the loader parsed. It is read only; policies are edited in files and the screen's `o` opens the file in `$EDITOR` when the policy is a file. A rule id shown in a denial elsewhere jumps here with that rule unfolded. In flight, card E2.12: "Export to Cedar" appears here when a command exists for it.

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









$ engram policy --owner dana
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

### 8.23 Keys (in flight, card E8.12)

`engram key create | list | revoke` from the registry: list shows each key masked (`egk_<id>_****<last4>`, the ADR's form), create shows the new key once with "copy it now; it is not shown again", revoke asks for confirmation naming the key and that it cannot be undone.

Keys (80x24):

```text
 engram  Keys                                  in process  person:dana (person)
 Keys for the local server

   egk_7f3a9c2e1b04_****9d1e   person:dana   created 2026-11-21
 > egk_2b8e4f6a0c13_****04aa   agent:ci      created 2026-11-21   [ revoke ]

 [ Create a key ]

 A key is shown in full once, when it is created. Revoking cannot be undone.













$ engram key list
 n new  r revoke  c copy  ? help  esc back
```

### 8.24 Log verify (in flight, card E1.6)

`engram log verify` checks the event log's tamper-evident chain and its checkpoints. The screen shows the verdict as status and word (verified, broken at seq n, unsigned checkpoint), the first broken link when there is one, and the CLI's lines. Its flags are not fixed yet; the form is generated from the registry entry when the card merges, and signing, which writes a checkpoint, asks first.

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

### 8.25 Procedures (Distill)

Until card D2 adds a command, the route answers 501 naming the card, and so does the screen, as the CLI's exit 2 would: "Candidate procedures from sessions are not available yet; card D2 builds them." When D2 and D3 add commands, the registry entries give this screen its forms; D3's promotion rule (`engram/promote/validation-source`) and its replay reasons already show on Promote as the CLI prints them.

Procedures (80x24):

```text
 engram  Procedures                            in process  person:dana (person)
 · not yet   Candidate procedures from sessions: 501 until card D2

 Procedures are mined from agent sessions, admitted after replay validation
 (card D3) and retired on drift. The plane's route exists; no command calls
 it yet. This screen fills in from the command when it lands.
















$ (no command yet)
 ? help  esc back
```

### 8.26 Supersede (in flight, card L6)

On an item, `u` asks the plane for supersession proposals (an end date for a fact a newer one replaces, or a review flag), the head of the item's chain and any error (`unknown_id`, `cycle_detected`, `depth_exceeded`), and lets the person accept proposals one by one. Accepting is an ordinary governed update, so it asks first and shows each applied write's decision. The plane never retires anything by itself here.

Supersede (80x24):

```text
 engram  Supersede                             in process  person:dana (person)
 Item  00000000-0000-7fec-aeaa-eb2bfa22eb9b  The Lantern release freezes...
 head  this item (chain of 1)

 Proposals
   [ ] close   valid_to 2026-11-21T00:00:00Z   a newer item restates it
   [ ] review  confidence differs from the newer item

 Accepting writes a new version with the end date; it is decided by the
 write gate like any update.












$ engram supersede 00000000-0000-7fec-aeaa-eb2bfa22eb9b --accept ...
 space choose  ctrl+s accept chosen  c copy  ? help  esc back
```

The proposal rows show the response's `action`, `valid_to` and `reason` fields; their text here is illustrative until the card's command exists.

### 8.27 Command palette

`ctrl+p` or `:` opens the palette over any screen. It fuzzy-searches (pi-tui's `fuzzyFilter`) every registry command by its label, its command name, its flags and its help line, plus the TUI's own actions (switch actor, open workspace, toggle plain view, rerun, copy). Each row shows the label and the command. A query that names a flag (`--review`) finds the command that takes it. Typing a full command line (`read release --owner dana`) and pressing enter opens that screen with the form filled from the flags, so a person can paste a command they know.

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

`?` shows the keys of the current screen first, then the global keys, then the screen's command and its help section from HELP verbatim, so the overlay and `engram --help` never disagree. `?` or `esc` closes it.

Help overlay (80x24):

```text
 engram  Read and explain                      in process  person:dana (person)
 Query [ release ]

    ┌─ Help: Read and explain ─────────────────────────────────────────────┐
    │ This screen                                                          │
    │   enter  item page      e  explain        p  promote                 │
    │   w      who can read   g  grants         v  plain view              │
    │   J      JSON view      c  copy command   /  find in results         │
    │ Everywhere                                                           │
    │   ctrl+p or :  commands     ctrl+o  workspace    esc  back           │
    │   ?            this help    q       quit (Home)  ctrl+c quit         │
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

`--ascii`, `ENGRAM_TUI_ASCII=1`, or a terminal the TUI detects as unable to show box drawing (11.7) draws the same layout with ASCII only. The Home screen of 8.1, with no colour:

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
 enter open  1-5 group  letter action  ? help  ctrl+p commands  q quit
```

### 8.31 Line mode

`engram tui --line` is the plain CLI with prompts, for screen readers and for terminals where a full-screen layout is a burden. It never redraws, never moves the cursor up, uses no colour and no box drawing, and writes each prompt as one line ending in a colon. A transcript (`>` marks what the person typed):

Line mode transcript (not a fixed-size frame; lines wrap as the terminal wraps them):

```text
engram tui, line mode. Type a number, a command name, or help. Enter quits.
1 read  2 write  3 promote  4 explain  5 retain  6 lint  7 simulate
8 events  9 policy  10 grants  11 doctor  12 serve  13 mcp  14 hook
command: > 2
write one item through the plane's write gate
content (required): > The deploy key rotates every 90 days.
scope (default person:dana): >
class, semantic or episodic (default semantic): >
confidence, 0 to 1 (default 0.9): >
valid from (default now): >
valid to (default open): >
the gate would: allow, preset.medium/write/person
run: engram write --content "The deploy key rotates every 90 days." --owner dana
write it? yes or no (default no): > yes
write 01a1ff1a-eb2f-7796-86da-f7ba06d213c8 at 2026-11-21T17:15:16.645Z by person:dana
allow: semantic item from source user passes the person write rule; provenance set by the plane: source user, actor person:dana
policy preset.medium/write/person
item 01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c semantic in person:dana, status active, stored at files:01a1ff1a-eb0e-7b15-9e1e-af7066dfc62c.md
log ~/demo/engram.db
exit 1 would mean denied; this one exited 0.
command: >
```

The output after "write it?" is `engram write`'s own text, unchanged, because line mode runs the command through `run(argv, io)` with the same `Io`. A screen reader therefore reads exactly what the CLI prints.
