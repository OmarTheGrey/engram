// The TUI's router (card E8.15b, docs/design/tui.md 6.4, 7 and 9): the
// screen stack, the frame every screen shares (title bar, the screen, the
// command line row, the key hints), the overlays, the key table's dispatch
// (./keys.ts), confirmation and the session. It holds no policy logic
// (AGENTS.md rule 1): every action is its plain command's argument vector,
// run through `run` (./runner.ts), asking first where the registry entry's
// `writes` says the command changes state (9.5); what the plane decided is
// shown as the command printed it.
import {
  type Component,
  KeybindingsManager,
  matchesKey,
  type NativeClipboard,
  setKeybindings,
  type Terminal,
  TUI_KEYBINDINGS,
  TuiAltScreen,
} from "@earendil-works/pi-tui";
import { parse } from "../commands.ts";
import { SERVER_URL_ENV } from "../connect.ts";
import type { CheckResult } from "../doctor.ts";
import { type CommandSpec, parseOptions, type Values, type Writes } from "../registry.ts";
import type { Io } from "../run.ts";
import { redactSecrets } from "../setup.ts";
import { commandLine, detectShell, middleCut, type Shell } from "./argv.ts";
import { type Clipboard, createClipboard } from "./clipboard.ts";
import { actionFor } from "./keys.ts";
import { clean, cut, fit, overlay, rows, visibleWidth } from "./layout.ts";
import { checkLogInChild, type LogCheckInput } from "./log-check.ts";
import {
  ConfirmOverlay,
  HelpOverlay,
  PaletteOverlay,
  registerWorkspaceScreen,
} from "./overlays.ts";
import { type RunResult, runCommand } from "./runner.ts";
import { forgetSaved, isPostgres, loadSaved, POSTGRES_NOT_SAVED, writeSaved } from "./saved.ts";
import type { CommandRow, ConfirmRequest, Ctx, Overlay, Ran, Screen } from "./screen.ts";
import { FirstRunScreen } from "./screens/first-run.ts";
import { FormScreen } from "./screens/form.ts";
import { HomeScreen } from "./screens/home.ts";
import { tooSmall, tooSmallLines } from "./screens/too-small.ts";
import { WorkspaceScreen } from "./screens/workspace.ts";
import { colorModeFor, glyphSetFor, makeTheme, paletteFor, type Theme } from "./theme.ts";
import { type CheapChecks, cheapChecks, shortPath, usable, Workspace } from "./workspace.ts";

registerWorkspaceScreen((ctx) => new WorkspaceScreen(ctx));

/** The TUI's own options (docs/design/tui.md 5.1), from flags, the environment and tui.json. */
export interface TuiOptions {
  noColor: boolean;
  highContrast: boolean;
  ascii: boolean;
  reducedMotion: boolean;
  mouse: boolean;
  quiet: boolean;
  noSaved: boolean;
  /** --screen: the screen to open on (home, workspace, first-run or a registry name). */
  screen?: string;
}

export interface StartOptions {
  terminal: Terminal;
  io: Io;
  /** The workspace flags given on the command line, which win over tui.json. */
  given: Values;
  options: TuiOptions;
  platform?: NodeJS.Platform;
  /** The terminal's background, when it answered the colour query. */
  scheme?: "dark" | "light";
  /** The native clipboard, pi-tui's by default. */
  native?: () => NativeClipboard | undefined;
  /** A Postgres log's check, off the input path: a child process by default (./log-check.ts). */
  logCheck?: (input: LogCheckInput) => Promise<CheckResult>;
}

/** What the session leaves for the shell on quit. */
export interface Summary {
  ran: readonly Ran[];
  /** Commands `c` could not copy, printed instead. */
  deferred: readonly string[];
}

/** A read, by its route: read, read --item and scopes run the store's sweep and adoption first. */
const isRead = (spec: CommandSpec) => spec.name.startsWith("read") || spec.name === "scopes";

/** What makes two reads the same workspace for "asked once a session" (9.5). */
const readKey = (f: Values) =>
  JSON.stringify(
    ["server", "db", "store", "root", "owner", "as", "level", "member"].map((k) => f[k] ?? null),
  );

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** Commands whose screens come with card E8.15d: they run until stopped, or read the terminal. */
const NOT_RUN_HERE: Readonly<Record<string, string>> = {
  serve: "engram serve runs until stopped",
  mcp: "engram mcp speaks MCP on this terminal, or serves until stopped",
  hook: "engram hook reads the hook's JSON on stdin",
};

/** The action button of a confirmation, by command. */
const ACTION_WORD: Readonly<Record<string, string>> = {
  write: "Write",
  promote: "Promote",
  grants: "Change grants",
  import: "Import",
  supersede: "Apply",
  "key create": "Create",
  "key revoke": "Revoke",
  "log checkpoint": "Record",
  retain: "Sweep",
  export: "Export",
};

export class App implements Component, Ctx {
  readonly io: Io;
  readonly theme: Theme;
  readonly shell: Shell;
  readonly ws: Workspace;
  checks: CheapChecks;
  readonly ran: Ran[] = [];
  lastDoctor: { code: number; at: string } | undefined;
  savedInUse: boolean;
  readonly noSaved: boolean;
  readonly mouse: boolean;
  readonly clipboard: Clipboard;
  readonly options: TuiOptions;
  readonly terminal: Terminal;
  tui: TuiAltScreen | undefined;

  private stack: Screen[] = [];
  private overlays: Overlay[] = [];
  private message: string | undefined;
  private busy: readonly string[] | undefined;
  private pending: Promise<void> = Promise.resolve();
  private stopped = false;
  /** Reads with a store folder confirmed this session, by workspace (9.5). */
  private readonce = new Set<string>();
  private finish: (s: Summary) => void = () => undefined;
  readonly done: Promise<Summary>;
  /** A problem reading tui.json, said once. */
  private readonly savedProblem: string | undefined;

  constructor(o: StartOptions) {
    this.io = o.io;
    this.terminal = o.terminal;
    this.options = o.options;
    this.noSaved = o.options.noSaved;
    this.mouse = o.options.mouse;
    const platform = o.platform ?? process.platform;
    const choice = {
      noColor: o.options.noColor,
      highContrast: o.options.highContrast,
      ascii: o.options.ascii,
    };
    this.theme = makeTheme(
      paletteFor(choice, o.io.env, o.scheme),
      glyphSetFor(choice, o.io.env, platform),
      colorModeFor(o.io.env),
    );
    this.shell = detectShell(o.io.env);
    const loaded = this.noSaved ? {} : loadSaved(o.io.home);
    this.savedProblem = loaded.problem;
    this.ws = Workspace.from(o.io.env, o.given, loaded.saved?.flags);
    this.logCheck = o.logCheck ?? ((input) => checkLogInChild(input));
    this.checks = cheapChecks(this.ws, o.io, "defer");
    this.startLogCheck();
    this.savedInUse = loaded.saved !== undefined && usable(this.checks);
    this.clipboard = createClipboard({
      env: o.io.env,
      platform,
      write: (data) => this.terminal.write(data),
      ...(o.native ? { native: o.native } : {}),
    });
    this.done = new Promise((resolve) => {
      this.finish = resolve;
    });
    this.stack = this.initialStack(o.options.screen);
    if (this.savedProblem !== undefined) this.message = this.savedProblem;
    else if (this.savedInUse) this.message = "workspace saved: tui.json applied; ctrl+o changes it";
  }

  private initialStack(screen: string | undefined): Screen[] {
    const home = new HomeScreen();
    if (screen === "home") return [home];
    if (screen === "first-run") return [new FirstRunScreen(this)];
    if (screen === "workspace") return [home, new WorkspaceScreen(this)];
    if (screen !== undefined) {
      const spec = home.commands().find((s) => s.name === screen);
      if (spec !== undefined) return [home, new FormScreen(spec, this)];
    }
    return usable(this.checks) ? [home] : [new FirstRunScreen(this)];
  }

  get columns(): number {
    return this.terminal.columns;
  }
  get rows(): number {
    return this.terminal.rows;
  }

  top(): Screen {
    return this.stack.at(-1) as Screen;
  }
  /** The overlay on top, if one is open. */
  overlayOnTop(): Overlay | undefined {
    return this.overlays.at(-1);
  }

  // Ctx.

  push(screen: Screen): void {
    this.stack.push(screen);
  }
  pop(): boolean {
    if (this.stack.length <= 1) return false;
    this.stack.pop();
    return true;
  }
  home(): void {
    this.stack = [new HomeScreen()];
  }
  replace(screen: Screen): void {
    this.stack[this.stack.length - 1] = screen;
  }
  openCommand(spec: CommandSpec, values: Values = {}, positionals: readonly string[] = []): void {
    this.push(new FormScreen(spec, this, values, positionals));
  }
  showOverlay(o: Overlay): void {
    this.overlays.push(o);
  }
  closeOverlay(o?: Overlay): void {
    if (o === undefined) this.overlays.pop();
    else this.overlays = this.overlays.filter((x) => x !== o);
  }
  confirm(request: ConfirmRequest): Promise<boolean> {
    this.parked++;
    return new Promise((resolve) => {
      this.showOverlay(
        new ConfirmOverlay(request, (yes) => {
          this.parked--;
          resolve(yes);
        }),
      );
      this.redraw();
    });
  }
  say(message: string): void {
    this.message = message;
  }
  copy(text: string): void {
    void this.clipboard.copy(text).then((m) => {
      this.message = m;
      this.redraw();
    });
  }
  line(argv: readonly string[]): string {
    return commandLine(argv, this.shell);
  }
  shown(argv: readonly string[]): string {
    return shownLine(argv, this.shell);
  }
  /**
   * The cheap checks again. With `log` false the log's answer is kept (a
   * keystroke in a field); a Postgres log is checked off the input path.
   */
  recheck(log = true): void {
    const before = this.checks.log;
    const pending = this.checks.pendingLog;
    this.checks = cheapChecks(this.ws, this.io, "defer");
    if (!log) {
      this.checks.log = before;
      if (pending) this.checks.pendingLog = true;
      else delete this.checks.pendingLog;
      return;
    }
    this.startLogCheck();
  }

  private readonly logCheck: (input: LogCheckInput) => Promise<CheckResult>;
  /** The newest log check; an older one's answer is dropped. */
  private logGeneration = 0;

  private startLogCheck(): void {
    if (!this.checks.pendingLog) return;
    const generation = ++this.logGeneration;
    void this.logCheck({
      db: this.ws.get("db"),
      cwd: this.io.cwd,
      home: this.io.home,
      env: this.io.env,
    }).then(([status, detail]) => {
      if (generation !== this.logGeneration || this.stopped) return;
      this.checks.log = { status, detail };
      delete this.checks.pendingLog;
      this.redraw();
    });
  }
  save(): void {
    if (this.noSaved) return;
    const db = this.ws.get("db");
    if (db !== undefined && isPostgres(db)) this.say(`Postgres log ${POSTGRES_NOT_SAVED}`);
    writeSaved(this.io.home, this.ws.savable(), {
      ...(this.options.ascii ? { ascii: true } : {}),
      ...(this.options.highContrast ? { contrast: "high" } : {}),
      ...(this.options.reducedMotion ? { motion: "reduce" } : {}),
      ...(this.options.mouse ? {} : { mouse: false }),
    });
    this.savedInUse = true;
  }
  forget(): boolean {
    this.savedInUse = false;
    return forgetSaved(this.io.home);
  }
  quit(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.tui?.stop();
    this.finish({ ran: [...this.ran], deferred: [...this.clipboard.deferred] });
  }
  redraw(): void {
    this.tui?.requestRender();
  }

  /** The confirmation a command needs before it runs, or undefined (9.5). */
  confirmation(
    spec: CommandSpec,
    argv: readonly string[],
    writes: Writes,
  ): ConfirmRequest | undefined {
    const actor = this.ws.actorLabel();
    if (isRead(spec)) {
      if (writes !== "state") return undefined;
      // The folder and the workspace are the ones the command line being run names (finding C1).
      const flags = this.flagsOf(spec, argv);
      if (this.readonce.has(readKey(flags))) return undefined;
      const where =
        flags.root !== undefined
          ? shortPath(String(flags.root), this.io)
          : flags.server !== undefined
            ? `the store of the server at ${hostOf(String(flags.server))}`
            : "the store";
      return {
        // A long path keeps its last part in the title, the whole of it in the text.
        title: `Read with ${where.length > 40 ? `.../${where.split("/").at(-1)}` : where}?`,
        lines: [
          `This read also changes the log, as engram ${spec.name.split(" ")[0]} always does:`,
          `1. as the store's owner, sweeps the owner's retention: any item past its ttl is retired for good, items over budget evicted.`,
          `2. adopts the memories in ${where} into the log as ${flags.as ?? (flags.owner === undefined ? "the actor" : `person:${flags.owner}`)}; the files are not changed.`,
          "3. reads through the plane and explains every item returned. Asked once a session.",
        ],
        argv,
        action: "Read",
      };
    }
    const word = ACTION_WORD[spec.name] ?? "Run";
    const base = { title: `${spec.title}?`, argv, action: word };
    switch (writes) {
      case "state":
        return {
          ...base,
          lines: [
            `Runs engram ${spec.name} as ${actor}: the plane decides it and records the decision as an event.`,
            spec.name === "grants"
              ? "A grant change is undone only by another grant change, itself decided by the plane."
              : "It cannot be undone; a later change is a new version or a new event.",
          ],
        };
      case "retire":
        return {
          ...base,
          lines: [
            `Sweeps the scope's retention as ${actor}: every item past its ttl is retired, budgets enforced.`,
            "Retiring cannot be undone. Retired items stay in the log; reads no longer return them.",
          ],
        };
      case "erase": {
        const typed = argv[2] ?? "erase";
        return {
          ...base,
          lines: ["This cannot be undone: a revoked key is never accepted again."],
          typed,
        };
      }
      case "file": {
        const out = argv[argv.indexOf("--out") + 1] ?? "";
        return {
          ...base,
          lines: [`Writes the bundle to ${out}.`, "If the file exists it is overwritten."],
        };
      }
      default:
        return undefined;
    }
  }

  async act(
    spec: CommandSpec,
    argv: readonly string[],
    values: Values,
  ): Promise<RunResult | undefined> {
    const word = argv[0] as string;
    const why = NOT_RUN_HERE[word];
    if (why !== undefined) {
      this.say(`${why}: its screen comes with card E8.15d; c copies the command to run in a shell`);
      return undefined;
    }
    // What the command changes, judged from the command line being run, as run will parse it.
    const flags = this.flagsOf(spec, argv, values);
    const writes = spec.writes(flags, {});
    const ask = this.confirmation(spec, argv, writes);
    if (ask !== undefined) {
      if (!(await this.confirm(ask))) {
        this.say("cancelled: nothing ran");
        return undefined;
      }
      if (isRead(spec)) this.readonce.add(readKey(flags));
    }
    return this.runNow(argv);
  }

  /**
   * The flags of the command line being run, parsed by the CLI's own parse,
   * with the server ENGRAM_SERVER_URL names when no --server is given;
   * `fallback` when the line does not parse (run then reports why).
   */
  flagsOf(spec: CommandSpec, argv: readonly string[], fallback: Values = {}): Values {
    let values: Values;
    try {
      values = parse(argv.slice(1), parseOptions(spec), spec.allowPositionals).values as Values;
    } catch {
      values = fallback;
    }
    const server = values.server ?? (this.io.env[SERVER_URL_ENV] || undefined);
    return server === undefined ? values : { ...values, server };
  }

  async runNow(argv: readonly string[]): Promise<RunResult> {
    this.busy = argv;
    this.redraw();
    try {
      const result = await runCommand(argv, this.io);
      this.ran.push({ argv: [...argv], code: result.code });
      if (argv[0] === "doctor") this.lastDoctor = { code: result.code, at: this.io.now() };
      this.recheck();
      return result;
    } finally {
      this.busy = undefined;
    }
  }

  // Input.

  /** Keys in flight on the main chain, and on the side chain that runs while a confirmation waits. */
  private mainActive = 0;
  private sideActive = 0;
  private side: Promise<void> = Promise.resolve();
  /** Confirmations waiting for a key: the main chain is parked on them. */
  private parked = 0;

  handleInput(data: string): void {
    // ctrl+c quits now, ahead of any key or call still being handled (9.1).
    if (matchesKey(data, "ctrl+c")) {
      // After pi-tui has finished with this input, not inside its handler.
      setImmediate(() => this.quit());
      return;
    }
    // While a confirmation waits, the action that asked is parked on the main
    // chain; the keys that answer it go on a side chain, or nothing could answer.
    const onSide = this.parked > 0;
    const run = () =>
      this.dispatch(data)
        .catch((e: unknown) => {
          this.message = `internal error: ${e instanceof Error ? e.message : String(e)}`;
        })
        .then(() => this.redraw());
    if (onSide) {
      this.sideActive++;
      this.side = this.side.then(run).finally(() => {
        this.sideActive--;
      });
    } else {
      this.mainActive++;
      this.pending = this.pending.then(run).finally(() => {
        this.mainActive--;
      });
    }
  }

  /**
   * Resolves once every key sent so far has been handled, or is parked on a
   * confirmation that waits for the next key.
   */
  async settled(): Promise<void> {
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setImmediate(r));
      if (this.sideActive > 0) continue;
      if (this.mainActive === 0 || this.parked > 0) return;
    }
    throw new Error("the TUI did not settle");
  }

  private async dispatch(data: string): Promise<void> {
    if (this.stopped) return;
    this.message = undefined;
    if (tooSmall(this.columns, this.rows)) {
      const a = actionFor(data, "too-small", false);
      if (a === "quit" || a === "quit-now") this.quit();
      else if (a === "redraw") this.tui?.requestRender(true);
      return;
    }
    const top = this.overlays.at(-1);
    if (top !== undefined) {
      const a = actionFor(data, top.kind, top.inField());
      if (a === "quit-now") return this.quit();
      if (a !== undefined && (await top.action(a, this))) return;
      top.raw(data, this);
      return;
    }
    const screen = this.top();
    const a = actionFor(data, screen.kind, screen.inField());
    switch (a) {
      case "quit-now":
      case "quit":
        return this.quit();
      case "help":
        return this.showOverlay(new HelpOverlay(screen));
      case "palette":
        return this.showOverlay(new PaletteOverlay());
      case "workspace":
        if (screen.kind !== "workspace") this.push(new WorkspaceScreen(this));
        return;
      case "redraw":
        this.tui?.requestRender(true);
        return;
      case "copy": {
        const text = this.copyText(this.top().command(this));
        if (text === "") this.say("no command to copy on this screen");
        else this.copy(text);
        return;
      }
      case "line":
        this.say("line mode comes with card E8.15e; engram --help lists the plain commands");
        return;
      case "back":
        if (screen.kind === "form") await screen.action("leave", this);
        else if (!(await screen.action("back", this))) this.pop();
        return;
    }
    if (a !== undefined && (await screen.action(a, this))) return;
    screen.raw(data, this);
  }

  // Drawing.

  invalidate(): void {}

  /** The command row's text as drawn, secrets redacted. */
  private commandText(row: CommandRow): string {
    if (row.argv !== undefined) return this.shown(row.argv);
    return clean(row.text ?? "");
  }

  /** What `c` copies: the whole command, secrets included, as the person would type it. */
  private copyText(row: CommandRow): string {
    if (row.argv !== undefined) return this.line(row.argv);
    return row.text ?? "";
  }

  private titleBar(width: number): string {
    const wide = width >= 120;
    const left = ` engram  ${this.top().title(this)}`;
    const log =
      wide && this.ws.server() === undefined && this.checks.logLabel
        ? `  log ${this.checks.logLabel}`
        : "";
    const right = `${this.ws.connectionLabel()}${log}  ${this.ws.actorLabel()} `;
    const gap = width - visibleWidth(left) - visibleWidth(right);
    const text = gap >= 2 ? `${left}${" ".repeat(gap)}${right}` : left;
    return this.theme.reverse(fit(text, width));
  }

  private commandRow(width: number): string {
    if (this.busy !== undefined) return middleCut(`$ ${this.shown(this.busy)}   working`, width);
    const row = this.top().command(this);
    const text = this.commandText(row);
    if (text === "") return row.note === undefined ? "" : cut(`$ ${row.note}`, width);
    const tail = [
      row.exit === undefined ? "" : `   exit ${row.exit}`,
      row.note === undefined ? "" : `  ${row.note}`,
    ].join("");
    const room = Math.max(10, width - 2 - visibleWidth(tail));
    return fit(`$ ${middleCut(text, room)}${tail}`, width);
  }

  private hintsRow(width: number): string {
    if (this.message !== undefined) return cut(` ${this.message}`, width);
    const screen = this.top();
    const own = screen.hints(this);
    const back = screen.kind === "loop" ? "esc Home" : "esc back";
    // In a text field only keys that type nothing act: name those (review I7, I9).
    if (screen.inField())
      return cut(` ${own}  alt+c copy  alt+p commands  ctrl+g help  ${back}`, width);
    const end = screen.kind === "home" || screen.kind === "first-run" ? "q quit" : back;
    return cut(` ${own}  ? help  ; commands  ${end}`, width);
  }

  render(width: number): string[] {
    const height = this.rows;
    if (tooSmall(width, height)) {
      const row = this.top().command(this);
      return tooSmallLines(width, height, this.commandText(row) || "engram --help").map((l) =>
        fit(l, width),
      );
    }
    const body = rows(this.top().render(this, width, height - 3), height - 3, width);
    let frame = [this.titleBar(width), ...body, this.commandRow(width), this.hintsRow(width)];
    for (const o of this.overlays) {
      const w = Math.max(20, o.width(width));
      const lines = o.render(this, w, height - 4);
      const row = Math.max(1, Math.floor((height - lines.length) / 2));
      const col = Math.max(0, Math.floor((width - w) / 2));
      frame = overlay(frame, lines, row, col, w, width);
    }
    return frame.slice(0, height);
  }
}

export interface Session {
  app: App;
  tui: TuiAltScreen;
}

/** Starts the TUI on a terminal: the alternate screen, the mouse unless --no-mouse. */
/**
 * pi-tui's alternate screen scrolls its own viewport on pgup, pgdn and the
 * rest; the TUI draws exactly one screen, so those keys belong to its
 * screens (review finding I3). The editing and list bindings stay pi-tui's.
 */
function keepScrollKeys(): void {
  const none = Object.fromEntries(
    Object.keys(TUI_KEYBINDINGS)
      .filter((k) => k.startsWith("tui.altScreen."))
      .map((k) => [k, []]),
  );
  setKeybindings(new KeybindingsManager(TUI_KEYBINDINGS, none));
}

export function startTui(o: StartOptions): Session {
  keepScrollKeys();
  const app = new App(o);
  const tui = new TuiAltScreen(o.terminal, false, undefined, {
    mouse: o.options.mouse,
    copySelection: async (text) => {
      const m = await app.clipboard.copy(text);
      app.say(m);
      return true;
    },
  });
  app.tui = tui;
  tui.addChild(app);
  tui.setFocus(app);
  tui.start();
  o.io.stop?.addEventListener("abort", () => app.quit(), { once: true });
  return { app, tui };
}

/**
 * A command line as the TUI draws or prints it (review finding I4): every
 * URL in it redacted as the CLI redacts a log's label (its userinfo and
 * secret query values), and no control character. `c` copies it whole.
 */
export function shownLine(argv: readonly string[], shell: Shell): string {
  let text = commandLine(argv, shell);
  for (const word of argv) if (word.includes("://")) text = redactSecrets(text, word);
  return clean(text);
}

/** What quitting prints (docs/design/tui.md 4.1): the session's commands, each with its exit code. */
export function summaryText(summary: Summary, shell: Shell, quiet: boolean): string {
  const lines: string[] = [];
  if (!quiet && summary.ran.length > 0) {
    lines.push("# engram tui: the commands this session ran");
    for (const r of summary.ran) lines.push(`${shownLine(r.argv, shell)}  # exit ${r.code}`);
  }
  if (summary.deferred.length > 0) {
    lines.push("# engram tui: what c could not copy (this terminal has no clipboard path)");
    // Printed, so redacted like every printed command; the secret stays the person's to type.
    for (const d of summary.deferred) {
      let text = d;
      for (const url of d.match(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi) ?? [])
        text = redactSecrets(text, url);
      lines.push(clean(text));
    }
  }
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
