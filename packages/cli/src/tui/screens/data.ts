// The Data screens and the Keys and Log verify screens (card E8.15d,
// docs/design/tui.md 8.20 to 8.24). Export asks for a file (the TUI never
// writes a bundle to its own screen) and its confirmation says whether the
// file exists and will be overwritten (the router's, for `writes` file).
// Import says how many rows it offers and that the write gate decides each
// one, then shows each row with the decision its call answered. Keys holds
// the key file at the top and lists the keys as `engram key list` prints
// them; a new key is shown once; revoking asks for the key's id typed.
// Log verify shows the verdict and the CLI's lines.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type CommandSpec, command, type Values } from "../../registry.ts";
import { actorKey, actorKeyOfResult, actorNow, madeAsOther } from "../actor.ts";
import { Form, type FormError } from "../forms.ts";
import { clean, para } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { Ctx } from "../screen.ts";
import type { StatusKind } from "../theme.ts";
import { type Button, type Row, SurfaceScreen } from "./surface.ts";

const spec = (name: string) => command(name) as CommandSpec;

export class ExportScreen extends SurfaceScreen {
  encryption: "none" | "recipients" | "passphrase";

  constructor(s: CommandSpec, ctx: Ctx, values: Values = {}, positionals: readonly string[] = []) {
    super(s, ctx, values, positionals);
    this.encryption =
      values["passphrase-file"] !== undefined
        ? "passphrase"
        : values.recipient !== undefined
          ? "recipients"
          : "none";
  }
  override title(): string {
    return "Export a bundle";
  }
  protected override top(): Row[] {
    // What the bundle holds first, then where it goes (review UX item).
    const rows: Row[] = [
      {
        kind: "para",
        text: `The bundle holds the items ${this.ctx.ws.actorLabel().replace(/ \(.*\)$/, "")} owns, with their events.`,
      },
      { kind: "text", lines: [""] },
      { kind: "field", id: "out", hint: "the bundle file; the TUI never writes it to the screen" },
      {
        kind: "choice",
        id: "encryption",
        label: "Encryption",
        options: [
          { value: "none", label: "none" },
          { value: "recipients", label: "age recipients" },
          { value: "passphrase", label: "passphrase file" },
        ],
        value: () => this.encryption,
        set: (v) => {
          this.encryption = v as ExportScreen["encryption"];
        },
      },
    ];
    if (this.encryption === "recipients")
      rows.push({ kind: "field", id: "recipient", label: "Recipients" });
    if (this.encryption === "passphrase") rows.push({ kind: "field", id: "passphrase-file" });
    return rows;
  }
  protected override hidden(): ReadonlySet<string> {
    if (this.encryption === "recipients") return new Set(["passphrase-file"]);
    if (this.encryption === "passphrase") return new Set(["recipient"]);
    return new Set(["recipient", "passphrase-file"]);
  }
  protected override precheck(): FormError | undefined {
    if (this.form.get("out") === "")
      return {
        field: "out",
        message:
          "give the file with --out <file>: the TUI writes the bundle to a file, never to its own screen",
      };
    return undefined;
  }
  protected override buttons(): Button[] {
    return [
      { id: "button:run", label: "Export", press: (c) => this.run(c) },
      // Card E9.16: the subject access export, its report shown on its screen.
      {
        id: "button:subject-export",
        label: "Subject access export",
        press: (c) => {
          const db = (this.form.get("db") as string | undefined) || undefined;
          const as = this.ctx.ws.actorId();
          const person = as?.startsWith("person:") ? as : undefined;
          return c.openCommand(spec("export --subject"), {
            db,
            ...(person === undefined ? {} : { subject: person }),
          });
        },
      },
    ];
  }
  protected override rich(_ctx: Ctx, width: number, result: RunResult): Row[] {
    return [{ kind: "text", lines: this.plainLines(result, width) }];
  }
  protected override async jsonOf(ctx: Ctx) {
    ctx.say("engram export has no --json: its output is the bundle file");
    return undefined;
  }
  protected override keyHints(): string {
    return "ctrl+s export  tab next";
  }
}

/** How many rows a plain bundle file holds: its lines after the header; undefined when it is sealed or unreadable. */
function bundleRows(cwd: string, file: string): number | undefined {
  try {
    const text = readFileSync(resolve(cwd, file), "utf8");
    if (!text.startsWith("{")) return undefined;
    return Math.max(0, text.split("\n").filter((l) => l.trim() !== "").length - 1);
  } catch {
    return undefined;
  }
}

export class ImportScreen extends SurfaceScreen {
  source: "bundle" | "claude";

  constructor(s: CommandSpec, ctx: Ctx, values: Values = {}, positionals: readonly string[] = []) {
    super(s, ctx, values, positionals);
    this.source = values.claude !== undefined ? "claude" : "bundle";
  }
  override title(): string {
    return "Import a bundle";
  }
  protected override top(): Row[] {
    const rows: Row[] = [
      {
        kind: "choice",
        id: "source",
        label: "Source",
        options: [
          { value: "bundle", label: "a bundle file" },
          { value: "claude", label: "a Claude memory list (--claude)" },
        ],
        value: () => this.source,
        set: (v) => {
          this.source = v as ImportScreen["source"];
        },
      },
    ];
    if (this.source === "bundle")
      rows.push(
        { kind: "field", id: "pos:bundle", label: "Bundle" },
        { kind: "field", id: "identity", label: "Identity files" },
        { kind: "field", id: "passphrase-file" },
      );
    else
      rows.push(
        { kind: "field", id: "claude", label: "Memory list" },
        { kind: "field", id: "confidence" },
      );
    rows.push({ kind: "field", id: "scope" });
    return rows;
  }
  protected override hidden(): ReadonlySet<string> {
    return this.source === "bundle"
      ? new Set(["claude", "confidence"])
      : new Set(["bundle", "identity", "passphrase-file"]);
  }
  override argv(ctx: Ctx): string[] {
    const argv = super.argv(ctx);
    // The bundle is a positional: a Claude list leaves it out.
    if (this.source === "claude") {
      const b = String(this.form.get("pos:bundle"));
      const at = b === "" ? -1 : argv.indexOf(b);
      if (at === 1) argv.splice(1, 1);
    }
    return argv;
  }
  protected override buttons(): Button[] {
    return [{ id: "button:run", label: "Import", press: (c) => this.run(c) }];
  }
  /** Each row is written by the import actor of the importer (`import:<importer>`): it is the importer's answer. */
  protected override madeAsOther(ctx: Ctx, result: RunResult): string | undefined {
    // The import actor carries the importer's level and memberships (an actor is its id, level
    // and memberships, card E8.15c): the importer's own answer is the import actor of the actor now.
    const now = actorNow(ctx.ws);
    const made = actorKeyOfResult(result);
    if (made === undefined || now === undefined) return undefined;
    if (made === actorKey({ ...now, id: `import:${now.id}` })) return undefined;
    return madeAsOther(ctx.ws, result)?.replace(/^import:/, "");
  }
  /** Asks first, naming how many rows it offers and that the write gate decides each. */
  protected override async execute(
    ctx: Ctx,
    argv: readonly string[],
  ): Promise<RunResult | undefined> {
    const actor = ctx.ws.actorLabel().replace(/ \(.*\)$/, "");
    const file = String(this.form.get(this.source === "bundle" ? "pos:bundle" : "claude"));
    const n = this.source === "bundle" ? bundleRows(ctx.io.cwd, file) : undefined;
    const rows =
      n === undefined
        ? this.source === "bundle"
          ? "every row of the bundle (it is sealed, so its rows are counted once it is opened)"
          : "every memory of the list"
        : `${n} row${n === 1 ? "" : "s"}`;
    const yes = await ctx.confirm({
      title: `Import ${file === "" ? "the bundle" : file}?`,
      lines: [
        `Offers ${rows} to the write gate, each a candidate written by the import actor for ${actor}. The gate decides every row and records the decision; a denied row is not written.`,
        "It cannot be undone: an allowed row is a new item, a candidate for you to review.",
      ],
      argv,
      action: "Import",
    });
    if (!yes) {
      ctx.say("cancelled: nothing ran");
      return undefined;
    }
    return ctx.runNow(argv);
  }
  /** Each row's decision, counted from the calls' answers: an import is many decisions. */
  protected override status(ctx: Ctx, result: RunResult): string {
    const t = ctx.theme;
    const decisions = result.calls
      .filter((c) => c.path === "/api/v1/items")
      .map((c) => (c.body as { event?: { decision?: string } } | undefined)?.event?.decision);
    if (decisions.length === 0) return super.status(ctx, result);
    const allowed = decisions.filter((d) => d === "allow").length;
    return ` ${t.status("allow", `${allowed} allowed`)}   ${t.status("deny", `${decisions.length - allowed} denied`)}   exit ${result.code}`;
  }
  protected override rich(ctx: Ctx, width: number, result: RunResult): Row[] {
    const t = ctx.theme;
    const decisions = result.calls
      .filter((c) => c.path === "/api/v1/items")
      .map((c) => (c.body as { event?: { decision?: string } } | undefined)?.event?.decision);
    let row = 0;
    const lines: string[] = [];
    for (const l of clean(`${result.out}${result.err}`).replace(/\n$/, "").split("\n")) {
      // Each row line of the CLI's output, in the order of its calls, with that call's decision.
      if (l.startsWith("  ") && l.includes(" -> ")) {
        const d = decisions[row++];
        const kind: StatusKind = d === "allow" ? "allow" : d === "ask" ? "ask" : "deny";
        const [first, ...rest] = para(l.trimStart(), width - 4, "");
        lines.push(`   ${t.symbol(kind)} ${first ?? ""}`, ...rest.map((x) => `     ${x}`));
      } else lines.push(...para(l, width));
    }
    if (result.code === 1) lines.push("", " exit 1 as a plain command: a row was denied.");
    return [{ kind: "text", lines }];
  }
  protected override async jsonOf(ctx: Ctx) {
    ctx.say("J would import again: run engram import with --json in a shell for its JSON");
    return undefined;
  }
  protected override keyHints(): string {
    return "ctrl+s import  tab next";
  }
}

/** The key id of a masked key as `engram key list` prints it (egk_<id>_****<tail>). */
export const keyIdOf = (line: string) => /^egk_([0-9a-f]{12})_/.exec(line.trim())?.[1];

export class KeysScreen extends SurfaceScreen {
  private selected: string | undefined;
  /** The ids listed by the last list, in order. */
  private ids: string[] = [];

  override title(): string {
    return "Keys";
  }
  protected override top(): Row[] {
    return [{ kind: "field", id: "keys", label: "Key file" }];
  }
  protected override buttons(): Button[] {
    return [
      { id: "button:run", label: "List the keys", press: (c) => this.run(c) },
      { id: "button:new", label: "Create a key", press: (c) => this.create(c) },
      { id: "button:revoke", label: "Revoke the selected key", press: (c) => this.revoke(c) },
    ];
  }
  protected override ownActions(): readonly string[] {
    return ["plain", "json", "rerun", "new-key", "revoke"];
  }
  protected override extra(name: string, ctx: Ctx): boolean | Promise<boolean> {
    if (name === "new-key") {
      this.create(ctx);
      return true;
    }
    if (name === "revoke") return this.revoke(ctx).then(() => true);
    return false;
  }
  private file(): string {
    return String(this.form.get("keys"));
  }
  create(ctx: Ctx): void {
    ctx.push(
      new KeyCreateScreen(ctx, { keys: this.file() || undefined }, async (file) => {
        this.form.setValue("keys", file);
        // Touched, so the workspace's own key file does not replace it (E8.15c's syncWorkspace).
        this.form.touched.add("keys");
        await this.run(ctx);
      }),
    );
  }
  /** Revokes the selected key: `engram key revoke <id>`, which asks for the id typed (9.5). */
  async revoke(ctx: Ctx): Promise<void> {
    const id = this.focusId?.startsWith("key:") ? this.focusId.slice(4) : this.selected;
    if (id === undefined) {
      ctx.say("choose a key in the list first: down to it, then R");
      return;
    }
    const revoke = new Form(spec("key revoke"), ctx.ws, { keys: this.file() }, [id]);
    const result = await ctx.act(spec("key revoke"), revoke.argv(ctx.ws), revoke.flagValues());
    if (result === undefined) return;
    if (result.code !== 0) {
      this.show(result);
      return;
    }
    await this.run(ctx);
    this.note = clean(result.out).trim();
  }
  protected override rich(_ctx: Ctx, width: number, result: RunResult): Row[] {
    const lines = clean(result.out).replace(/\n$/, "").split("\n");
    this.ids = [];
    const rows: Row[] = [];
    for (const l of lines) {
      const id = keyIdOf(l);
      if (id === undefined) {
        rows.push({ kind: "text", lines: para(l, width) });
        continue;
      }
      this.ids.push(id);
      // key.ts's columns: masked key, status, actor (level, source), expires; wrapped at the expiry.
      const at = l.indexOf("  expires ");
      const head = at < 0 ? l : l.slice(0, at);
      const tail = at < 0 ? "" : l.slice(at + 2);
      rows.push({
        kind: "item",
        id: `key:${id}`,
        lines: [
          ` ${head}`,
          ...(tail === "" ? [] : [`${" ".repeat(Math.min(38, head.length - 8))}${tail}`]),
        ],
        press: () => {
          this.selected = id;
        },
      });
    }
    if (this.ids.length > 0)
      rows.push({
        kind: "text",
        lines: [
          "",
          ...para(
            "A key is shown in full once, when it is created. Revoking cannot be undone.",
            width,
          ),
        ],
      });
    return rows;
  }
  protected override async jsonOf(ctx: Ctx, result: RunResult) {
    // Listing changes nothing, so its --json view is a second listing.
    return (await ctx.peek([...result.argv, "--json"])).out;
  }
  protected override keyHints(): string {
    return "n new  R revoke  r list again";
  }
}

export class KeyCreateScreen extends SurfaceScreen {
  private readonly created: ((file: string) => unknown) | undefined;

  constructor(
    ctx: Ctx,
    values: Values = {},
    created?: (file: string) => unknown,
    s = spec("key create"),
  ) {
    super(s, ctx, values);
    this.created = created;
  }
  override title(): string {
    return "Create a key";
  }
  protected override top(): Row[] {
    return [
      { kind: "field", id: "keys", label: "Key file" },
      { kind: "field", id: "as", label: "Acting as", hint: "the key's actor" },
      { kind: "field", id: "level" },
      { kind: "field", id: "member", label: "Member of" },
      { kind: "field", id: "source" },
      { kind: "field", id: "expires", hint: "required: every key carries an expiry" },
    ];
  }
  protected override buttons(): Button[] {
    return [{ id: "button:run", label: "Create", press: (c) => this.run(c) }];
  }
  protected override async execute(ctx: Ctx, argv: readonly string[]) {
    const result = await super.execute(ctx, argv);
    // The screen that opened this one learns the key file, and Keys lists again, before the next key.
    if (result?.code === 0) await this.created?.(this.file());
    return result;
  }
  private file(): string {
    return String(this.form.get("keys"));
  }
  protected override rich(ctx: Ctx, width: number, result: RunResult): Row[] {
    if (result.code !== 0) return [{ kind: "text", lines: this.plainLines(result, width) }];
    const [key, ...rest] = clean(result.out).replace(/\n$/, "").split("\n");
    return [
      {
        kind: "text",
        lines: [
          ` ${ctx.theme.status("warn", "copy it now")}: it is not shown again (Shift+drag selects it)`,
          "",
          `   ${key ?? ""}`,
          "",
          ...rest.flatMap((l) => para(l, width)),
        ],
      },
    ];
  }
  protected override async jsonOf(ctx: Ctx) {
    ctx.say("the key is shown once: a --json run would create another key");
    return undefined;
  }
  protected override keyHints(): string {
    return "ctrl+s create  tab next";
  }
}

export class KeyRevokeScreen extends SurfaceScreen {
  override title(): string {
    return "Revoke a key";
  }
  protected override top(): Row[] {
    return [
      {
        kind: "field",
        id: "pos:id",
        label: "Key id",
        hint: "the id or the masked key engram key list prints",
      },
      { kind: "field", id: "keys", label: "Key file" },
      { kind: "text", lines: [""] },
      {
        kind: "para",
        text: "Revoking cannot be undone: the key is never accepted again. It asks for the id typed.",
      },
    ];
  }
  protected override buttons(): Button[] {
    return [{ id: "button:run", label: "Revoke", press: (c) => this.run(c) }];
  }
  protected override keyHints(): string {
    return "ctrl+s revoke  tab next";
  }
}

const VERDICT: Record<string, { kind: StatusKind; word: string; said: string }> = {
  OK: {
    kind: "ok",
    word: "verified",
    said: "the chain is intact and a pinned key signed a checkpoint covering it",
  },
  FAILED: { kind: "fail", word: "broken", said: "the chain or a checkpoint does not verify" },
  UNSIGNED: {
    kind: "warn",
    word: "unsigned",
    said: "intact, but no pinned, signed checkpoint covers it",
  },
};

export class LogVerifyScreen extends SurfaceScreen {
  override title(): string {
    return "Verify the log";
  }
  protected override top(): Row[] {
    return [
      { kind: "field", id: "db", label: "Log", hint: "read only; nothing is migrated" },
      { kind: "field", id: "key", label: "Public key" },
      { kind: "field", id: "checkpoint", label: "Held checkpoints" },
    ];
  }
  protected override buttons(): Button[] {
    // The signed audit report (card E9.15) is reached from here: Home is full.
    const db = () => (this.form.get("db") as string | undefined) || undefined;
    return [
      { id: "button:run", label: "Verify", press: (c) => this.run(c) },
      {
        id: "button:audit-export",
        label: "Export an audit report",
        press: (c) => c.openCommand(spec("audit export"), { db: db() }),
      },
      {
        id: "button:audit-verify",
        label: "Verify an audit report",
        press: (c) => c.openCommand(spec("audit verify"), { db: db() }),
      },
      {
        // Card E9.16: the record of processing, counts from this log.
        id: "button:audit-ropa",
        label: "Record of processing",
        press: (c) => c.openCommand(spec("audit ropa"), { db: db() }),
      },
    ];
  }
  protected override status(ctx: Ctx, result: RunResult): string {
    const verdict = /^engram log verify: (\w+)/.exec(clean(result.out))?.[1];
    const v = verdict === undefined ? undefined : VERDICT[verdict];
    if (v === undefined) return super.status(ctx, result);
    return ` ${ctx.theme.status(v.kind, v.word)}   exit ${result.code}  ${v.said}`;
  }
  protected override rich(ctx: Ctx, width: number, result: RunResult): Row[] {
    const t = ctx.theme;
    const lines: string[] = [];
    for (const l of clean(result.out).replace(/\n$/, "").split("\n").slice(1)) {
      const check = /^ {2}(ok {2}|fail) {2}(.*)$/.exec(l);
      if (check === null) lines.push(...para(l, width));
      else {
        const ok = check[1]?.trim() === "ok";
        lines.push(
          ...para(
            `${t.status(ok ? "ok" : "fail", ok ? "ok  " : "fail")}  ${check[2] ?? ""}`,
            width,
            "   ",
          ),
        );
      }
    }
    if (clean(result.err) !== "") lines.push(...this.plainLines({ ...result, out: "" }, width));
    lines.push(
      "",
      ...para(
        "The chain proves no event was changed or removed after it was written, and from chain version 2 that no served event's attestation was changed. A signed checkpoint also proves who vouched for it.",
        width,
      ),
    );
    return [{ kind: "text", lines }];
  }
  protected override async jsonOf(ctx: Ctx, result: RunResult) {
    // Verifying reads the log only, so its --json view is a second verification.
    return (await ctx.peek([...result.argv, "--json"])).out;
  }
  protected override keyHints(): string {
    return "ctrl+s verify  v plain  J json";
  }
}

const AUDIT_VERDICT: Record<string, { kind: StatusKind; word: string; said: string }> = {
  OK: {
    kind: "ok",
    word: "verified",
    said: "signed by the pinned key, and the log recomputed says the same",
  },
  FAILED: {
    kind: "fail",
    word: "refuted",
    said: "a check failed: the report or the log was changed",
  },
  UNSIGNED: {
    kind: "warn",
    word: "unsigned",
    said: "the log agrees, but no key was pinned, so the signature was not checked",
  },
};

/**
 * Verify an audit report (card E9.15): the verdict, each check in order, then
 * the statement's counts as `engram audit verify` prints them. Nothing is
 * decided here: the lines are the command's own.
 */
export class AuditVerifyScreen extends SurfaceScreen {
  override title(): string {
    return "Verify an audit report";
  }
  protected override top(): Row[] {
    return [
      { kind: "field", id: "report", label: "Report", hint: "the file audit export wrote" },
      { kind: "field", id: "key", label: "Public key" },
      { kind: "field", id: "db", label: "Log", hint: "read only; nothing is migrated" },
      { kind: "field", id: "policy" },
      { kind: "field", id: "as", label: "Viewer", hint: "as the report was exported for" },
      { kind: "field", id: "level", label: "Viewer's level" },
      { kind: "field", id: "member", label: "Viewer's scopes" },
      { kind: "field", id: "declare", label: "Declared actors" },
      { kind: "field", id: "checkpoint", label: "Held checkpoints" },
    ];
  }
  protected override buttons(): Button[] {
    return [{ id: "button:run", label: "Verify", press: (c) => this.run(c) }];
  }
  protected override status(ctx: Ctx, result: RunResult): string {
    const verdict = /^engram audit verify: (\w+)/.exec(clean(result.out))?.[1];
    const v = verdict === undefined ? undefined : AUDIT_VERDICT[verdict];
    if (v === undefined) return super.status(ctx, result);
    return ` ${ctx.theme.status(v.kind, v.word)}   exit ${result.code}  ${v.said}`;
  }
  protected override rich(ctx: Ctx, width: number, result: RunResult): Row[] {
    const t = ctx.theme;
    const lines: string[] = [];
    for (const l of clean(result.out).replace(/\n$/, "").split("\n").slice(1)) {
      const check = /^ {2}(ok {2}|fail) {2}(.*)$/.exec(l);
      if (check === null) lines.push(...para(l, width, "   "));
      else {
        const ok = check[1]?.trim() === "ok";
        lines.push(
          ...para(
            `${t.status(ok ? "ok" : "fail", ok ? "ok  " : "fail")}  ${check[2] ?? ""}`,
            width,
            "   ",
          ),
        );
      }
    }
    if (clean(result.err) !== "") lines.push(...this.plainLines({ ...result, out: "" }, width));
    lines.push(
      "",
      ...para(
        "A report holds counts, hashes and seqs only, never content or names. Its counts are recomputed from the log to the report's head.",
        width,
      ),
    );
    return [{ kind: "text", lines }];
  }
  protected override async jsonOf(ctx: Ctx, result: RunResult) {
    // Verifying reads the log only, so its --json view is a second verification.
    return (await ctx.peek([...result.argv, "--json"])).out;
  }
  protected override keyHints(): string {
    return "ctrl+s verify  v plain  J json";
  }
}
