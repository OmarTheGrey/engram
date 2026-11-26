# ADR 0044: The CLI's terminal interface is built on pi-tui, inside packages/cli/src/tui only

Status: accepted, 2026-11-25, by the lead ("accept the adrs"); proposed 2026-11-21; review fix pass 2026-11-22. On 2026-11-22 the design was set to proceed on this choice under the lead's delegation (`docs/tasks/lead-decisions.md`, item 62), with six smaller calls decided in that item's table under the delegation; those six delegated calls stand, since the lead has not overturned them.
Amended 2026-11-26: the lead decided on 2026-11-26 to merge branch `cliupgrade`, where the TUI was built, into main as one pull request (card E8.15, `docs/log/2026-11-26-e8-15-decision-merge-to-main.md`). The decision above is unchanged; the rule it sets, pi-tui only under `packages/cli/src/tui`, now holds on main. The TUI's no-policy guard (`packages/cli/test/tui/no-policy.test.ts`) is a tripwire against accidental policy logic in display code, not a sound analysis; review remains the check. It walks only `packages/cli/src/tui` and `packages/view`, and does not follow the CLI's printed output or other `packages/cli/src` functions' results.
Deciders: drafted by card E8.15 (the lead's own request of 2026-11-21 for a TUI, not one of the absorb plan's thirty pull requests); accepted by the lead on 2026-11-25 (`docs/tasks/lead-decisions.md`, item 62, option (a))
Supersedes: nothing. It adds one exception to AGENTS.md's "What not to do" line on where pi packages are imported; ADR 0033's accepted text is not edited.

## Context

The lead asked for a terminal interface to the `engram` CLI that loses no feature and is easy to use (`docs/design/tui.md`). It needs a library that draws a full-screen layout with boxes and overlays, reads keys including on Windows, survives resizing, and can be driven by a headless test with an injected terminal and keys (`docs/conventions/testing.md`). It must run on Node 24 (ADR 0019), on Windows Terminal, conhost, Git Bash, macOS Terminal and tmux, under a licence ADR 0037 allows, with exact versions at least two weeks old (rule 11).

Today the CLI imports no pi package. AGENTS.md's "What not to do" line names the packages that may reach pi-ai, pi-coding-agent and pi-durable: `packages/pi-extension`, `packages/pi-package`, `packages/runner`, `packages/bench` and `packages/model` (the last added by ADR 0033, whose text holds no list of its own). pi-tui is not named there, so using it in the CLI is not forbidden in words, but the line's intent is that pi is reached from a known, small set of places; this ADR keeps it so by naming the one new place.

## Options compared

Checked on 2026-11-21 against the npm registry and, for the choice, on this Windows 11 machine (Node 24.14.0).

| option | version and date | licence | Node | Windows | maintenance | size | headless tests | accessibility |
|---|---|---|---|---|---|---|---|---|
| `@earendil-works/pi-tui` | 1.3.0, 2026-10-15 (latest 1.6.0, 2026-11-20) | MIT | >=22.19.0 | sets `ENABLE_VIRTUAL_TERMINAL_INPUT` itself; the spike passed under ConPTY and Git Bash | the pi team's, released with pi; already pinned at 1.3.0 in `pnpm-lock.yaml` through `pi-coding-agent` 1.3.0 | 2.9 MB installed (272 KB of it a lazily loaded clipboard addon); dependencies `marked` 18.0.11 and `get-east-asian-width` 1.6.0, both already in the lock: no new package | a `Terminal` interface to inject; the spike drove it with a fake terminal and `@xterm/headless` | no screen-reader mode; mouse capture is an option; fuzzy filter, keybindings manager, overlays, `Loader` with empty frames for reduced motion |
| Ink | 8.0.0, 2026-10-03 | MIT | >=22 | widely used on Windows | active, large community | 620 KB plus 23 direct dependencies, among them `yoga-layout` (WebAssembly) | `ink-testing-library` 4.0.0 (2024-05-22) renders frames | a screen-reader output mode (`useIsScreenReaderEnabled`) |
| `@clack/prompts` | 1.9.0, 2026-11-09 (12 days old on 2026-11-21, under the two-week rule; 1.8.1 of 2026-09-13 would be the version to pin) | MIT | >=20.12 | good | active | 95 KB | prompts over streams | linear prompts, readable by screen readers |
| OpenTUI (`@opentui/core`) | 0.9.7, 2026-11-20 | MIT | >=26.4.0 | native core | releases daily, pre-1.0 | 17.8 MB, a native library | through its own renderer | unknown |
| blessed, neo-blessed | 0.1.81 (2015), 0.2.0 (2018) | MIT | any | historically poor key handling on Windows | unmaintained | 1.7 MB | none built in | none |
| hand-rolled renderer | none | ours | any | ours to get right: Windows VT input, bracketed paste, the Kitty keyboard protocol, east Asian widths, differential redraw | ours | none | ours | ours |

Eliminated outright: OpenTUI needs Node 26.4 (Engram runs on 24) and has no release two weeks old; blessed and neo-blessed have had no release since 2018; `@clack/prompts` draws prompts, not layouts, so it cannot host the screens (its strength is covered by line mode on `node:readline`); a hand-rolled renderer repeats work pi-tui already does and tests.

That leaves Ink and pi-tui. Ink's advantages are real: React, which the inspector already uses at the same major version (19.3.1), and a screen-reader mode. The shared view logic does not tip the balance either way, since it moves into the React-free package `@engram/view` (design section 6.3), so the CLI gains no React through it whichever library draws. pi-tui wins on the rest:

- **No new dependency.** pi-tui 1.3.0 and both its dependencies are already in the lockfile at the pinned pi version; Ink adds React to the CLI, `yoga-layout`'s WebAssembly and about twenty transitive packages, each a `docs/deps.md` row and a licence check.
- **The pi family** (ADR 0001). The CLI's TUI then looks and behaves like pi's own, and moves with the pi pin rather than on a separate release train.
- **The terminal is an interface.** A test injects a fake terminal, sends keys and resizes, and reads frames through `@xterm/headless`, which is the same seam the TUI's snapshot, key-flow and parity tests need (`docs/design/tui.md`, section 13). Ink's test library is two years older than Ink 8 and declares no Ink peer.
- **Windows handled in the library**, which the spike confirmed.

Screen readers are served by line mode in either case: a full-screen redraw reads poorly whatever draws it.

## Decision

1. `packages/cli` depends on `@earendil-works/pi-tui` at exactly the version `docs/deps.md` records for the other pi packages (1.3.0 today), and moves with them: a pi pin bump moves pi-tui in the same PR, and `engram doctor`'s pi pin check covers it, since it checks every `@earendil-works/pi-*` dependency of every workspace package.
2. Only files under `packages/cli/src/tui/` import it. A biome override makes any other import of it in `packages/cli` an error, and core and the adapters keep theirs. Both overrides name `@earendil-works/pi-tui` as an exact path as well as a pattern, since the existing pattern `@earendil-works/pi-*/**` may not match a bare package import (unverified; E8.15b checks it with a failing import).
3. AGENTS.md's "What not to do" line (and CLAUDE.md, its copy) gains one clause: pi-tui is reached only from `packages/cli/src/tui`. ADR 0033 is not edited. pi-ai, pi-coding-agent and pi-durable stay out of the CLI.
4. `@xterm/headless` 5.5.0 (MIT, 2024-04-05) is a dev dependency of `packages/cli` for the frame tests. It is the version pi-tui's own tests use.
5. Line mode uses `node:readline` and no library.

## Spike

Throwaway, never committed, in the session's scratchpad (`tui-spike/`), with `@earendil-works/pi-tui` 1.3.0, `@xterm/headless` 5.5.0 and, for the real-console check only, `@lydell/node-pty` 1.1.0 (2025-01-20, MIT), installed there and nowhere else.

- A two-pane box layout with a header, a footer, a help overlay on `?`, `j`, `k` and arrow keys, an ASCII glyph set and a no-colour mode, on `TuiAltScreen`.
- Headless: a fake `Terminal` feeding `@xterm/headless`; four tests (the 80x24 frame, keys and the overlay, resize to 120x40 and below the minimum, ASCII with no box-drawing character) pass: `node --test headless.test.ts`, 4 pass, 0 fail.
- Real console: `main.ts` run inside a Windows pseudoconsole (ConPTY, which conhost hosts), directly and under Git Bash's `bash.exe`, keys sent and the console resized from 80x24 to 120x40 and then 60x20: in all three runs (direct, bash, direct with ASCII and `NO_COLOR`) the selection moved, the overlay opened and closed, both resizes redrew, `q` exited 0, the alternate screen and synchronized output were used, and the ASCII run wrote no box-drawing character.
- Not a TTY: piped stdout and `/dev/null` stdin both refused with exit 3 (the design's exit is 2) before writing any escape sequence.
- Learned: `truncateToWidth` appends `...` unless its third argument is `""`; layouts must render exactly the terminal's row count; class parameter properties are not allowed under Node's type stripping. Not checked here: mintty without ConPTY, macOS Terminal and tmux, which card E8.15e checks by hand.

## Consequences

- The CLI gains a TUI without a new package in the lockfile, and a reason to keep its pi pin current.
- A pi-tui API change arrives with a pi bump; the TUI's frame tests catch it in that PR. pi-tui moved from 1.3.0 to 1.6.0 in five weeks, so the TUI wraps it in a thin layer (`term.ts`, `theme.ts`) to keep the surface it touches small.
- If the lead prefers Ink when deciding this ADR, the design is unchanged: screens, the registry, the tests and line mode do not depend on the library; `term.ts`, `app.ts` and the screens' render functions are what would differ.
- Changing this needs a new ADR and a `decision` log entry.
