// The workspace panel (card E8.15b, docs/design/tui.md 8.3), ctrl+o from
// anywhere: every flag that names where and as whom a command runs, each
// with its value and where it came from. A server greys out the log,
// policy and store with connect's own message, since a server has its own.
// Applying checks the values with the CLI's own functions (buildActor, the
// URL parse, dbTarget), sets them for every command, saves them to tui.json
// (unless --no-saved) and shows the flags it now adds. "Forget saved
// workspace" deletes tui.json after a confirmation.

import { ScopeLevel } from "@engram/core";
import { buildActor, dbTarget } from "../../setup.ts";
import { TextField } from "../fields.ts";
import { cut, fit, para, rows, wrap } from "../layout.ts";
import { forgetFlow } from "../overlays.ts";
import { isPostgres, POSTGRES_NOT_SAVED } from "../saved.ts";
import type { CommandRow, Ctx, Screen } from "../screen.ts";
import { SERVER_REFUSES, serverRefusal, type Workspace, type WsFlag } from "../workspace.ts";

interface Row {
  id: string;
  label: string;
  kind: "text" | "radio" | "list" | "button";
  flag?: WsFlag;
  choices?: readonly string[];
  advanced?: true;
}

const ROWS: readonly Row[] = [
  { id: "connection", label: "Connection", kind: "radio", choices: ["in process", "server"] },
  { id: "server", label: "Server URL", kind: "text", flag: "server" },
  { id: "db", label: "Event log", kind: "text", flag: "db" },
  { id: "policy", label: "Policy", kind: "text", flag: "policy" },
  {
    id: "store",
    label: "Store kind",
    kind: "radio",
    flag: "store",
    choices: ["", "files", "letta"],
  },
  { id: "root", label: "Store folder", kind: "text", flag: "root" },
  { id: "owner", label: "Owner", kind: "text", flag: "owner" },
  { id: "as", label: "Acting as", kind: "text", flag: "as" },
  {
    id: "level",
    label: "Level",
    kind: "radio",
    flag: "level",
    choices: ["", ...ScopeLevel.options],
  },
  { id: "member", label: "Member of", kind: "list", flag: "member" },
  {
    id: "import-valid-from",
    label: "Imported valid from",
    kind: "text",
    flag: "import-valid-from",
    advanced: true,
  },
  { id: "keys", label: "Key file", kind: "text", flag: "keys", advanced: true },
  { id: "otlp", label: "Decision export OTLP", kind: "text", flag: "otlp", advanced: true },
  {
    id: "export-jsonl",
    label: "Decision export file",
    kind: "text",
    flag: "export-jsonl",
    advanced: true,
  },
  { id: "forget", label: "Forget saved workspace", kind: "button" },
  { id: "apply", label: "Apply and save", kind: "button" },
];

const HINT: Partial<Record<string, string>> = {
  db: "a SQLite file, :memory: or postgres://...",
  policy: "strict, medium, permissive or a YAML file",
  owner: "the person whose folder it is",
  as: "a principal such as person:dana",
  member: "enter adds; backspace in the empty entry removes",
  "import-valid-from": "default each file's mtime",
  otlp: "off unless named; the decisions leave the machine",
};

export class WorkspaceScreen implements Screen {
  readonly kind = "workspace" as const;
  private readonly draft: Workspace;
  private readonly editors = new Map<string, TextField>();
  private serverMode: boolean;
  private focus = 0;
  private problem: string | undefined;

  constructor(ctx: Ctx) {
    this.draft = ctx.ws.clone();
    this.serverMode = ctx.ws.server() !== undefined;
    for (const r of ROWS)
      if (r.kind === "text" || r.kind === "list")
        this.editors.set(
          r.id,
          new TextField(r.kind === "list" ? "" : (this.draft.get(r.flag as WsFlag) ?? "")),
        );
    if (ctx.ws.get("server") === undefined && this.serverMode)
      this.editors.get("server")?.set(ctx.ws.server() ?? "");
  }

  title(): string {
    return "Workspace";
  }

  /** The rows that take focus: none the server names. */
  private live(): Row[] {
    return ROWS.filter((r) => {
      if (r.id === "server") return this.serverMode;
      if (this.serverMode && r.flag !== undefined && SERVER_REFUSES.includes(r.flag)) return false;
      return true;
    });
  }

  private row(): Row {
    const live = this.live();
    this.focus = Math.max(0, Math.min(this.focus, live.length - 1));
    return live[this.focus] as Row;
  }

  focused(): string {
    return this.row().id;
  }

  inField(): boolean {
    const k = this.row().kind;
    return k === "text" || k === "list";
  }

  private value(r: Row): string {
    if (r.id === "connection") return this.serverMode ? "server" : "in process";
    if (r.kind === "text") return this.editors.get(r.id)?.value ?? "";
    return this.draft.get(r.flag as WsFlag) ?? "";
  }

  private cycle(r: Row, step: 1 | -1): void {
    const choices = r.choices ?? [];
    const i = choices.indexOf(this.value(r));
    const next = choices[(i + step + choices.length) % choices.length] as string;
    if (r.id === "connection") this.serverMode = next === "server";
    else this.draft.set(r.flag as WsFlag, next);
  }

  /** The draft with the editors' text in it, checked with the CLI's own functions. */
  private collect(ctx: Ctx): Workspace | string {
    const ws = this.draft.clone();
    for (const r of ROWS) {
      if (r.kind !== "text" || r.flag === undefined) continue;
      const v = (this.editors.get(r.id)?.value ?? "").trim();
      const was = ctx.ws.get(r.flag);
      ws.set(r.flag, v, v === was ? ctx.ws.source(r.flag) : "set");
    }
    if (!this.serverMode) ws.set("server", undefined);
    try {
      const server = ws.get("server");
      if (this.serverMode && server === undefined && ctx.ws.server() === undefined)
        return "give the server's URL, such as http://127.0.0.1:7313";
      if (server !== undefined) {
        try {
          new URL(server);
        } catch {
          return `--server ${server} is not a URL such as http://127.0.0.1:7313`;
        }
      }
      if (!this.serverMode) dbTarget(ws.get("db"), ctx.io);
      if (ws.get("as") !== undefined || ws.get("owner") !== undefined)
        buildActor(
          { as: ws.get("as"), level: ws.get("level"), member: [...ws.list("member")] },
          ws.get("owner"),
        );
    } catch (e) {
      return (e as Error).message;
    }
    return ws;
  }

  private apply(ctx: Ctx): void {
    const ws = this.collect(ctx);
    if (typeof ws === "string") {
      this.problem = ws;
      return;
    }
    for (const f of ["server", ...ROWS.flatMap((r) => (r.flag ? [r.flag] : []))] as WsFlag[]) {
      const v = f === "member" ? ws.list(f) : ws.get(f);
      ctx.ws.set(f, v, ws.source(f));
    }
    const flags = this.command(ctx).text ?? "";
    ctx.recheck();
    ctx.save();
    ctx.pop();
    const db = ctx.ws.get("db");
    ctx.say(
      db !== undefined && isPostgres(db) && !ctx.noSaved
        ? `applied; the Postgres log ${POSTGRES_NOT_SAVED}`
        : `applied${ctx.noSaved ? " (not saved: --no-saved)" : " and saved"}: ${flags || "no flags"} on every command`,
    );
  }

  async action(name: string, ctx: Ctx): Promise<boolean> {
    this.problem = undefined;
    const r = this.row();
    const n = this.live().length;
    switch (name) {
      case "next":
      case "field-down":
        this.focus = (this.focus + 1) % n;
        return true;
      case "prev":
      case "field-up":
        this.focus = (this.focus - 1 + n) % n;
        return true;
      case "submit":
        this.apply(ctx);
        return true;
      case "leave":
        ctx.pop();
        return true;
      case "toggle":
      case "choose-next":
      case "choose-prev":
        if (r.kind === "radio") this.cycle(r, name === "choose-prev" ? -1 : 1);
        else if (r.kind === "button" && name === "toggle") await this.press(r, ctx);
        return true;
      case "accept":
        if (r.kind === "list") {
          const e = this.editors.get(r.id) as TextField;
          if (e.value.trim() !== "") {
            this.draft.set("member", [...this.draft.list("member"), e.value.trim()]);
            e.set("");
            return true;
          }
        }
        if (r.kind === "button") await this.press(r, ctx);
        else this.apply(ctx);
        return true;
    }
    return false;
  }

  private async press(r: Row, ctx: Ctx): Promise<void> {
    if (r.id === "forget") await forgetFlow(ctx);
    else this.apply(ctx);
  }

  raw(data: string): boolean {
    const r = this.row();
    const e = this.editors.get(r.id);
    if (e === undefined) return false;
    if (r.kind === "list" && e.value === "" && (data === "\x7f" || data === "\b")) {
      this.draft.set("member", this.draft.list("member").slice(0, -1));
      return true;
    }
    e.type(data);
    return true;
  }

  command(ctx: Ctx): CommandRow {
    const ws = this.collect(ctx);
    if (typeof ws === "string") return { text: "", note: "(not applied: see the panel)" };
    const flags: string[] = [];
    for (const f of [
      "server",
      "db",
      "policy",
      "owner",
      "as",
      "level",
      "member",
      "store",
      "root",
      "import-valid-from",
      "keys",
      "otlp",
      "export-jsonl",
    ] as WsFlag[]) {
      if (this.serverMode && SERVER_REFUSES.includes(f)) continue;
      const v = f === "member" ? ws.list(f) : ws.get(f);
      for (const one of typeof v === "string" ? [v] : (v ?? [])) flags.push(`--${f}`, one);
    }
    return { text: ctx.line(flags).replace(/^engram ?/, ""), note: "(every command)" };
  }

  hints(): string {
    return "tab next  space choose  enter apply and save";
  }

  private source(ctx: Ctx, flag: WsFlag | undefined): string {
    if (flag === undefined) return "";
    const s = this.draft.source(flag);
    const named = {
      flag: "from a flag",
      env: flag === "db" ? "from ENGRAM_DB_URL" : "from ENGRAM_SERVER_URL",
      saved: "saved",
      set: "set here",
      default: "default",
    }[s];
    return ctx.ws.get(flag) === undefined && s === "default" ? "" : named;
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const t = ctx.theme;
    const lines: string[] = [];
    const live = this.live();
    const focused = this.row();
    const inputWidth = Math.max(12, Math.min(40, width - 50));
    let refusalShown = false;
    for (const r of ROWS) {
      if (r.id === "server" && !this.serverMode) continue;
      const on = r === focused;
      const mark = on ? ">" : " ";
      const greyed = !live.includes(r);
      if (greyed) {
        if (!refusalShown) {
          refusalShown = true;
          const msg = serverRefusal(
            ctx.io,
            ctx.ws.server() ?? this.editors.get("server")?.value ?? "the server",
          );
          lines.push(
            ...wrap(t.dim(` Event log, policy, store: the server's own. ${msg}`), width - 1),
          );
        }
        continue;
      }
      if (r.id === "forget") {
        lines.push(
          "",
          ...para(
            `Saved in ~/.engram/tui.json: flags only.${ctx.noSaved ? " Not read or written this session (--no-saved)." : ""}`,
            width,
          ),
        );
      }
      if (r.id === "import-valid-from") lines.push("", " Advanced");
      let control: string;
      if (r.kind === "radio")
        control = (r.choices ?? [])
          .map((c) => `${c === this.value(r) ? "(o)" : "( )"} ${c === "" ? "default" : c}`)
          .join("  ");
      else if (r.kind === "button") control = on ? t.reverse(`[ ${r.label} ]`) : `[ ${r.label} ]`;
      else if (r.kind === "list") {
        const list = this.draft.list("member");
        control = `${list.length === 0 ? "the actor's own scope  " : `${list.join(", ")}  `}[ ${this.editors.get(r.id)?.render(20, on) ?? ""} ]`;
      } else control = `[ ${this.editors.get(r.id)?.render(inputWidth, on) ?? ""} ]`;
      const label = r.kind === "button" ? "" : fit(r.label, 22);
      const note = [this.source(ctx, r.flag), HINT[r.id] ?? ""].filter((x) => x !== "").join("; ");
      const text = ` ${mark} ${label}${r.kind === "button" ? "" : " "}${control}  ${note}`;
      lines.push(on && r.kind === "radio" ? t.reverse(cut(text, width)) : cut(text, width));
    }
    if (this.serverMode)
      lines.push(
        "",
        ` Token        ${ctx.ws.tokenSet() ? "set" : "not set"} (ENGRAM_TOKEN; its value is never shown)`,
      );
    if (this.problem !== undefined)
      lines.push("", ...para(`${t.status("fail", this.problem)}`, width));
    const focusAt = lines.findIndex((l) => l.includes(`> `));
    const start = focusAt >= height ? focusAt - height + 2 : 0;
    return rows(lines.slice(start), height, width);
  }
}
