# The engram terminal interface: manual check

Card E8.15e, 2026-11-23, on the `cliupgrade` branch at the commits of that day (from `767f1c3c` on), on one Windows 11 machine (build 26300, Node 24.14.0). It records what was run on which terminal, what was seen, and what could not be checked and why. Design section 11.7 and section 13's last row ask for it; the log entry is `docs/log/2026-11-23-e8-15e-finding-manual-check.md`.

## How it was run

- Always on a scratch workspace: a scratch `--db`, `--root` and `HOME`/`USERPROFILE`, with `--no-saved`; never the default log, never a repository fixture. Every scratch folder, window and process was removed afterwards.
- Each terminal was launched with a command that runs `engram tui` (`node packages/cli/src/main.ts tui ...`). Keys were typed into the TUI's own console: `WScript.Shell` key presses for conhost, and, for Windows Terminal and mintty, whose windows this session could not bring to the front, key events written into the console's input buffer after attaching to it (the same path a keyboard's keys take through the pseudoconsole). Screens were captured with `PrintWindow` as images and read by eye.
- The session that drove the checks has `NO_COLOR=1` in its environment, which every launched window inherited; the first conhost and Windows Terminal runs therefore drew no colour at all. Every colour statement below is from runs with `NO_COLOR` cleared.
- Scripts and images stayed in the session's scratch folder and are not committed: they hold local paths.

## Terminal by terminal

| terminal | how | what was seen |
|---|---|---|
| conhost (Windows 11, its default font) | a real conhost window, `conhost.exe cmd /k ...`, 120x30 | Home, a move, Doctor run with its 11 checks, the help overlay, quit: the screen came back as it was and the session's commands were printed. ASCII status symbols by default, Unicode boxes. No answer to the colour question, so status symbols are bold with no hue, as designed for an unknown background. L switched to line mode, `policy` ran, `quit` printed its commands. Found and fixed: a long log path hid the actor in the title bar. |
| conhost, Unicode status symbols | the same, with `WT_SESSION` set by hand to force the Unicode set | `✓ ✗ ◆ ▲ · ●` render cleanly; `ℹ` is drawn wider than its cell and overlaps the next one. A glyph line (`┌ ┐ └ ┘ ─ │ ▸ ▾ ✓ ✗ ◆ ▲ · ● ℹ █ …`) showed the same. Decision: the ASCII default stays (`docs/log/2026-11-23-e8-15e-decision-conhost-default.md`). |
| Windows Terminal | `wt.exe -w new new-tab ...`, 120x30 | Home, Doctor, Write with its check preview and the confirmation (Cancel focused), `y` to write, the result with its decision, back, quit: screen restored and both commands printed. Windows Terminal answered the colour question (`rgb:0c0c/0c0c/0c0c`), and the status symbols took the dark hues (green `✓`). First run showed the screen-reader hint. |
| Git Bash in mintty | `mintty.exe -e /usr/bin/bash -l <script>` | mintty here runs programs through a pseudoconsole, so Node sees a terminal and the TUI starts (the `winpty` refusal of 5.2 was not met). Home, Doctor, quit with the summary quoted for bash. Found and fixed: conhost's ASCII symbols were used because only `TERM_PROGRAM=vscode` was told apart; mintty sets `TERM_PROGRAM=mintty` and now gets `✓`. L, a command and `quit` worked. No answer to the colour question through the pseudoconsole: bold symbols, no hue. The lines bash printed before the TUI did not reappear after quit (the pseudoconsole repaints its own view). |
| tmux 3.4 (WSL Ubuntu) | a Linux Node 24.14.0 fetched into a scratch folder, `engram tui` in a detached tmux session with `TERM=tmux-256color`, driven by `send-keys`, read back by `capture-pane` | Home with Unicode boxes at 120x30, a move, Doctor, the help overlay, L to line mode, `policy`, `quit` with its summary; exit 0. Doctor's Mem0 check failed there because the checkout's native SQLite binding is Windows', not a TUI fault. tmux was detached, so nothing answered the colour question: bold symbols, deny bold and underlined. `set-clipboard` is `external`. |
| pseudoconsole and headless xterm | `make test-e2e`'s `test/e2e/tui.e2e.test.ts`: node-pty's ConPTY, its output read by `@xterm/headless` | Home, a move, a command, quit with the summary; Serve, esc, q with exit 0, no uncaught error and "stopped when the TUI quit"; line mode; L; screen from line mode. |

What the Serve smoke pins, and what it does not: of the three behaviours card E8.15d's review asked it to hold, it catches one. Quitting inside pi-tui's input handler instead of on the next turn (setImmediate) fails it. Removing the redraw guard, or the guard around the quit summary's write, still passes it: pi-tui 1.3.0 skips every render once stopped, and with `q` on the next turn the console is not closed under the summary, so neither guard is reached on this console. Both stay as a backstop (`docs/log/2026-11-23-e8-15e-failure-mutants.md`).

## Not checked on this machine

- **VS Code's integrated terminal.** The only VS Code here is the one hosting this session; opening and typing into one of its terminals from outside needs an extension or an automatic task this session cannot approve. VS Code's terminal is xterm.js over ConPTY, the stack the pseudoconsole smokes use (node-pty's ConPTY and xterm.js headless), so what they show is verified only through that pseudoconsole and headless xterm, not in VS Code. Its key handling (ctrl+p and F1 kept by VS Code, `;` and `?` hinted) is held by the unit tests only.
- **macOS Terminal.** Not available: this is a Windows machine.
- **Windows 10's console.** Not available: this machine runs Windows 11. Its console renders with GDI and no font fallback, so the status symbols may show as boxes there; this is why conhost keeps its ASCII status symbols (design 11.7).

## What it changed

- The title bar drops a long log path, then the connection, before it drops the actor.
- Any `TERM_PROGRAM` means a terminal that is not conhost.
- Quitting gives the terminal back as it was (pi-tui otherwise printed the last frame into the scrollback).
- L starts line mode as a child process on the real console, after the first in-process version lost the first line typed on Windows; `screen` in that child hands back to the full screen that started it (review E-8).
- In line mode, a line of only ctrl+Z (Windows' end of input, then Enter) or ctrl+D ends it, which the console delivers as a character (review E-2).
- Observed, not changed: Doctor's checks run in process and keep Node busy, so the busy line of 10.2 did not appear during them (seen in tmux); it appears during calls that wait, as the unit tests show.
