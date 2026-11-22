// Serve (card E8.15d, docs/design/tui.md 8.13), built for card E8.12: the
// screen starts with "Who may call this server?" and three answers, API
// keys from a key file the default with "Create a key" one press away, a
// token issuer, and the waiver in words, "No authentication: this machine
// only". Start runs `engram serve` through the CLI's own `run`, in the TUI's
// process, with an Io.stop the screen holds; its start line, which names how
// it authenticates, is shown as printed. A refusal is the CLI's message,
// verbatim, with the answer it names focused. `s` stops it; quitting the
// TUI stops it first and says so. The helpers here serve MCP's HTTP
// transport too.
import { isAbsolute, resolve } from "node:path";
import { parse } from "../../commands.ts";
import { type CommandSpec, parseOptions, type Values } from "../../registry.ts";
import { type Io, run } from "../../run.ts";
import { clean, para } from "../layout.ts";
import type { Ctx } from "../screen.ts";
import { exists } from "../snippets.ts";
import { KeyCreateScreen } from "./data.ts";
import { BIND_FLAGS } from "./machine.ts";
import { type Row, SurfaceScreen, sharedOf } from "./surface.ts";

/** The three answers to "Who may call this server?". */
export type Auth = "keys" | "issuer" | "none";

/** The credential flags of each answer; the others are left off the command line. */
const AUTH_FLAGS: Record<Auth, readonly string[]> = {
  keys: ["keys"],
  issuer: ["issuer", "jwks", "subjects", "audience", "resource"],
  none: ["insecure-loopback"],
};
const ALL_AUTH = [
  "keys",
  "issuer",
  "jwks",
  "subjects",
  "audience",
  "resource",
  "insecure-loopback",
];

export const AUTH_OPTIONS = [
  { value: "keys", label: "API keys from a key file" },
  { value: "issuer", label: "a token issuer: --issuer, --jwks, --subjects" },
  {
    value: "none",
    label:
      "No authentication: this machine only, anyone on it can act as anyone (--insecure-loopback)",
  },
] as const;

/** The flags an answer leaves off the command line. */
export const hiddenBy = (auth: Auth): string[] =>
  ALL_AUTH.filter((f) => !AUTH_FLAGS[auth].includes(f));

/** The answer a form's values hold: the waiver, an issuer, else keys (the default). */
export function authOf(values: Values): Auth {
  if (values["insecure-loopback"] === true) return "none";
  if (values.issuer !== undefined || values.jwks !== undefined || values.subjects !== undefined)
    return "issuer";
  return "keys";
}

/** A command run until stopped, in the TUI's process, through the CLI's own `run`. */
export class Running {
  out = "";
  err = "";
  /** The exit code, once it returned. */
  code: number | undefined;
  readonly argv: readonly string[];
  readonly done: Promise<number>;
  private readonly stop = new AbortController();

  constructor(argv: readonly string[], io: Io, changed: () => void) {
    this.argv = [...argv];
    // Standard input and output are never handed on: nothing it runs reads or writes the terminal.
    const { stdin: _stdin, stdout: _stdout, ...rest } = io;
    this.done = run([...argv], {
      ...rest,
      stop: this.stop.signal,
      out: (s) => {
        this.out += s;
        changed();
      },
      err: (s) => {
        this.err += s;
        changed();
      },
    }).then((code) => {
      this.code = code;
      changed();
      return code;
    });
  }

  /** The server's address from its start line, when it printed one. */
  url(): string | undefined {
    return /listening on (\S+)/.exec(this.out)?.[1] ?? /HTTP on (\S+)/.exec(this.err)?.[1];
  }

  /** Stops it and waits for its exit code. */
  halt(): Promise<number> {
    this.stop.abort();
    return this.done;
  }
}

/**
 * A server the session runs, by command name: it outlives the screen that
 * started it, so a screen opened again attaches to it and offers Stop
 * (review E8.15d-3), and quitting stops it once, recorded once.
 */
interface Process {
  running: Running | undefined;
  /** The last run that ended, with what it printed. */
  ended: Running | undefined;
  /** Set while the TUI quits: the run's record says it was stopped by the quit. */
  quitting: boolean;
  unregister: (() => void) | undefined;
}
const processes = new WeakMap<object, Map<string, Process>>();
function processOf(ctx: Ctx, name: string): Process {
  let byName = processes.get(ctx);
  if (byName === undefined) {
    byName = new Map();
    processes.set(ctx, byName);
  }
  let p = byName.get(name);
  if (p === undefined) {
    p = { running: undefined, ended: undefined, quitting: false, unregister: undefined };
    byName.set(name, p);
  }
  return p;
}

/** A run ended: recorded once, with the note when quitting stopped it. */
function finish(ctx: Ctx, proc: Process, r: Running, code: number): void {
  proc.unregister?.();
  proc.unregister = undefined;
  proc.running = undefined;
  proc.ended = r;
  ctx.record({
    argv: r.argv,
    code,
    ...(proc.quitting ? { note: "stopped when the TUI quit" } : {}),
  });
}

/** Whether the session runs the command's server now (a screen opened again attaches to it). */
export const runsNow = (ctx: Ctx, name: string) => processOf(ctx, name).running !== undefined;

/** A screen with the three answers and a command it runs until stopped: Serve, and MCP over HTTP. */
export abstract class ProcessScreen extends SurfaceScreen {
  auth: Auth;
  private readonly proc: Process;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    const proc = processOf(ctx, spec.name);
    // Opened again while it runs: the form shows the command that is running.
    const given =
      proc.running !== undefined && Object.keys(values).length === 0
        ? (parse(proc.running.argv.slice(1), parseOptions(spec), spec.allowPositionals)
            .values as Values)
        : values;
    super(spec, ctx, given, positionals);
    this.proc = proc;
    this.auth = authOf(this.form.flagValues());
  }

  /** The server this session runs for the command, whichever screen started it. */
  get running(): Running | undefined {
    return this.proc.running;
  }
  set running(r: Running | undefined) {
    this.proc.running = r;
  }
  get ended(): Running | undefined {
    return this.proc.ended;
  }
  set ended(r: Running | undefined) {
    this.proc.ended = r;
  }

  protected authRows(): Row[] {
    const rows: Row[] = [
      {
        kind: "choice",
        id: "auth",
        label: "Who may call it?",
        options: AUTH_OPTIONS,
        value: () => this.auth,
        set: (v) => {
          this.auth = v as Auth;
          this.form.setValue("insecure-loopback", this.auth === "none");
        },
      },
    ];
    if (this.auth === "keys") {
      const file = String(this.form.get("keys"));
      const there = file !== "" && exists(resolve(this.ctx.io.cwd, file));
      rows.push({
        kind: "field",
        id: "keys",
        hint:
          file === ""
            ? "the key file: k creates one"
            : there
              ? "the key file"
              : "no such file yet: k creates a key in it",
      });
    }
    if (this.auth === "issuer")
      rows.push(
        { kind: "field", id: "issuer" },
        { kind: "field", id: "jwks" },
        { kind: "field", id: "subjects" },
      );
    return rows;
  }

  protected override hidden(): ReadonlySet<string> {
    return new Set(hiddenBy(this.auth));
  }

  /** Starts the command; a refusal comes back as its exit code and stderr. */
  async start(ctx: Ctx): Promise<void> {
    if (this.running !== undefined) {
      ctx.say("it is running: s stops it");
      return;
    }
    const errors = this.form.validate(ctx.ws, ctx.io);
    this.error = errors.find((e) => e.field === undefined || !this.hidden().has(e.field));
    if (this.error !== undefined) {
      if (this.error.field !== undefined) this.focusField(this.error.field);
      return;
    }
    const argv = this.argv(ctx);
    this.remember(ctx, argv);
    const r = new Running(argv, ctx.io, () => {
      this.toEnd = true;
      ctx.redraw();
    });
    const proc = this.proc;
    proc.running = r;
    proc.ended = undefined;
    proc.quitting = false;
    proc.unregister = ctx.onQuit(async () => {
      // Its own ending records it, saying why it stopped.
      proc.quitting = true;
      await r.halt();
    });
    // It returns by itself only when it could not start (or stops by s).
    void r.done.then((code) => {
      if (proc.running !== r) return;
      finish(ctx, proc, r, code);
      const said = clean(r.err);
      // The answer the refusal names: the host first, then the credentials (review E8.15d-12).
      if (/--host\b/.test(said)) this.focusId = this.hostFocus();
      else if (
        /authentication|credential|--keys|--issuer|--insecure-loopback|--resource/.test(said)
      )
        this.focusId = "choice:auth";
    });
    // Wait for the start line or the refusal, so the next key sees which.
    await Promise.race([
      r.done,
      new Promise<void>((done) => {
        const check = setInterval(() => {
          if (r.url() !== undefined || r.code !== undefined) {
            clearInterval(check);
            done();
          }
        }, 20);
        check.unref?.();
      }),
    ]);
  }

  /** The unit a refusal naming --host focuses: Serve's Host choice, else the field. */
  protected hostFocus(): string {
    return "host";
  }

  /** s: stops it, and shows its stop line. */
  async halt(ctx: Ctx): Promise<void> {
    const r = this.running;
    if (r === undefined) {
      ctx.say("nothing is running here");
      return;
    }
    const code = await r.halt();
    if (this.proc.running === r) finish(ctx, this.proc, r, code);
  }

  /** What Doctor and the hook take from this screen's answers. */
  protected remember(ctx: Ctx, argv: readonly string[]): void {
    const shared = sharedOf(ctx);
    const values = this.form.flagValues();
    const hidden = this.hidden();
    shared.serve = Object.fromEntries(
      BIND_FLAGS.flatMap((f) => {
        const v = values[f];
        return v === undefined || hidden.has(f) || typeof v === "object" ? [] : [[f, v]];
      }),
    );
    const db = argv[argv.indexOf("--db") + 1];
    if (argv.includes("--db") && db !== undefined && db !== ":memory:" && !db.includes("://"))
      shared.serveDb = isAbsolute(db) ? db : resolve(ctx.io.cwd, db);
  }

  /** The running state's lines: its start line, verbatim, then how to stop it. */
  protected processLines(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const r = this.running ?? this.ended;
    if (r === undefined) return [];
    const printed = clean(`${r.out}${r.err}`).trimEnd();
    const lines = [""];
    if (this.running !== undefined)
      lines.push(` ${t.status("running", r.url() === undefined ? "starting" : "running")}`);
    else
      lines.push(
        ` ${t.status(r.code === 0 ? "ok" : r.code === 2 ? "warn" : "fail", `exit ${r.code}`)}  ${r.code === 0 ? "stopped" : "it did not start"}`,
      );
    for (const l of printed.split("\n")) if (l !== "") lines.push(...para(l, width));
    return lines;
  }

  protected override leave(ctx: Ctx): Promise<boolean> {
    if (this.running !== undefined) ctx.say("it keeps running: quitting the TUI stops it");
    ctx.pop();
    return Promise.resolve(true);
  }
}

/** The loopback hosts Host offers; any other is typed under More flags, with credentials. */
const HOSTS = ["127.0.0.1", "::1", "localhost"] as const;

export class ServeScreen extends ProcessScreen {
  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    // The Viewer is the actor the workspace names, as the inspector would show it (8.13).
    const viewer =
      ctx.ws.get("as") === undefined && !runsNow(ctx, spec.name) ? ctx.ws.actorId() : undefined;
    const given =
      values.as === undefined && viewer !== undefined ? { ...values, as: viewer } : values;
    super(spec, ctx, given, positionals);
  }
  override title(): string {
    return "Serve the API and inspector";
  }
  protected override hostFocus(): string {
    return "choice:host";
  }
  protected override top(): Row[] {
    return [
      ...this.authRows(),
      {
        kind: "choice",
        id: "host",
        label: "Host",
        options: HOSTS.map((h) => ({ value: h, label: h })),
        // No --host is 127.0.0.1, as the CLI applies it; another host is under More flags.
        value: () => String(this.form.get("host")) || "127.0.0.1",
        set: (v) => this.form.setValue("host", v === "127.0.0.1" ? "" : v),
      },
      { kind: "field", id: "port", hint: "default 7313" },
      { kind: "field", id: "as", label: "Viewer", hint: "shown by the inspector" },
    ];
  }
  protected override buttons() {
    const out = [
      this.running === undefined
        ? { id: "button:start", label: "Start", press: (c: Ctx) => this.start(c) }
        : { id: "button:stop", label: "Stop", press: (c: Ctx) => this.halt(c) },
    ];
    if (this.auth === "keys")
      out.push({
        id: "button:key",
        label: "Create a key",
        press: async (c: Ctx) => this.createKey(c),
      });
    return out;
  }
  /** Opens Keys' create form with this screen's key file, and comes back here. */
  createKey(ctx: Ctx): void {
    ctx.push(
      new KeyCreateScreen(ctx, { keys: String(this.form.get("keys")) || undefined }, (file) => {
        this.form.setValue("keys", file);
        // Touched, so the workspace's own key file does not replace it (E8.15c's syncWorkspace).
        this.form.touched.add("keys");
      }),
    );
  }
  protected override ownActions(): readonly string[] {
    return ["stop", "open", "keys"];
  }
  protected override extra(name: string, ctx: Ctx): boolean | Promise<boolean> {
    if (name === "stop") return this.halt(ctx).then(() => true);
    if (name === "keys") {
      this.createKey(ctx);
      return true;
    }
    if (name === "open") {
      const url = this.running?.url();
      if (url === undefined) ctx.say("the server is not running: enter on Start starts it");
      else ctx.copy(`${url}/`);
      return true;
    }
    return false;
  }
  protected override footer(ctx: Ctx, width: number): Row[] {
    const lines = this.processLines(ctx, width);
    const url = this.running?.url();
    if (url !== undefined) {
      const link = `\x1b]8;;${url}/\x1b\\${url}/\x1b]8;;\x1b\\`;
      lines.push(
        "",
        ` Inspector  ${link}   o copies it`,
        " It stops when you press s or quit the TUI.",
      );
    } else if (this.running === undefined && this.ended === undefined)
      lines.push(
        "",
        ...para(
          "Start runs engram serve in this TUI's process until you stop it. Every call to it is decided by the plane and recorded.",
          width,
        ),
      );
    return [{ kind: "text", lines }];
  }
  protected override keyHints(): string {
    return this.running === undefined
      ? "enter choose  k keys  tab next"
      : "s stop  o copy the inspector's address  k keys";
  }
}
