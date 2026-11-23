// `engram tui` (card E8.15b, docs/design/tui.md 5): its flags, the refusals
// of 5.2, the options from flags, the environment and tui.json, the start on
// the terminal and, on quit, the session's commands printed to stdout. The
// TUI never starts, and writes not one escape sequence, when stdout or stdin
// is not a terminal, CI is set, TERM is dumb or --json is on the line: it
// prints one line to stderr and exits 2. A bad flag is the CLI's usage
// error, with its "did you mean" line, through `run`.
//
// Card E8.15e: line mode (./line.ts) starts instead with --line,
// ENGRAM_TUI_LINE=1 or tui.json's line option, and where TERM is dumb; L on
// Home and first run switches to it, and its `screen` back, each keeping the
// workspace. line.ts itself imports no pi-tui; this file loads the full
// screen's modules with it, as before, and line mode never calls them.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse } from "../commands.ts";
import { closest, OPTIONS, type Values } from "../registry.ts";
import type { Io } from "../run.ts";
import { UsageError } from "../setup.ts";
import { startTui, type TuiOptions } from "./app.ts";
import { offered } from "./asks.ts";
import { lineMode } from "./line.ts";
import { loadSaved, type SavedOptions } from "./saved.ts";
import type { Ran } from "./screen.ts";
import type { Launch } from "./snippets.ts";
import { processTerminal, type Terminal } from "./term.ts";
import { detectShell, summaryText } from "./words.ts";

export interface TuiDeps {
  /** The terminal to draw on; the process's console when absent. */
  terminal?: Terminal;
  platform?: NodeJS.Platform;
  /** Line mode: told of each line read, a test's stand-in for the terminal's echo. */
  echo?: (line: string) => void;
  /** Line mode's mcp and hook setup: the command the snippets name, in place of the PATH's. */
  launch?: Launch;
}

const PLAIN = "run the plain commands (engram --help lists them)";

/** The screens --screen opens: Home, the workspace, first run, and every command's form. */
export const screenNames = () => [
  "home",
  "workspace",
  "first-run",
  ...offered().map((s) => s.name),
];

const isTty = (s: unknown) => (s as { isTTY?: boolean } | undefined)?.isTTY === true;

/**
 * The line a refusal prints, or undefined when the TUI may start (5.2). Line
 * mode keeps every refusal but TERM=dumb: it draws nothing a dumb terminal
 * cannot show, which is why the dumb refusal suggests it.
 */
export function refusal(
  io: Io,
  values: { json?: boolean | undefined },
  line: boolean,
): string | undefined {
  const winpty =
    io.env.MSYSTEM && !isTty(io.stdin) ? "; under Git Bash, try winpty engram tui" : "";
  if (values.json === true) return "--json is for scripts; run the plain command with --json";
  if (!isTty(io.stdout)) return `stdout is not a terminal; ${PLAIN}${winpty}`;
  if (!isTty(io.stdin)) return `stdin is not a terminal; ${PLAIN}${winpty}`;
  if (io.env.CI) return `CI is set; ${PLAIN}`;
  if (!line && io.env.TERM === "dumb")
    return "TERM is dumb; try engram tui --line, or the plain commands";
  return undefined;
}

export async function tuiCommand(args: string[], io: Io, deps: TuiDeps = {}): Promise<number> {
  const { values } = parse(args, OPTIONS.tui, false);
  const env = io.env;
  const loaded = values["no-saved"] === true ? {} : loadSaved(io.home);
  const saved = loaded.saved?.options;
  const line = values.line === true || env.ENGRAM_TUI_LINE === "1" || saved?.line === true;
  const refused = refusal(io, values, line);
  if (refused !== undefined) throw new UsageError(refused);
  if (values.screen !== undefined && !screenNames().includes(values.screen)) {
    io.err(
      `engram tui: --screen ${values.screen} is not a screen: home, workspace, first-run or a command's name\n`,
    );
    const near = closest(values.screen, screenNames());
    if (near !== undefined) io.err(`engram tui: did you mean --screen ${near}?\n`);
    return 2;
  }
  const options = tuiOptions(values, env, saved);
  let given: Values = Object.fromEntries(
    Object.entries(values).filter(([k]) => !Object.hasOwn(TUI_OWN, k)),
  );
  const ran: Ran[] = [];
  const deferred: string[] = [];
  // After a switch from line mode the full screen opens on Home, not on --screen's screen.
  const { screen: _screen, ...again } = options;
  // The first mode reads tui.json's flags; a switch hands the workspace on whole.
  let first = true;
  let mode: "line" | "screen" = line ? "line" : "screen";
  for (;;) {
    if (mode === "line") {
      const end = await lineMode(
        io,
        {
          given,
          saved: first ? loaded.saved?.flags : undefined,
          noSaved: options.noSaved,
        },
        {
          ...(deps.echo ? { echo: deps.echo } : {}),
          ...(deps.launch ? { launch: deps.launch } : {}),
          ...(deps.platform ? { platform: deps.platform } : {}),
          screenRefusal: () => refusal(io, values, false),
        },
      );
      ran.push(...end.ran);
      if (!end.screen) break;
      given = end.given;
    } else {
      const terminal = deps.terminal ?? processTerminal();
      const { app } = startTui({
        terminal,
        io,
        given,
        options: first ? options : again,
        ...(deps.platform ? { platform: deps.platform } : {}),
        ...(first ? {} : { skipSavedFlags: true }),
      });
      const summary = await app.done;
      if (deps.terminal === undefined) (io.stdin as { pause?: () => void } | undefined)?.pause?.();
      ran.push(...summary.ran);
      deferred.push(...summary.deferred);
      if (summary.line !== true) break;
      given = app.ws.savable();
      if (deps.terminal === undefined) {
        // On the real console L starts line mode as a child process on the same terminal: in
        // this one, stdin read again after raw mode loses the first line typed and keeps the
        // process alive at the end on Windows (libuv; failure entry of card E8.15e). This
        // process prints the full screen's commands now; line mode prints its own as it ends.
        print(io, summaryText({ ran, deferred }, detectShell(env), options.quiet));
        return lineInChild(io, given, options);
      }
    }
    first = false;
    mode = mode === "line" ? "screen" : "line";
  }
  print(io, summaryText({ ran, deferred }, detectShell(env), options.quiet));
  return 0;
}

/** Writes what quitting prints, guarded. */
function print(io: Io, text: string): void {
  // A console closed under the quit must not turn it into a crash (review E8.15d-2): the
  // summary is written when the console takes it, and a write error is not uncaught.
  (io.stdout as { on?: (e: string, f: () => void) => void } | undefined)?.on?.("error", () => {});
  try {
    if (text !== "") io.out(text);
  } catch {
    // The console is gone; the session's commands are in the log.
  }
}

/** The workspace's flags as command-line words. */
export function flagWords(flags: Values): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(flags)) {
    if (typeof v === "string") out.push(`--${k}`, v);
    else if (Array.isArray(v)) for (const one of v) out.push(`--${k}`, one);
  }
  return out;
}

/**
 * `engram tui --line` with the workspace's flags, a child of this process on
 * the same terminal (L on the real console); its exit code is this one's.
 */
async function lineInChild(io: Io, given: Values, options: TuiOptions): Promise<number> {
  const args = [
    MAIN,
    "tui",
    "--line",
    ...(options.quiet ? ["--quiet"] : []),
    ...(options.noSaved ? ["--no-saved"] : []),
    ...flagWords(given),
  ];
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(io.env)) if (v !== undefined) env[k] = v;
  const child = spawn(process.execPath, args, { stdio: "inherit", cwd: io.cwd, env });
  return new Promise((resolve) => {
    child.on("error", (e) => {
      io.err(`engram tui: line mode did not start (${e.message}); run engram tui --line\n`);
      resolve(1);
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

/** This CLI's entry, which line mode's child runs. */
const MAIN = fileURLToPath(new URL("../main.ts", import.meta.url));

/**
 * The TUI's own options (docs/design/tui.md 5.1 and 11): a flag, else its
 * environment variable, else tui.json's saved option.
 */
export function tuiOptions(
  values: Values,
  env: Readonly<Record<string, string | undefined>>,
  saved: SavedOptions | undefined,
): TuiOptions {
  return {
    noColor: values["no-color"] === true || Boolean(env.NO_COLOR),
    highContrast:
      values["high-contrast"] === true ||
      env.ENGRAM_TUI_CONTRAST === "high" ||
      saved?.contrast === "high",
    ascii: values.ascii === true || env.ENGRAM_TUI_ASCII === "1" || saved?.ascii === true,
    reducedMotion:
      values["reduced-motion"] === true ||
      env.ENGRAM_TUI_MOTION === "reduce" ||
      saved?.motion === "reduce",
    mouse: !(values["no-mouse"] === true || env.ENGRAM_TUI_MOUSE === "0" || saved?.mouse === false),
    quiet: values.quiet === true,
    noSaved: values["no-saved"] === true,
    ...(typeof values.screen === "string" ? { screen: values.screen } : {}),
  };
}

/** The TUI's own flags, which are not the workspace's. */
const TUI_OWN = {
  line: 1,
  "no-color": 1,
  "high-contrast": 1,
  ascii: 1,
  "reduced-motion": 1,
  "no-mouse": 1,
  quiet: 1,
  "no-saved": 1,
  screen: 1,
  json: 1,
};
