// `engram tui` (card E8.15b, docs/design/tui.md 5): its flags, the refusals
// of 5.2, the options from flags, the environment and tui.json, the start on
// the terminal and, on quit, the session's commands printed to stdout. The
// TUI never starts, and writes not one escape sequence, when stdout or stdin
// is not a terminal, CI is set, TERM is dumb or --json is on the line: it
// prints one line to stderr and exits 2. A bad flag is the CLI's usage
// error, with its "did you mean" line, through `run`.
import { parse } from "../commands.ts";
import { closest, OPTIONS } from "../registry.ts";
import type { Io } from "../run.ts";
import { UsageError } from "../setup.ts";
import { startTui, summaryText, type TuiOptions } from "./app.ts";
import { detectShell } from "./argv.ts";
import { offered } from "./overlays.ts";
import { loadSaved } from "./saved.ts";
import { processTerminal, type Terminal } from "./term.ts";

export interface TuiDeps {
  /** The terminal to draw on; the process's console when absent. */
  terminal?: Terminal;
  platform?: NodeJS.Platform;
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

/** The line a refusal prints, or undefined when the TUI may start (5.2). */
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
  if (line) return `line mode comes with card E8.15e; ${PLAIN}`;
  if (io.env.TERM === "dumb") return "TERM is dumb; try engram tui --line, or the plain commands";
  return undefined;
}

export async function tuiCommand(args: string[], io: Io, deps: TuiDeps = {}): Promise<number> {
  const { values } = parse(args, OPTIONS.tui, false);
  const env = io.env;
  const saved = values["no-saved"] === true ? undefined : loadSaved(io.home).saved?.options;
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
  const options: TuiOptions = {
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
    ...(values.screen === undefined ? {} : { screen: values.screen }),
  };
  const given = Object.fromEntries(
    Object.entries(values).filter(([k]) => !Object.hasOwn(TUI_OWN, k)),
  );
  const terminal = deps.terminal ?? processTerminal();
  const { app } = startTui({
    terminal,
    io,
    given,
    options,
    ...(deps.platform ? { platform: deps.platform } : {}),
  });
  const summary = await app.done;
  if (deps.terminal === undefined) (io.stdin as { pause?: () => void } | undefined)?.pause?.();
  const text = summaryText(summary, detectShell(env), options.quiet);
  // A console closed under the quit must not turn it into a crash (review E8.15d-2): the
  // summary is written when the console takes it, and a write error is not uncaught.
  (io.stdout as { on?: (e: string, f: () => void) => void } | undefined)?.on?.("error", () => {});
  try {
    if (text !== "") io.out(text);
  } catch {
    // The console is gone; the session's commands are in the log.
  }
  return 0;
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
