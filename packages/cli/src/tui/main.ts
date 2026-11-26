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
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parse } from "../commands.ts";
import { closest, OPTIONS, type Values } from "../registry.ts";
import type { Io } from "../run.ts";
import { UsageError } from "../setup.ts";
import { type App, startTui, type TuiOptions } from "./app.ts";
import { offered } from "./asks.ts";
import { lineMode, type SessionHandoff } from "./line.ts";
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
  /** Told of the App each time the full screen starts (tests: a reviewer handoff, review E-1). */
  onApp?: (app: App) => void;
  /**
   * A line-mode child of L: hands its workspace and commands back to the
   * parent when screen is typed (review E-8). Tests only; a real child uses
   * the IPC channel, and only once its parent has answered its token.
   */
  handBack?: (back: HandBack) => void | Promise<void>;
  /** The IPC channel to a parent, process's own when absent (tests play the parent, verification R-3). */
  ipc?: Ipc;
}

/** What a line-mode child of L hands back to the full screen that started it. */
export interface HandBack {
  given: Values;
  ran: Ran[];
  /** The reviewer handoff still on, carried apart from the flags (verification R-1). */
  handoff?: SessionHandoff;
}

/** An IPC channel to a parent process. */
export interface Ipc {
  send(message: unknown, done?: () => void): void;
  on(event: "message", listener: (message: unknown) => void): void;
  disconnect?(): void;
}

/**
 * Set by L in its line-mode child's environment: a random token the child
 * says hello with, which only the parent that started it answers (verification
 * R-3); the reviewer handoff rides beside it. Both are removed from the
 * environment the commands and Try it's children see.
 */
const HANDBACK_ENV = "ENGRAM_TUI_HANDBACK";
const HANDOFF_ENV = "ENGRAM_TUI_HANDOFF";

/** The process's own IPC channel, when it has one. */
function processIpc(): Ipc | undefined {
  if (typeof process.send !== "function") return undefined;
  return {
    send: (m, done) => {
      process.send?.(m as never, undefined, {}, () => done?.());
    },
    on: (e, f) => {
      process.on(e, f);
    },
    disconnect: () => {
      if (process.connected) process.disconnect();
    },
  };
}

/** The handoff a parent put in the environment, checked for its shape. */
function handoffOf(text: string | undefined): SessionHandoff | undefined {
  if (text === undefined) return undefined;
  try {
    const o = JSON.parse(text) as Partial<SessionHandoff>;
    if (
      typeof o.reviewer === "string" &&
      typeof o.target === "string" &&
      Array.isArray(o.members) &&
      o.members.every((m) => typeof m === "string")
    )
      return { reviewer: o.reviewer, target: o.target, members: [...o.members] };
  } catch {
    // Not one: no handoff.
  }
  return undefined;
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

export async function tuiCommand(args: string[], given0: Io, deps: TuiDeps = {}): Promise<number> {
  // L's token and handoff are this process's own; no command or child sees them (R-3).
  const token = given0.env[HANDBACK_ENV] || undefined;
  let handoff = token === undefined ? undefined : handoffOf(given0.env[HANDOFF_ENV]);
  const { [HANDBACK_ENV]: _token, [HANDOFF_ENV]: _handoff, ...cleanEnv } = given0.env;
  const io: Io = { ...given0, env: cleanEnv };
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
  // A child of L says hello with its token; only the parent that set it answers (R-3).
  const ipc = token === undefined ? undefined : (deps.ipc ?? processIpc());
  let answered = false;
  let onAnswer: () => void = () => undefined;
  const answer = new Promise<void>((resolve) => {
    onAnswer = resolve;
  });
  if (token !== undefined && ipc !== undefined) {
    ipc.on("message", (m) => {
      if ((m as { engramTuiAck?: unknown } | null)?.engramTuiAck !== token) return;
      answered = true;
      onAnswer();
    });
    ipc.send({ engramTuiHello: token });
  }
  /** Whether the parent has answered, waiting up to two seconds for an answer on its way. */
  const parentAnswered = async (): Promise<boolean> => {
    if (answered || ipc === undefined) return answered;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      answer,
      new Promise<void>((r) => {
        timer = setTimeout(r, 2_000);
        timer.unref?.();
      }),
    ]);
    clearTimeout(timer);
    return answered;
  };
  const handBack: ((b: HandBack) => void | Promise<void>) | undefined =
    deps.handBack ??
    (token !== undefined && ipc !== undefined
      ? (b) =>
          new Promise<void>((resolve) => {
            ipc.send({ ...b, token }, resolve);
          })
      : undefined);
  const screenRefusal = async (): Promise<string | undefined> => {
    if (deps.handBack === undefined && token !== undefined && !(await parentAnswered()))
      return "no full screen to return to: this line mode was not started by L";
    const r = refusal(io, values, false);
    return r === undefined ? undefined : `engram tui: ${r}`;
  };
  try {
    for (;;) {
      if (mode === "line") {
        const end = await lineMode(
          io,
          {
            given,
            saved: first ? loaded.saved?.flags : undefined,
            noSaved: options.noSaved,
            ...(handoff ? { handoff } : {}),
          },
          {
            ...(deps.echo ? { echo: deps.echo } : {}),
            ...(deps.launch ? { launch: deps.launch } : {}),
            ...(deps.platform ? { platform: deps.platform } : {}),
            screenRefusal,
          },
        );
        ran.push(...end.ran);
        if (!end.screen) break;
        if (handBack !== undefined) {
          // A child of L: the full screen is the parent's, which prints the session's commands.
          await handBack({
            given: end.given,
            ran: [...ran],
            ...(end.handoff ? { handoff: end.handoff } : {}),
          });
          return 0;
        }
        given = end.given;
        handoff = end.handoff;
      } else {
        const terminal = deps.terminal ?? processTerminal();
        const { app } = startTui({
          terminal,
          io,
          given,
          options: first ? options : again,
          ...(deps.platform ? { platform: deps.platform } : {}),
          ...(first ? {} : { skipSavedFlags: true }),
          ...(handoff ? { handoff } : {}),
        });
        deps.onApp?.(app);
        const summary = await app.done;
        if (deps.terminal === undefined)
          (io.stdin as { pause?: () => void } | undefined)?.pause?.();
        ran.push(...summary.ran);
        deferred.push(...summary.deferred);
        if (summary.line !== true) break;
        // The workspace's own flags, and a reviewer handoff apart from them: a session value
        // is never given, listed as given or saved (8.8; verification R-1 of review E-1's fix).
        given = app.ws.savable();
        handoff =
          app.handoff === undefined
            ? undefined
            : {
                reviewer: app.handoff.reviewer,
                members: [...app.handoff.members],
                target: app.handoff.target,
              };
        if (deps.terminal === undefined) {
          // On the real console L starts line mode as a child process on the same terminal: in
          // this one, stdin read again after raw mode loses the first line typed and keeps the
          // process alive at the end on Windows (libuv; failure entry of card E8.15e). This
          // process prints the full screen's commands now; line mode prints its own as it ends,
          // or hands them back here when screen is typed (review E-8).
          print(io, summaryText({ ran, deferred }, detectShell(env), options.quiet));
          ran.length = 0;
          deferred.length = 0;
          const child = await lineInChild(io, given, handoff, options);
          if (child.back === undefined) return child.code;
          ran.push(...child.back.ran);
          given = child.back.given;
          handoff = child.back.handoff;
          first = false;
          continue;
        }
      }
      first = false;
      mode = mode === "line" ? "screen" : "line";
    }
  } finally {
    // A child of L lets its parent's channel go, or it would never exit.
    if (deps.handBack === undefined && ipc !== undefined) ipc.disconnect?.();
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

/** The arguments of L's line-mode child: this CLI, tui --line, the TUI's options that carry over, the workspace. */
export function childArgs(given: Values, options: Pick<TuiOptions, "quiet" | "noSaved">): string[] {
  return [
    MAIN,
    "tui",
    "--line",
    ...(options.quiet ? ["--quiet"] : []),
    ...(options.noSaved ? ["--no-saved"] : []),
    ...flagWords(given),
  ];
}

/** A hand-back as it arrives over IPC with this session's token, checked for its shape. */
export function asHandBack(m: unknown, token: string): HandBack | undefined {
  const o = m as { given?: unknown; ran?: unknown; token?: unknown; handoff?: unknown } | null;
  if (o === null || typeof o !== "object" || o.token !== token) return undefined;
  if (typeof o.given !== "object" || o.given === null || !Array.isArray(o.ran)) return undefined;
  const handoff = handoffOf(o.handoff === undefined ? undefined : JSON.stringify(o.handoff));
  return { given: o.given as Values, ran: o.ran as Ran[], ...(handoff ? { handoff } : {}) };
}

/** The environment of L's line-mode child: this one's, with its token and the handoff, if one is on. */
export function childEnv(
  env: Readonly<Record<string, string | undefined>>,
  token: string,
  handoff: SessionHandoff | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) out[k] = v;
  out[HANDBACK_ENV] = token;
  if (handoff !== undefined) out[HANDOFF_ENV] = JSON.stringify(handoff);
  else delete out[HANDOFF_ENV];
  return out;
}

/**
 * `engram tui --line` with the workspace's flags, a child of this process on
 * the same terminal (L on the real console): its exit code, and what it
 * handed back when screen was typed there. It answers the child's hello, and
 * takes a hand-back only with the token it gave (verification R-3).
 */
async function lineInChild(
  io: Io,
  given: Values,
  handoff: SessionHandoff | undefined,
  options: TuiOptions,
): Promise<{ code: number; back?: HandBack }> {
  const token = randomBytes(16).toString("hex");
  const child = spawn(process.execPath, childArgs(given, options), {
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    cwd: io.cwd,
    env: childEnv(io.env, token, handoff),
  });
  let back: HandBack | undefined;
  child.on("message", (m) => {
    if ((m as { engramTuiHello?: unknown } | null)?.engramTuiHello === token)
      child.send({ engramTuiAck: token });
    else back = asHandBack(m, token) ?? back;
  });
  return new Promise((resolve) => {
    child.on("error", (e) => {
      io.err(`engram tui: line mode did not start (${e.message}); run engram tui --line\n`);
      resolve({ code: 1 });
    });
    child.on("exit", (code) => resolve({ code: code ?? 1, ...(back ? { back } : {}) }));
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
