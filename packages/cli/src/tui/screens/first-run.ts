// First run (card E8.15b, docs/design/tui.md 8.2): the TUI opens here when
// the workspace is not usable yet and no saved workspace still works. Three
// questions, each with the default the CLI would use and the flags it
// amounts to: where the event log lives, who you are, and which memory
// folder (optional). A policy question appears only when the policy does not
// load. The cheap checks (./workspace.ts) answer live; nothing is written by
// onboarding itself: the log is created by the first read or write, as the
// CLI does. On finishing, the answers are saved and the guided first loop
// starts.
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { command } from "../../registry.ts";
import { TextField } from "../fields.ts";
import { cut, para, rows } from "../layout.ts";
import type { CommandRow, Ctx, Screen } from "../screen.ts";
import type { CheapCheck } from "../workspace.ts";
import { ResultScreen } from "./form.ts";
import { LoopScreen } from "./loop.ts";

/** d: doctor with the workspace's flags, its own output as the result (8.2: only when asked). */
async function runDoctor(ctx: Ctx): Promise<void> {
  const spec = command("doctor");
  if (spec === undefined) return;
  const result = await ctx.act(spec, ["doctor", ...ctx.ws.argsFor(spec)], {});
  if (result !== undefined) ctx.push(new ResultScreen(spec, result, {}));
}

/** The log choices of question 1, each the --db it amounts to. */
const LOG_CHOICES = [
  { id: "default", label: "the default for this user", db: undefined },
  { id: "file", label: "a file I name", db: "file" },
  { id: "memory", label: "in memory only, nothing kept", db: ":memory:" },
  { id: "postgres", label: "a Postgres server", db: "postgres" },
] as const;

const POLICY_CHOICES = ["medium", "strict", "permissive", "file"] as const;

type Question = "log" | "who" | "folder" | "policy";

export class FirstRunScreen implements Screen {
  readonly kind = "first-run" as const;
  private question: Question;
  private logChoice = 0;
  private readonly dbFile = new TextField("");
  private readonly dbUrl = new TextField("");
  private readonly owner = new TextField("");
  private readonly folder = new TextField("");
  private policyChoice = 0;
  private readonly policyFile = new TextField("");
  private readonly needsPolicy: boolean;
  private problem: string | undefined;

  constructor(ctx: Ctx) {
    const db = ctx.ws.get("db");
    if (db === ":memory:") this.logChoice = 2;
    else if (db !== undefined && /^postgres(ql)?:\/\//i.test(db)) {
      this.logChoice = 3;
      this.dbUrl.set(db);
    } else if (db !== undefined) {
      this.logChoice = 1;
      this.dbFile.set(db);
    }
    this.owner.set(ctx.ws.get("owner") ?? "");
    this.folder.set(ctx.ws.get("root") ?? "");
    this.needsPolicy = ctx.checks.policy.status === "fail";
    const policy = ctx.ws.get("policy");
    if (policy !== undefined) {
      const i = POLICY_CHOICES.indexOf(policy as never);
      if (i >= 0 && i < 3) this.policyChoice = i;
      else {
        this.policyChoice = 3;
        this.policyFile.set(policy);
      }
    }
    // Open on the question that failed (8.3: "the first-run step that failed").
    this.question =
      ctx.checks.log.status === "fail"
        ? "log"
        : this.needsPolicy
          ? "policy"
          : ctx.checks.actor.status === "fail" && ctx.ws.get("db") !== undefined
            ? "who"
            : "log";
  }

  private questions(): Question[] {
    return this.needsPolicy ? ["log", "policy", "who", "folder"] : ["log", "who", "folder"];
  }

  title(): string {
    const q = this.questions();
    return `Getting started  ${q.indexOf(this.question) + 1} of ${q.length}`;
  }

  focused(): string {
    return this.question;
  }

  /** The text field the current question types into, if any. */
  private field(): TextField | undefined {
    if (this.question === "who") return this.owner;
    if (this.question === "folder") return this.folder;
    if (this.question === "log")
      return this.logChoice === 1 ? this.dbFile : this.logChoice === 3 ? this.dbUrl : undefined;
    if (this.question === "policy") return this.policyChoice === 3 ? this.policyFile : undefined;
    return undefined;
  }

  inField(): boolean {
    return this.field() !== undefined;
  }

  /** The workspace flags the answers amount to. */
  private apply(ctx: Ctx): void {
    const choice = LOG_CHOICES[this.logChoice];
    const db =
      choice?.id === "file"
        ? this.dbFile.value.trim()
        : choice?.id === "postgres"
          ? this.dbUrl.value.trim()
          : choice?.db;
    ctx.ws.set("db", db === "" ? undefined : db, "set");
    ctx.ws.set("owner", this.owner.value.trim(), "set");
    ctx.ws.set("root", this.folder.value.trim(), "set");
    if (this.needsPolicy) {
      const p = POLICY_CHOICES[this.policyChoice];
      ctx.ws.set(
        "policy",
        p === "file" ? this.policyFile.value.trim() : p === "medium" ? undefined : p,
        "set",
      );
    }
    ctx.recheck();
  }

  private folderCheck(ctx: Ctx): CheapCheck | undefined {
    const v = this.folder.value.trim();
    if (v === "") return undefined;
    const path = resolve(ctx.io.cwd, v);
    if (!existsSync(path)) return { status: "fail", detail: `${v} does not exist` };
    if (!statSync(path).isDirectory()) return { status: "fail", detail: `${v} is not a folder` };
    return { status: "ok", detail: `${v} is a folder` };
  }

  private move(ctx: Ctx, step: 1 | -1): void {
    this.apply(ctx);
    const q = this.questions();
    const i = q.indexOf(this.question) + step;
    if (i >= 0 && i < q.length) this.question = q[i] as Question;
  }

  private finish(ctx: Ctx): void {
    this.apply(ctx);
    const c = ctx.checks;
    const failed = (["log", "policy", "actor"] as const).find((k) => c[k].status === "fail");
    if (failed !== undefined) {
      this.problem = `${failed === "actor" ? "who" : failed}: ${c[failed].detail}`;
      this.question =
        failed === "actor" ? "who" : failed === "policy" && this.needsPolicy ? "policy" : "log";
      return;
    }
    this.problem = undefined;
    ctx.save();
    ctx.replace(new LoopScreen());
  }

  async action(name: string, ctx: Ctx): Promise<boolean> {
    this.problem = undefined;
    switch (name) {
      case "next":
        this.move(ctx, 1);
        return true;
      case "prev":
        this.move(ctx, -1);
        return true;
      case "accept":
        if (this.question === this.questions().at(-1)) this.finish(ctx);
        else this.move(ctx, 1);
        return true;
      case "field-up":
      case "field-down": {
        const step = name === "field-up" ? -1 : 1;
        if (this.question === "log")
          this.logChoice = (this.logChoice + step + LOG_CHOICES.length) % LOG_CHOICES.length;
        else if (this.question === "policy")
          this.policyChoice =
            (this.policyChoice + step + POLICY_CHOICES.length) % POLICY_CHOICES.length;
        else this.move(ctx, step);
        this.apply(ctx);
        return true;
      }
      case "doctor":
        this.apply(ctx);
        await runDoctor(ctx);
        return true;
      case "quit":
        ctx.quit();
        return true;
      case "line":
        ctx.say("line mode comes with card E8.15e; engram --help lists the plain commands");
        return true;
    }
    return false;
  }

  raw(data: string, ctx: Ctx): boolean {
    const f = this.field();
    if (f === undefined) return false;
    f.type(data);
    this.apply(ctx);
    return true;
  }

  command(ctx: Ctx): CommandRow {
    const flags = ["db", "policy", "owner", "root"].flatMap((f) => {
      const v = ctx.ws.get(f as never);
      return v === undefined ? [] : [`--${f}`, v];
    });
    if (flags.length === 0)
      return { text: "", note: "(no flags yet: every command takes the CLI's defaults)" };
    return { text: ctx.line(flags).replace(/^engram /, ""), note: "(every command)" };
  }

  hints(): string {
    return "tab next  shift+tab back  enter accept  d doctor";
  }

  private checkLines(ctx: Ctx, name: string, c: CheapCheck | undefined, width: number): string[] {
    if (c === undefined) return [];
    const word = c.status === "ok" ? "ok" : c.status === "fail" ? "fail" : "skip";
    const lines = para(`${name}: ${c.detail}`, width, " ".repeat(12));
    lines[0] = `    ${ctx.theme.status(c.status, word)}  ${(lines[0] ?? "").trimStart()}`;
    return lines;
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const t = ctx.theme;
    const lines: string[] = [];
    const q = this.question;
    const mark = (on: boolean) => (on ? ">" : " ");
    lines.push(" Welcome. A few answers and you are ready.", "");
    lines.push(` ${mark(q === "log")} 1  Where should the event log live?`, "");
    for (const [i, c] of LOG_CHOICES.entries()) {
      const radio = i === this.logChoice ? "(o)" : "( )";
      const focused = q === "log" && i === this.logChoice;
      let extra = "";
      if (c.id === "default") extra = "~/.engram/engram.db";
      if (c.id === "memory") extra = ":memory:";
      if (c.id === "file") extra = `[ ${this.dbFile.render(36, focused)} ]`;
      if (c.id === "postgres") extra = `[ ${this.dbUrl.render(36, focused)} ]`;
      const row = `     ${radio} ${c.label}   ${extra}`;
      lines.push(focused && !this.inField() ? t.reverse(cut(row, width)) : row);
    }
    lines.push("", ...this.checkLines(ctx, "log", ctx.checks.log, width), "");
    let n = 2;
    if (this.needsPolicy) {
      lines.push(` ${mark(q === "policy")} ${n}  Which policy?`);
      for (const [i, p] of POLICY_CHOICES.entries()) {
        const radio = i === this.policyChoice ? "(o)" : "( )";
        const focused = q === "policy" && i === this.policyChoice;
        const extra =
          p === "file"
            ? `a file  [ ${this.policyFile.render(30, focused)} ]`
            : p === "medium"
              ? "medium   the default preset"
              : `${p}   a bundled preset`;
        lines.push(`     ${radio} ${extra}`);
      }
      lines.push(...this.checkLines(ctx, "policy", ctx.checks.policy, width), "");
      n++;
    }
    const owner = this.owner.value.trim();
    lines.push(
      ` ${mark(q === "who")} ${n}  Who are you?          [ ${this.owner.render(16, q === "who")} ]  ${owner === "" ? "your id, such as dana" : ctx.checks.actor.detail}`,
    );
    n++;
    const folder = this.folderCheck(ctx);
    lines.push(
      ` ${mark(q === "folder")} ${n}  Which memory folder?  [ ${this.folder.render(16, q === "folder")} ]  ${folder === undefined ? "optional; enter with it empty skips" : `${t.symbol(folder.status)} ${folder.detail}`}`,
    );
    lines.push("");
    if (this.problem !== undefined)
      lines.push(...para(`${t.status("fail", this.problem)}`, width), "");
    lines.push(
      ...para(
        "Nothing is written until your first read or write. Every answer is a flag: you can type the same thing at the shell next time.",
        width,
      ),
    );
    lines.push(
      "",
      ...para(
        "Using a screen reader? Line mode (L, or ENGRAM_TUI_LINE=1) comes with card E8.15e.",
        width,
      ),
    );
    return rows(lines, height, width);
  }
}
