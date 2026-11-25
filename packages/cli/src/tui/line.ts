// Line mode (card E8.15e, docs/design/tui.md 8.31 and 11.6): the plain CLI
// with prompts, for screen readers and for terminals where a full-screen
// layout is a burden. It never redraws, never moves the cursor, uses no
// colour and no box drawing, and asks one question a line, each ending in a
// colon. It reads with node:readline only (no pi-tui, not even through an
// import), and the terminal's own line editing and echo serve the person.
//
// A command is chosen by its number or name and its flags asked one at a
// time, from its registry entry; or a whole command line is typed. Either
// way the argument vector is checked by the CLI's own checks (./validate.ts),
// shown as `run: engram ...`, confirmed in the words of 9.5 (./asks.ts) when
// its entry's `writes` asks for it, and run through `run(argv, io)` with the
// same Io, so what it prints is the plain command's output, byte for byte.
// mcp and hook are setup only: their configuration is printed and Try it
// runs them as children on a scratch log (./snippets.ts); neither ever runs
// on this terminal. Nothing here decides anything (AGENTS.md rule 1).
import { isAbsolute, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { parse } from "../commands.ts";
import { SERVER_URL_ENV } from "../connect.ts";
import {
  type CommandSpec,
  closest,
  GROUPS,
  type OptionSpec,
  parseOptions,
  type Values,
} from "../registry.ts";
import { type Io, run } from "../run.ts";
import { buildActor } from "../setup.ts";
import { actorKeyNow, actorKeyOfResult, actorNow } from "./actor.ts";
import { confirmationFor, isRead, offered, readKey, specOfWords } from "./asks.ts";
import { type Exchange, type RunResult, teeCalls } from "./runner.ts";
import { savedPath, writeSaved } from "./saved.ts";
import type { Ran } from "./screen.ts";
import {
  absolutePaths,
  codexToml,
  hookCommand,
  hookSamples,
  type Launch,
  mcpJson,
  resolveLaunch,
  scratchLaunch,
  thisHost,
  tryHook,
  tryMcp,
} from "./snippets.ts";
import { checkArgv, refusalOf } from "./validate.ts";
import { detectShell, printedLine, type Shell, splitWords, stripControls } from "./words.ts";
import { isWsFlag, type Source, WORKSPACE_FLAGS, Workspace, type WsFlag } from "./workspace.ts";

export const LINE_INTRO =
  "engram tui, line mode. Type a number or a command name; help explains; quit leaves.";

/** The menu's word for a command: mcp and the hook are setup only (8.14, 8.15). */
const SETUP: Readonly<Record<string, string>> = {
  mcp: "mcp setup",
  "hook claude-code": "hook setup",
};
const menuName = (spec: CommandSpec) => SETUP[spec.name] ?? spec.name;

/** The commands in the menu's order: Home's six groups, each in the registry's order. */
function entries(): CommandSpec[] {
  return GROUPS.flatMap((g) => offered().filter((s) => s.group === g));
}

/** The menu: one line a group, each command with its number (8.31). */
export function menuText(): string {
  const all = entries();
  return GROUPS.map((g) => {
    const items = all
      .map((s, i) => ({ s, n: i + 1 }))
      .filter(({ s }) => s.group === g)
      .map(({ s, n }) => `${n} ${menuName(s)}`);
    return items.length === 0 ? "" : `${g}: ${items.join("  ")}\n`;
  }).join("");
}

const HELP_LINES = [
  "Type a number or a command's name, and line mode asks for its flags one at a time; an empty answer keeps the default it names.",
  'Or type a whole command line, such as write --content "..." --scope org, and it runs as typed, with the workspace\'s flags it does not give.',
  "Before a command changes anything, line mode says what it will do and asks; every command is shown as run: engram ..., and prints exactly what the plain command prints.",
  "workspace shows the flags every command gets, and changes them.",
  "screen opens the full-screen interface, with the same workspace.",
  "help followed by a command's name prints that command's options.",
  "quit or exit, at any question, or end of input, leaves: ctrl+D, or ctrl+Z then Enter on Windows; the commands this session ran are printed then, unless --quiet.",
  "A prompted field cannot take the words quit or exit; type the whole command line to give them, such as write --content quit.",
];

/** The end of input, or quit or exit, at any question: line mode leaves. */
class Ended extends Error {}

/** Whom line mode acts as: the actor every command builds from the workspace, with its level and memberships. */
export function actingAs(ws: Workspace): string {
  const a = actorNow(ws);
  if (a === undefined) {
    const id = ws.actorId();
    if (id === undefined) return "acting as no one yet: workspace sets --owner or --as";
    // The CLI's own message: every command would refuse this actor the same way.
    let why = "";
    try {
      buildActor(
        { as: ws.get("as"), level: ws.get("level"), member: [...ws.list("member")] },
        ws.get("owner"),
      );
    } catch (e) {
      why = (e as Error).message;
    }
    return `acting as ${id}, which every command refuses: ${why}`;
  }
  const members = a.memberships.length === 0 ? "its own scope" : a.memberships.join(", ");
  return `acting as ${a.id} (${a.level}), a member of ${members}`;
}

/** A line that is the end of input: ctrl+Z (Windows) or ctrl+D, alone. */
const END_OF_INPUT = new Set([String.fromCharCode(26), String.fromCharCode(4)]);

/** The words that leave line mode from any question (review E-4). */
const LEAVE = new Set(["quit", "exit"]);

/** The lines of standard input, one a question; undefined at the end of input. */
class Lines {
  private readonly queue: string[] = [];
  private waiting: ((line: string | undefined) => void) | undefined;
  private ended = false;
  private readonly rl: ReturnType<typeof createInterface>;
  private readonly echo: ((line: string) => void) | undefined;
  private readonly write: (text: string) => void;

  /**
   * The terminal's own line editing and echo, which screen readers know:
   * readline reads lines (terminal: false) and writes nothing at all.
   */
  constructor(
    input: NodeJS.ReadableStream,
    write: (text: string) => void,
    echo: ((line: string) => void) | undefined,
  ) {
    this.echo = echo;
    this.write = write;
    this.rl = createInterface({ input: input as Readable, terminal: false, crlfDelay: Infinity });
    this.rl.on("line", (line) => {
      // Windows' end of input (ctrl+Z then Enter) and ctrl+D arrive as a line of one control
      // character through a console: the end of input, as on a POSIX terminal (review E-2).
      if (END_OF_INPUT.has(line.trim())) {
        this.end();
        return;
      }
      const w = this.waiting;
      if (w !== undefined) {
        this.waiting = undefined;
        this.echo?.(line);
        w(line);
      } else this.queue.push(line);
    });
    this.rl.on("close", () => this.end());
  }

  /** Writes a question. */
  prompt(text: string): void {
    this.write(text);
  }

  next(): Promise<string | undefined> {
    const line = this.queue.shift();
    if (line !== undefined) {
      this.echo?.(line);
      return Promise.resolve(line);
    }
    if (this.ended) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    const w = this.waiting;
    this.waiting = undefined;
    w?.(undefined);
  }

  close(): void {
    this.end();
    this.rl.close();
  }
}

export interface LineOptions {
  /** The workspace flags: the command line's, or the full screen's when L switched here. */
  given: Values;
  /** tui.json's flags, unless --no-saved. */
  saved: Readonly<Record<string, string | readonly string[]>> | undefined;
  noSaved: boolean;
  /**
   * The full screen's reviewer handoff (8.8), carried apart from the flags
   * (verification R-1): set for this session only, never saved, never given.
   */
  handoff?: SessionHandoff;
}

/** A reviewer handoff as it moves between the full screen and line mode. */
export interface SessionHandoff {
  reviewer: string;
  members: string[];
  target: string;
}

export interface LineDeps {
  /** Told of each line read: a test's stand-in for the terminal's echo. */
  echo?: (line: string) => void;
  /** The command the snippets name; resolved on the PATH when absent. */
  launch?: Launch;
  platform?: NodeJS.Platform;
  /** Why the full screen cannot start here, for `screen`; undefined when it can. */
  screenRefusal?: () => string | undefined | Promise<string | undefined>;
}

export interface LineEnd {
  ran: Ran[];
  /** `screen` was typed: the full screen starts next, with `given`. */
  screen: boolean;
  given: Values;
  /** The handoff still on, for the full screen to take up again. */
  handoff?: SessionHandoff;
}

/** A question: a positional or a flag of a command's entry. */
interface Question {
  /** `pos:<name>` or the flag. */
  id: string;
  name: string;
  positional: boolean;
  label: string;
  required: boolean;
  option?: OptionSpec;
  picker?: string;
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0]?.toLowerCase() + s.slice(1) : s);
const orList = (xs: readonly string[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`;

/** The questions of a command: its positionals, then its own flags; the workspace's come from the workspace. */
function questionsOf(spec: CommandSpec): { main: Question[]; advanced: Question[] } {
  const main: Question[] = spec.positionals.map((p) => ({
    id: `pos:${p.name}`,
    name: p.name,
    positional: true,
    label: p.label,
    required: p.required,
    ...(p.picker === undefined ? {} : { picker: p.picker }),
  }));
  const advanced: Question[] = [];
  for (const [name, o] of Object.entries(spec.options)) {
    // --json is the plain command's to give (the TUI refuses it at its start, 5.2).
    if (name === "json" || isWsFlag(name)) continue;
    const q: Question = {
      id: name,
      name,
      positional: false,
      label: o.label,
      required: false,
      option: o,
    };
    (o.advanced === true ? advanced : main).push(q);
  }
  return { main, advanced };
}

/** A workspace flag of a command's entry, asked as its own question (the MCP server's level). */
function flagQuestion(spec: CommandSpec, name: string): Question {
  const o = spec.options[name];
  return {
    id: name,
    name,
    positional: false,
    label: o?.label ?? name,
    required: false,
    ...(o === undefined ? {} : { option: o }),
  };
}

/** The question as it is asked, ending before its colon. */
function promptOf(q: Question, fallback?: string): string {
  const label = lowerFirst(q.label);
  const o = q.option;
  if (o?.type === "boolean") return `${label}? yes or no (default no)`;
  const choices = o?.control === "choice" && o.choices ? `, ${orList(o.choices)}` : "";
  const note =
    fallback !== undefined
      ? ` (default ${fallback})`
      : q.positional
        ? q.required
          ? " (required)"
          : " (optional)"
        : o?.defaultText !== undefined
          ? ` (default ${o.defaultText})`
          : "";
  const many = o?.multiple === true ? ", one at a time, an empty answer ends the list" : "";
  return `${label}${choices}${note}${many}`;
}

const SOURCE_WORD: Readonly<Record<Source, string>> = {
  flag: "given",
  env: "from the environment",
  saved: "saved",
  set: "set here",
  default: "the default",
  session: "for this session",
};

/** Words a person answers yes or no with. */
const YES = new Set(["y", "yes"]);
const NO = new Set(["n", "no"]);

/** The read route, whose answer carries the read event's id (card E8.15c's loop). */
const READ_ROUTE = /\/api\/v1\/read$/;

class LineSession {
  readonly ran: Ran[] = [];
  private readonly results: RunResult[] = [];
  /** Reads with a store folder confirmed this session, by workspace (9.5). */
  private readonly readonce = new Set<string>();
  private readonly shell: Shell;
  private launch: Launch | undefined;
  /** The ids a preview draws, apart from the session's, as the full screen's peek does. */
  private previews = 0;

  private readonly io: Io;
  readonly ws: Workspace;
  private readonly lines: Lines;
  private readonly o: LineOptions;
  private readonly deps: LineDeps;

  constructor(io: Io, ws: Workspace, lines: Lines, o: LineOptions, deps: LineDeps) {
    this.io = io;
    this.ws = ws;
    this.lines = lines;
    this.o = o;
    this.deps = deps;
    this.shell = detectShell(io.env);
  }

  private out(text: string): void {
    this.io.out(text);
  }
  private say(text: string): void {
    this.out(`${text}\n`);
  }
  /** One value as a command line prints it: quoted for the shell, a URL's credentials redacted. */
  private word(v: string): string {
    return printedLine([v], this.shell).slice("engram ".length);
  }

  /** Asks `prompt`, its colon added; throws Ended at the end of input. */
  private async ask(prompt: string): Promise<string> {
    this.lines.prompt(`${prompt}: `);
    const line = await this.lines.next();
    if (line === undefined) {
      this.out("\n");
      throw new Ended();
    }
    if (LEAVE.has(line.trim().toLowerCase())) throw new Ended();
    return line;
  }

  private async yesNo(question: string): Promise<boolean> {
    for (;;) {
      const a = (await this.ask(`${question}? yes or no (default no)`)).trim().toLowerCase();
      if (a === "" || NO.has(a)) return false;
      if (YES.has(a)) return true;
      this.say("answer yes or no");
    }
  }

  /** The loop: until quit or the end of input; true when `screen` was typed. */
  async loop(): Promise<boolean> {
    this.say(LINE_INTRO);
    // Whom every command acts as, as the full screen's title bar says it (review E-1).
    this.say(actingAs(this.ws));
    this.out(menuText());
    for (;;) {
      let line: string;
      try {
        line = await this.ask("command");
      } catch (e) {
        if (e instanceof Ended) return false;
        throw e;
      }
      const typed = line.trim();
      if (typed === "") {
        this.out(menuText());
        continue;
      }
      if (typed === "screen") {
        const refused = await this.deps.screenRefusal?.();
        if (refused === undefined) return true;
        this.say(refused);
        continue;
      }
      try {
        await this.one(typed);
      } catch (e) {
        if (e instanceof Ended) return false;
        throw e;
      }
    }
  }

  /** One answer at the command prompt. */
  private async one(typed: string): Promise<void> {
    if (typed === "help") {
      for (const l of HELP_LINES) this.say(l);
      return;
    }
    if (typed.startsWith("help ")) return this.helpFor(typed.slice(5).trim());
    if (typed === "workspace") return this.workspace();
    const all = entries();
    const n = Number(typed);
    if (Number.isInteger(n) && String(n) === typed) {
      const spec = all[n - 1];
      if (spec === undefined) {
        this.say(`no command has the number ${typed}; an empty answer lists them`);
        return;
      }
      return this.byPrompts(spec);
    }
    const named = all.find((s) => s.name === typed || menuName(s) === typed);
    if (named !== undefined) return this.byPrompts(named);
    if (typed === "mcp") return this.mcpSetup();
    if (typed === "hook") return this.hookSetup();
    const words = splitWords(typed, this.shell);
    if (words === undefined) {
      this.say("a quote is left open; nothing ran");
      return;
    }
    const spec = specOfWords(words);
    if (spec === undefined) {
      const near = closest(words[0] ?? "", [
        ...new Set(all.map((s) => s.name.split(" ")[0] ?? "")),
      ]);
      const word = stripControls(words[0] ?? typed);
      this.say(
        near === undefined
          ? `no command is named ${word}; an empty answer lists them.`
          : `no command is named ${word}; did you mean "${near}"? An empty answer lists them.`,
      );
      return;
    }
    return this.byLine(spec, words);
  }

  private helpFor(name: string): void {
    const spec = entries().find((s) => s.name === name || menuName(s) === name);
    if (spec === undefined) {
      this.say(`no command is named ${stripControls(name)}; an empty answer lists them`);
      return;
    }
    this.say(`engram ${spec.usage}: ${spec.summary}`);
    for (const l of spec.helpSection) this.say(l);
  }

  // The workspace.

  private listWorkspace(): void {
    const set = WORKSPACE_FLAGS.filter(
      (f) => this.ws.get(f) !== undefined || this.ws.list(f).length > 0,
    );
    if (set.length === 0) this.say("  none set: each command takes the CLI's defaults");
    for (const f of set) this.say(`  ${this.flagLine(f)}`);
    const server = this.ws.server();
    if (server !== undefined && this.ws.source("server") === "env")
      this.say(`  --server ${this.word(server)} (from ${SERVER_URL_ENV})`);
  }

  private flagLine(f: WsFlag): string {
    const v = this.ws.get(f) ?? this.ws.list(f).join(" ");
    return `--${f} ${this.word(v)} (${SOURCE_WORD[this.ws.source(f)]})`;
  }

  private async workspace(): Promise<void> {
    this.say("the workspace: the flags every command that takes them gets");
    this.listWorkspace();
    let changed = false;
    for (;;) {
      const a = (await this.ask("a flag to change, such as owner, or an empty answer to keep them"))
        .trim()
        .replace(/^--/, "");
      if (a === "") break;
      if (!isWsFlag(a)) {
        const near = closest(a, [...WORKSPACE_FLAGS]);
        this.say(
          `--${stripControls(a)} is not a workspace flag${near === undefined ? "" : `; did you mean --${near}?`}`,
        );
        continue;
      }
      const now = this.ws.get(a) ?? (this.ws.list(a).join(" ") || "unset");
      const v = (
        await this.ask(
          `--${a} (now ${this.word(now)}; an empty answer unsets it${a === "member" ? "; scopes apart by spaces" : ""})`,
        )
      ).trim();
      this.ws.set(a, a === "member" ? v.split(/[\s,]+/).filter((x) => x !== "") : v, "set");
      changed = true;
      this.say(
        `  ${this.ws.get(a) === undefined && this.ws.list(a).length === 0 ? `--${a} unset` : this.flagLine(a)}`,
      );
    }
    if (!changed || this.o.noSaved) return;
    if (
      await this.yesNo(
        `save this workspace in ${savedPath(this.io.home)}, so the next engram tui starts with it, in line mode`,
      )
    ) {
      writeSaved(this.io.home, this.ws.savable(), { line: true });
      this.say(`saved in ${savedPath(this.io.home)}`);
    }
  }

  // A command by its prompts.

  /** The last read's id, offered for explain only while its actor is the actor now. */
  private lastReadId(): string | undefined {
    const now = actorKeyNow(this.ws);
    if (now === undefined) return undefined;
    for (const r of [...this.results].reverse()) {
      if (actorKeyOfResult(r) !== now) continue;
      const call = r.calls.find((c) => READ_ROUTE.test(c.path) && c.status === 200);
      const id = (call?.body as { event?: { id?: unknown } } | undefined)?.event?.id;
      if (typeof id === "string") return id;
    }
    return undefined;
  }

  private async answer(q: Question, values: Map<string, string | string[] | boolean>) {
    const o = q.option;
    if (o?.type === "boolean") {
      values.set(q.id, await this.yesNo(lowerFirst(q.label)));
      return;
    }
    if (o?.multiple === true) {
      const list: string[] = [];
      for (;;) {
        const a = (await this.ask(promptOf(q))).trim();
        if (a === "") break;
        list.push(a);
      }
      values.set(q.id, list);
      return;
    }
    const last = q.picker === "read" ? this.lastReadId() : undefined;
    const fallback = last === undefined ? undefined : `the last read, ${last}`;
    const a = (await this.ask(promptOf(q, fallback))).trim();
    values.set(q.id, a === "" && last !== undefined ? last : a);
  }

  /** The argument vector of a command's answers, as the full screen's form builds it. */
  private argvOf(spec: CommandSpec, values: ReadonlyMap<string, string | string[] | boolean>) {
    const words = spec.name.split(" ");
    const out = words.filter((w) => !w.startsWith("--"));
    const nameFlag = words.find((w) => w.startsWith("--"))?.slice(2);
    spec.positionals.forEach((p, i) => {
      const v = values.get(`pos:${p.name}`);
      if (typeof v !== "string" || v === "") return;
      if (i === 0 && nameFlag !== undefined) out.push(`--${nameFlag}`, v);
      else out.push(v);
    });
    for (const name of Object.keys(spec.options)) {
      if (isWsFlag(name)) continue;
      const v = values.get(name);
      if (v === true) out.push(`--${name}`);
      else if (Array.isArray(v)) for (const one of v) out.push(`--${name}`, one);
      else if (typeof v === "string" && v !== "") out.push(`--${name}`, v);
    }
    out.push(...this.ws.argsFor(spec));
    return out;
  }

  private async byPrompts(spec: CommandSpec): Promise<void> {
    if (spec.name === "mcp") return this.mcpSetup();
    if (spec.name === "hook claude-code") return this.hookSetup();
    this.say(spec.summary);
    const { main, advanced } = questionsOf(spec);
    const values = new Map<string, string | string[] | boolean>();
    const asked = [...main];
    for (const q of main) await this.answer(q, values);
    if (advanced.length > 0 && (await this.yesNo("advanced options"))) {
      for (const q of advanced) await this.answer(q, values);
      asked.push(...advanced);
    }
    for (const q of asked)
      if (q.positional && q.required && values.get(q.id) === "") {
        this.say(`nothing ran: ${lowerFirst(q.label)} is required`);
        return;
      }
    // The CLI's own checks; the field a message names is asked again (9.4).
    for (let round = 0; ; round++) {
      const argv = this.argvOf(spec, values);
      const refusal = refusalOf(spec, argv, this.io);
      if (refusal === undefined) return this.confirmAndRun(spec, argv);
      const message = refusal.message;
      if (refusal.stage === "own") {
        this.say(`line mode's own check refused it: ${message}`);
        this.say("nothing ran");
        return;
      }
      this.io.err(`engram ${spec.name.split(" ")[0]}: ${message}\n`);
      const q = round < 3 ? this.named(message, spec, asked) : undefined;
      if (q === undefined) {
        this.say("nothing ran");
        return;
      }
      await this.answer(q, values);
    }
  }

  /** The question a CLI message names: the first --flag in it that was asked. */
  private named(message: string, spec: CommandSpec, asked: readonly Question[]) {
    const nameFlag = spec.name
      .split(" ")
      .find((w) => w.startsWith("--"))
      ?.slice(2);
    for (const m of message.matchAll(/--([a-z][a-z-]*)/g)) {
      const flag = m[1] as string;
      const q =
        flag === nameFlag
          ? asked.find((x) => x.positional)
          : asked.find((x) => !x.positional && x.name === flag);
      if (q !== undefined) return q;
    }
    return undefined;
  }

  // A command line as typed.

  private async byLine(spec: CommandSpec, words: string[]): Promise<void> {
    if (spec.name === "mcp") {
      this.say(
        "engram mcp is setup only here: mcp setup prints its configuration; run engram mcp in a shell, or let the harness launch it",
      );
      return;
    }
    if (spec.name === "hook claude-code") {
      this.say(
        "engram hook is setup only here: hook setup prints its configuration; Claude Code runs the hook",
      );
      return;
    }
    // The workspace's flags the line does not give, as a pasted line fills the full screen's form.
    const given = new Set(
      words.filter((w) => w.startsWith("--")).map((w) => w.slice(2).split("=")[0] as string),
    );
    const argv = [...words, ...this.ws.argsFor(spec, given)];
    const refusal = refusalOf(spec, argv, this.io);
    if (refusal !== undefined) return this.refused(argv, refusal);
    return this.confirmAndRun(spec, argv);
  }

  /**
   * A typed command line the CLI's checks refuse (review E-3): shown, then
   * what the plain CLI prints for it, its exit code shown and recorded. A
   * line its parse refuses goes through `run` itself, which fails at that
   * parse before anything is opened, so its "did you mean" line is the CLI's.
   */
  private async refused(
    argv: string[],
    refusal: { message: string; stage: "parse" | "prepare" | "own" },
  ): Promise<void> {
    // A check of line mode's own is never printed as the CLI's (verification R-2): the
    // CLI may answer the same line otherwise, so it is said as line mode's, and nothing runs.
    if (refusal.stage === "own") {
      this.say(`line mode's own check refused it: ${refusal.message}`);
      this.say("nothing ran");
      return;
    }
    // The command's parse or prepare, which run makes before it opens anything.
    this.say(`run: ${printedLine(argv, this.shell)}`);
    const code = await run([...argv], this.runIo([]));
    this.say(`exit ${code}`);
    this.ran.push({ argv: [...argv], code });
  }

  // Confirming and running.

  /** The flags of a command line, parsed by the CLI's own parse, with the server ENGRAM_SERVER_URL names. */
  private flagsOf(spec: CommandSpec, argv: readonly string[]): Values {
    const words = spec.name.split(" ").filter((w) => !w.startsWith("--"));
    const args = spec.allowPositionals ? argv.slice(1) : argv.slice(words.length);
    let values: Values = {};
    try {
      values = parse([...args], parseOptions(spec), spec.allowPositionals).values as Values;
    } catch {
      values = {};
    }
    const server = values.server ?? (this.io.env[SERVER_URL_ENV] || undefined);
    return server === undefined ? values : { ...values, server };
  }

  private async confirmAndRun(spec: CommandSpec, argv: string[]): Promise<void> {
    if (spec.name === "write") await this.preview(argv);
    this.say(`run: ${printedLine(argv, this.shell)}`);
    const flags = this.flagsOf(spec, argv);
    const writes = spec.writes(flags, {});
    const once = isRead(spec) && this.readonce.has(readKey(flags));
    const ask = once
      ? undefined
      : confirmationFor(spec, argv, writes, flags, this.ws.actorLabel(), this.io);
    if (ask !== undefined) {
      this.say(ask.title);
      for (const l of ask.lines) this.say(l);
      const verb = ask.action.toLowerCase();
      const yes =
        ask.typed !== undefined
          ? (
              await this.ask(`type ${ask.typed} to ${verb} it, or an empty answer to cancel`)
            ).trim() === ask.typed
          : await this.yesNo(`${verb} it`);
      if (!yes) {
        this.say("cancelled: nothing ran");
        return;
      }
      if (isRead(spec)) this.readonce.add(readKey(flags));
    }
    if (spec.name === "serve") return this.serve(argv);
    const calls: Exchange[] = [];
    const code = await run([...argv], this.runIo(calls));
    this.say(`exit ${code}`);
    this.ran.push({ argv: [...argv], code });
    this.results.push({ argv: [...argv], code, out: "", err: "", calls });
  }

  /** The Io a command runs with: the session's, its client calls teed, the terminal's streams never handed on. */
  private runIo(calls: Exchange[], over: Partial<Io> = {}): Io {
    const { stdin: _stdin, stdout: _stdout, ...rest } = this.io;
    return {
      ...rest,
      transport: (fetch) => teeCalls(calls)(this.io.transport ? this.io.transport(fetch) : fetch),
      ...over,
    };
  }

  /** A write's preview: engram check with the same flags, which stores nothing (8.7). */
  private async preview(argv: readonly string[]): Promise<void> {
    this.say("the gate would decide, as engram check says (nothing stored, no event):");
    const newId = () => `00000000-0000-7000-8000-${String(++this.previews).padStart(12, "0")}`;
    await run(["check", ...argv.slice(1)], this.runIo([], { newId }));
  }

  /** engram serve, until an empty answer or the end of input stops it (8.13). */
  private async serve(argv: string[]): Promise<void> {
    const stop = new AbortController();
    const outer = this.io.stop;
    const onAbort = () => stop.abort();
    outer?.addEventListener("abort", onAbort, { once: true });
    let first: () => void = () => undefined;
    const spoke = new Promise<void>((resolve) => {
      first = resolve;
    });
    const done = run(
      [...argv],
      this.runIo([], {
        stop: stop.signal,
        out: (s) => {
          this.io.out(s);
          first();
        },
      }),
    );
    const early = await Promise.race([done.then((code) => code), spoke.then(() => undefined)]);
    let code: number;
    let note: string | undefined;
    if (early !== undefined) code = early;
    else {
      try {
        await this.ask("engram serve is running; an empty answer, or end of input, stops it");
      } catch (e) {
        if (!(e instanceof Ended)) throw e;
        stop.abort();
        await done;
        throw e;
      } finally {
        stop.abort();
      }
      code = await done;
      note = "stopped from line mode";
    }
    outer?.removeEventListener("abort", onAbort);
    this.say(`exit ${code}`);
    this.ran.push({ argv: [...argv], code, ...(note === undefined ? {} : { note }) });
  }

  // mcp and hook: setup only (8.14, 8.15).

  private launchOf(): Launch {
    this.launch ??= this.deps.launch ?? resolveLaunch(thisHost(this.io.env, this.deps.platform));
    return this.launch;
  }

  /** The project a harness runs in: CLAUDE_PROJECT_DIR, as the hook resolves it, else the working folder. */
  private project(): string {
    return resolve(this.io.cwd, this.io.env.CLAUDE_PROJECT_DIR || ".");
  }

  /** The workspace's server written out: the harness runs the snippet in its own environment. */
  private withServer(argv: string[]): string[] {
    const server = this.ws.server();
    return server === undefined || argv.includes("--server") ? argv : [...argv, "--server", server];
  }

  private async mcpSetup(): Promise<void> {
    const spec = entries().find((s) => s.name === "mcp") as CommandSpec;
    this.say(
      "mcp setup: engram mcp is never run here; Claude Code or Codex launches it, and an MCP server acts as an agent.",
    );
    const local = this.ws.clone();
    const as = (await this.ask("acting as (default agent:claude-code)")).trim();
    local.set("as", as === "" ? "agent:claude-code" : as, "set");
    const members: string[] = [];
    for (;;) {
      const m = (
        await this.ask(
          "member of, one at a time, an empty answer ends the list (none: its own scope)",
        )
      ).trim();
      if (m === "") break;
      members.push(m);
    }
    if (members.length > 0) local.set("member", members, "set");
    const lv = (await this.ask(promptOf(flagQuestion(spec, "level")))).trim();
    if (lv !== "") local.set("level", lv, "set");
    const args = absolutePaths(this.withServer(["mcp", ...local.argsFor(spec)]), this.project());
    const message = checkArgv(spec, args, this.io);
    if (message !== undefined) {
      this.io.err(`engram mcp: ${message}\n`);
      this.say("nothing to paste");
      return;
    }
    const launch = this.launchOf();
    if (launch.note !== undefined) this.say(launch.note);
    this.say(".mcp.json, for Claude Code:");
    this.out(`${JSON.stringify(mcpJson(launch, args), null, 2)}\n`);
    this.say("~/.codex/config.toml, for Codex:");
    this.out(codexToml(launch, args));
    this.serverNote();
    if (!(await this.yesNo("try it on a scratch log"))) return;
    const scratch = scratchLaunch(launch, args, this.io.env, this.project());
    const r = await tryMcp(scratch);
    this.say(`${r.outcome}: ${stripControls(r.detail)}`);
    for (const said of scratch.replaced) this.say(said);
  }

  private async hookSetup(): Promise<void> {
    const spec = entries().find((s) => s.name === "hook claude-code") as CommandSpec;
    this.say(
      "hook setup: engram hook is never run here; Claude Code runs it before each tool call.",
    );
    const root = this.ws.get("root");
    const roots: string[] = [];
    for (;;) {
      const r = (
        await this.ask(
          `store roots, one at a time, an empty answer ends the list${roots.length === 0 && root !== undefined ? ` (default ${root})` : ""}`,
        )
      ).trim();
      if (r === "") break;
      roots.push(r);
    }
    if (roots.length === 0 && root !== undefined) roots.push(root);
    const protect: string[] = [];
    for (;;) {
      const p = (
        await this.ask("protected files, one at a time, an empty answer ends the list")
      ).trim();
      if (p === "") break;
      protect.push(p);
    }
    const local = this.ws.clone();
    local.set("root", roots, "set");
    const as = (await this.ask(`block events as (default ${this.ws.actorLabel()})`)).trim();
    if (as !== "") local.set("as", as, "set");
    const own = protect.flatMap((p) => ["--protect", p]);
    const args = absolutePaths(
      this.withServer(["hook", "claude-code", ...own, ...local.argsFor(spec)]),
      this.project(),
    );
    const message = checkArgv(spec, args, this.io);
    if (message !== undefined) {
      this.io.err(`engram hook: ${message}\n`);
      this.say("nothing to paste");
      return;
    }
    const launch = this.launchOf();
    if (launch.note !== undefined) this.say(launch.note);
    if (roots.length === 0)
      this.say(
        "No store roots: the hook guards the stores' own commands only (mem0, letta and the rest), not reads or edits of a store's files.",
      );
    this.say(
      'With "onFailure": "block", a hook that fails blocks the call; Claude Code reads it from v2.1.295 on, and before that a failed hook lets the call through.',
    );
    this.say(".claude/settings.json, hooks.PreToolUse:");
    this.out(`${JSON.stringify({ matcher: "*", hooks: [hookCommand(launch, args)] }, null, 2)}\n`);
    this.serverNote();
    if (!(await this.yesNo("try it on a scratch log"))) return;
    const project = this.project();
    const scratch = scratchLaunch(launch, args, this.io.env, project);
    const absolute = roots.map((r) => (isAbsolute(r) ? r : resolve(project, r)));
    for (const r of await tryHook(scratch, hookSamples(project, absolute))) {
      const ok = r.expected && r.outcome !== "failed";
      this.say(`${ok ? "ok" : "fail"}: ${stripControls(r.label)}   ${stripControls(r.detail)}`);
    }
    for (const said of scratch.replaced) this.say(said);
  }

  private serverNote(): void {
    if (this.ws.server() === undefined) return;
    this.say(
      `The snippet names the server ${this.word(this.ws.server() as string)}. If the server asks for a credential, set ENGRAM_TOKEN in the harness's own environment: the snippet never holds it.`,
    );
  }
}

/**
 * Line mode until quit, the end of input, `screen`, or the stop signal (the
 * CLI's ctrl+c); returns the commands it ran, and whether `screen` asked for
 * the full screen, with the workspace's flags for it.
 */
export async function lineMode(io: Io, o: LineOptions, deps: LineDeps = {}): Promise<LineEnd> {
  const ws = Workspace.from(io.env, o.given, o.saved);
  if (o.handoff !== undefined) {
    ws.setForSession("as", o.handoff.reviewer);
    ws.setForSession("member", o.handoff.members);
  }
  const lines = new Lines(io.stdin as NodeJS.ReadableStream, (t) => io.out(t), deps.echo);
  const onStop = () => lines.close();
  io.stop?.addEventListener("abort", onStop, { once: true });
  const session = new LineSession(io, ws, lines, o, deps);
  try {
    const screen = await session.loop();
    // A handoff the person did not replace goes back with the session; savable() leaves it out.
    const on = o.handoff !== undefined && ws.source("as") === "session";
    return {
      ran: session.ran,
      screen,
      given: ws.savable(),
      ...(on && o.handoff
        ? {
            handoff: {
              ...o.handoff,
              reviewer: ws.get("as") as string,
              members: [...ws.list("member")],
            },
          }
        : {}),
    };
  } finally {
    io.stop?.removeEventListener("abort", onStop);
    lines.close();
  }
}
