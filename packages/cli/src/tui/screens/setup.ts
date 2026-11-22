// The MCP server and Claude Code hook setup (card E8.15d, docs/design/tui.md
// 8.14 and 8.15). Neither command is ever run on the TUI's terminal: the
// harness launches them. Each screen builds the command from its fields,
// shows the configuration to paste in the tested fixtures' shape
// (../snippets.ts), copies it, and Try it spawns exactly the copied command
// as a child process on a scratch :memory: log that reaches no server,
// listing each replacement. MCP over HTTP is a server the screen runs until
// stopped, with Serve's three answers to "Who may call it?".
import { isAbsolute, resolve } from "node:path";
import type { CommandSpec, Values } from "../../registry.ts";
import { redactSecrets } from "../../setup.ts";
import { clean, para, wrap } from "../layout.ts";
import type { Ctx } from "../screen.ts";
import {
  absolutePaths,
  codexToml,
  hookCommand,
  hookSamples,
  type Launch,
  type McpResult,
  mcpJson,
  resolveLaunch,
  type SampleResult,
  type Scratch,
  scratchLaunch,
  thisHost,
  tryHook,
  tryMcp,
} from "../snippets.ts";
import { KeyCreateScreen } from "./data.ts";
import { ProcessScreen } from "./serve.ts";
import { type Button, type Row, SurfaceScreen, sharedOf } from "./surface.ts";

/** The project a harness runs in: CLAUDE_PROJECT_DIR, as the hook resolves it, else the working folder. */
const projectOf = (ctx: Ctx) => resolve(ctx.io.cwd, ctx.io.env.CLAUDE_PROJECT_DIR || ".");

/** A snippet's text as drawn: a URL's credentials redacted, as the command row draws them; the copy keeps them. */
function drawn(text: string, args: readonly string[]): string {
  let out = text;
  for (const a of args) if (a.includes("://")) out = redactSecrets(out, a);
  return out;
}

/** Wrapped JSON of a snippet, compact, for the screen; the copy is the pretty one. */
const snippetLines = (value: unknown, width: number, args: readonly string[]) =>
  wrap(drawn(JSON.stringify(value, null, 1).replace(/\n\s*/g, " "), args), width - 4).map(
    (l) => `   ${l}`,
  );

const pretty = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** The launch both screens use, resolved once per screen (8.14); tests and frames set their own. */
const resolveFor = (ctx: Ctx): Launch => resolveLaunch(thisHost(ctx.io.env));

export class HookScreen extends SurfaceScreen {
  private launch: Launch | undefined;
  /** The last Try it: its scratch command and each sample's result. */
  tried: { scratch: Scratch; results: SampleResult[] | undefined } | undefined;
  /** What the screen filled in itself, said under the fields. */
  private readonly filled: string | undefined;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    // With a server, the hook cannot see the log the server writes: protect the one Serve named.
    const serveDb = sharedOf(ctx).serveDb;
    const server = ctx.ws.server() !== undefined;
    const add: Record<string, readonly string[]> =
      server && serveDb !== undefined && values.protect === undefined ? { protect: [serveDb] } : {};
    // The store folder of the workspace is the first root to protect.
    const root = ctx.ws.get("root");
    if (values.root === undefined && root !== undefined) add.root = [root];
    super(spec, ctx, { ...add, ...values }, positionals);
    this.filled =
      "protect" in add
        ? `--protect ${serveDb}: the log engram serve --db names, which the hook cannot see through --server (docs/dogfood.md).`
        : server && !("protect" in add)
          ? "With a server, give Protected files the log engram serve --db names: the hook cannot see it through --server (docs/dogfood.md)."
          : undefined;
  }

  override title(): string {
    return "Claude Code hook setup";
  }

  /** For tests and frames: the command the snippet names, in place of the PATH's. */
  setLaunch(launch: Launch): void {
    this.launch = launch;
  }
  private launchOf(ctx: Ctx): Launch {
    this.launch ??= resolveFor(ctx);
    return this.launch;
  }

  /** The engram arguments of the snippet: the form's, every path absolute against the project. */
  snippetArgs(ctx: Ctx = this.ctx): string[] {
    let argv = this.form.argv(ctx.ws);
    // The hook's --root is its own, not the workspace's store folder: a server does not drop it.
    const roots = this.form.get("root") as readonly string[];
    if (!argv.includes("--root") && roots.length > 0)
      argv = [...argv, ...roots.flatMap((r) => ["--root", r])];
    return absolutePaths(argv, projectOf(ctx));
  }
  override argv(ctx: Ctx): string[] {
    return this.snippetArgs(ctx);
  }

  protected override top(ctx: Ctx): Row[] {
    const server = ctx.ws.server() !== undefined || this.form.get("server") !== "";
    return [
      { kind: "field", id: "root", label: "Store roots", hint: "written absolute; enter adds" },
      {
        kind: "field",
        id: "protect",
        label: "Protected files",
        hint: server ? "the server's log: see below" : "the log is protected already",
      },
      { kind: "field", id: "as", label: "Block events as" },
    ];
  }

  protected override buttons(): Button[] {
    return [
      { id: "button:copy", label: "Copy the entry", press: (c) => this.copyEntry(c) },
      { id: "button:try", label: "Try it on a scratch log", press: (c) => this.tryIt(c) },
    ];
  }
  protected override submitLabel(): string {
    return "try it";
  }
  /** ctrl+s: Try it. */
  protected override async submit(ctx: Ctx): Promise<void> {
    await this.tryIt(ctx);
  }

  private entry(ctx: Ctx) {
    return { matcher: "*", hooks: [hookCommand(this.launchOf(ctx), this.snippetArgs(ctx))] };
  }

  copyEntry(ctx: Ctx): void {
    ctx.copy(pretty(this.entry(ctx)));
  }

  async tryIt(ctx: Ctx): Promise<void> {
    const errors = this.form.validate(ctx.ws, ctx.io);
    this.error = errors[0];
    if (this.error !== undefined) {
      if (this.error.field !== undefined) this.focusField(this.error.field);
      return;
    }
    const project = projectOf(ctx);
    const args = this.snippetArgs(ctx);
    const scratch = scratchLaunch(this.launchOf(ctx), args, ctx.io.env, project);
    this.tried = { scratch, results: undefined };
    this.toEnd = true;
    ctx.redraw();
    const roots = (this.form.get("root") as readonly string[]).map((r) =>
      isAbsolute(r) ? r : resolve(project, r),
    );
    this.tried = { scratch, results: await tryHook(scratch, hookSamples(project, roots)) };
    this.toEnd = true;
  }

  protected override ownActions(): readonly string[] {
    return ["try"];
  }
  protected override extra(name: string, ctx: Ctx): Promise<boolean> | boolean {
    if (name === "try") return this.tryIt(ctx).then(() => true);
    return false;
  }

  protected override footer(ctx: Ctx, width: number): Row[] {
    const t = ctx.theme;
    const launch = this.launchOf(ctx);
    const lines: string[] = [""];
    if (this.filled !== undefined) lines.push(...para(this.filled, width), "");
    if (launch.note !== undefined) lines.push(...para(launch.note, width));
    lines.push(" .claude/settings.json, hooks.PreToolUse:");
    lines.push(...snippetLines(this.entry(ctx), width, this.snippetArgs(ctx)));
    if (this.tried !== undefined) {
      lines.push("");
      if (this.tried.results === undefined)
        lines.push(
          ` ${t.status("running", "Try it is running")}: a child process on a scratch log`,
        );
      else
        for (const r of this.tried.results) {
          const ok = r.expected && r.outcome !== "failed";
          lines.push(
            ...para(`${t.status(ok ? "ok" : "fail", clean(r.label))}   ${clean(r.detail)}`, width),
          );
        }
      for (const said of this.tried.scratch.replaced) lines.push(...para(said, width));
    }
    return [{ kind: "text", lines }];
  }

  protected override keyHints(): string {
    return this.inField() ? "ctrl+s try it  tab next" : "enter choose  t try it  tab next";
  }
}

export class McpScreen extends ProcessScreen {
  private launch: Launch | undefined;
  transport: "stdio" | "http";
  tried: { scratch: Scratch; result: McpResult | undefined } | undefined;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    super(spec, ctx, values, positionals);
    this.transport = values.http === undefined ? "stdio" : "http";
  }

  override title(): string {
    return "MCP server";
  }
  setLaunch(launch: Launch): void {
    this.launch = launch;
  }
  private launchOf(ctx: Ctx): Launch {
    this.launch ??= resolveFor(ctx);
    return this.launch;
  }

  /** Over stdio no credential flag applies; over HTTP with credentials no self-asserted actor does. */
  protected override hidden(): ReadonlySet<string> {
    if (this.transport === "stdio")
      return new Set([
        "http",
        "keys",
        "issuer",
        "jwks",
        "subjects",
        "audience",
        "resource",
        "insecure-loopback",
      ]);
    const out = new Set(super.hidden());
    if (this.auth !== "none") for (const f of ["as", "member", "level"]) out.add(f);
    return out;
  }

  snippetArgs(ctx: Ctx = this.ctx): string[] {
    return absolutePaths(super.argv(ctx), projectOf(ctx));
  }
  override argv(ctx: Ctx): string[] {
    return this.snippetArgs(ctx);
  }

  protected override top(): Row[] {
    const rows: Row[] = [];
    const asserted = this.transport === "stdio" || this.auth === "none";
    if (asserted)
      rows.push(
        { kind: "field", id: "as", label: "Acting as", hint: "source model, fixed at launch" },
        { kind: "field", id: "member", label: "Member of" },
        { kind: "field", id: "level" },
      );
    rows.push({
      kind: "choice",
      id: "transport",
      label: "Transport",
      options: [
        { value: "stdio", label: "stdio, launched by the harness" },
        { value: "http", label: "HTTP, needs authentication" },
      ],
      value: () => this.transport,
      set: (v) => {
        this.transport = v as "stdio" | "http";
      },
    });
    if (this.transport === "http") {
      rows.push({ kind: "field", id: "http", label: "HTTP port" }, ...this.authRows());
      if (!asserted)
        rows.push({
          kind: "text",
          lines: ["   each session acts as the actor its credential names"],
        });
    }
    rows.push({ kind: "field", id: "supersede" });
    return rows;
  }

  protected override buttons(): Button[] {
    if (this.transport === "http")
      return [
        this.running === undefined
          ? { id: "button:start", label: "Start", press: (c) => this.start(c) }
          : { id: "button:stop", label: "Stop", press: (c) => this.halt(c) },
        ...(this.auth === "keys"
          ? [{ id: "button:key", label: "Create a key", press: (c: Ctx) => this.createKey(c) }]
          : []),
      ];
    return [
      { id: "button:copy-mcp", label: "Copy .mcp.json", press: (c) => c.copy(pretty(this.mcp(c))) },
      {
        id: "button:copy-codex",
        label: "Copy Codex config.toml",
        press: (c) => c.copy(codexToml(this.launchOf(c), this.snippetArgs(c))),
      },
      { id: "button:try", label: "Try it", press: (c) => this.tryIt(c) },
    ];
  }
  protected override submitLabel(): string {
    return this.transport === "http" ? (this.running === undefined ? "start" : "stop") : "try it";
  }
  protected override async submit(ctx: Ctx): Promise<void> {
    if (this.transport === "http")
      await (this.running === undefined ? this.start(ctx) : this.halt(ctx));
    else await this.tryIt(ctx);
  }

  createKey(ctx: Ctx): void {
    ctx.push(
      new KeyCreateScreen(ctx, { keys: String(this.form.get("keys")) || undefined }, (file) => {
        this.form.setValue("keys", file);
      }),
    );
  }

  private mcp(ctx: Ctx) {
    return mcpJson(this.launchOf(ctx), this.snippetArgs(ctx));
  }

  async tryIt(ctx: Ctx): Promise<void> {
    if (this.transport !== "stdio") {
      ctx.say("Try it speaks MCP over stdio; over HTTP, Start runs the server here");
      return;
    }
    const errors = this.form.validate(ctx.ws, ctx.io);
    this.error = errors.find((e) => e.field === undefined || !this.hidden().has(e.field));
    if (this.error !== undefined) {
      if (this.error.field !== undefined) this.focusField(this.error.field);
      return;
    }
    const scratch = scratchLaunch(
      this.launchOf(ctx),
      this.snippetArgs(ctx),
      ctx.io.env,
      projectOf(ctx),
    );
    this.tried = { scratch, result: undefined };
    this.toEnd = true;
    ctx.redraw();
    this.tried = { scratch, result: await tryMcp(scratch) };
    this.toEnd = true;
  }

  protected override ownActions(): readonly string[] {
    return this.transport === "stdio" ? ["try"] : ["stop", "keys"];
  }
  protected override extra(name: string, ctx: Ctx): Promise<boolean> | boolean {
    if (name === "try") return this.tryIt(ctx).then(() => true);
    if (name === "stop") return this.halt(ctx).then(() => true);
    if (name === "keys" && this.transport === "http") {
      this.createKey(ctx);
      return true;
    }
    return false;
  }

  protected override footer(ctx: Ctx, width: number): Row[] {
    const t = ctx.theme;
    const lines: string[] = [];
    if (this.transport === "http") {
      lines.push(...this.processLines(ctx, width));
      if (this.running === undefined && this.ended === undefined)
        lines.push(
          "",
          ...para("Start runs engram mcp --http in this TUI's process until you stop it.", width),
        );
      return [{ kind: "text", lines }];
    }
    const launch = this.launchOf(ctx);
    lines.push("");
    if (launch.note !== undefined) lines.push(...para(launch.note, width));
    lines.push(
      " For Claude Code, .mcp.json:",
      ...snippetLines(this.mcp(ctx), width, this.snippetArgs(ctx)),
    );
    if (width >= 118)
      lines.push(
        " For Codex, config.toml:",
        ...drawn(codexToml(launch, this.snippetArgs(ctx)), this.snippetArgs(ctx))
          .trimEnd()
          .split("\n")
          .flatMap((l) => para(l, width, "   ")),
      );
    if (this.tried !== undefined) {
      lines.push("");
      const r = this.tried.result;
      if (r === undefined)
        lines.push(
          ` ${t.status("running", "Try it is running")}: a child process on a scratch log`,
        );
      else
        lines.push(
          ...para(
            r.outcome === "ok"
              ? `${t.status("ok", "Try it on a scratch log")}: ${r.detail}`
              : `${t.status("fail", clean(r.detail))}`,
            width,
          ),
        );
      for (const said of this.tried.scratch.replaced) lines.push(...para(said, width));
    }
    return [{ kind: "text", lines }];
  }

  protected override keyHints(): string {
    if (this.transport === "http") return "ctrl+s start or stop  tab next";
    return this.inField() ? "ctrl+s try it  tab next" : "enter choose  t try it  tab next";
  }
}
