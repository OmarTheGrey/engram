// A command's generated form and its result (card E8.15b, docs/design/tui.md
// 6.1 and 9.4): one row per control of the registry entry, advanced ones and
// the workspace's flags folded, then Run. The command row shows the command
// as the form stands, kept exact as it changes; ctrl+s, or enter on Run,
// checks it with the CLI's own checks and runs it through `run`, asking
// first where the entry's `writes` says it changes state. The result is the
// command's own output, byte for byte, with its exit code.
import type { CommandSpec, Values } from "../../registry.ts";
import { type Field, Form, type FormError } from "../forms.ts";
import { cut, fit, para, rows, wrap } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { CommandRow, Ctx, Screen } from "../screen.ts";

type Row =
  | { kind: "field"; field: Field }
  | { kind: "fold"; fold: "advanced" | "workspace" }
  | { kind: "run" };

const LABEL = 22;

export class FormScreen implements Screen {
  readonly kind = "form" as const;
  readonly form: Form;
  private focus = 0;
  private open = { advanced: false, workspace: false };
  private error: FormError | undefined;
  private scroll = 0;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    this.form = new Form(spec, ctx.ws, values, positionals);
    // Opened from a pasted command line, show the folds it filled.
    for (const f of this.form.fields) {
      if (f.positional || values[f.name] === undefined) continue;
      if (f.workspace) this.open.workspace = true;
      else if (f.advanced) this.open.advanced = true;
    }
  }

  title(): string {
    return this.form.spec.title;
  }

  private visible(f: Field): boolean {
    return f.name !== "at" || f.positional || this.form.offersAt();
  }

  rowsOf(): Row[] {
    const fields = this.form.fields.filter((f) => this.visible(f));
    const out: Row[] = fields
      .filter((f) => !f.advanced && !f.workspace)
      .map((field) => ({ kind: "field", field }));
    const advanced = fields.filter((f) => f.advanced && !f.workspace);
    if (advanced.length > 0) {
      out.push({ kind: "fold", fold: "advanced" });
      if (this.open.advanced) out.push(...advanced.map((field): Row => ({ kind: "field", field })));
    }
    const workspace = fields.filter((f) => f.workspace);
    if (workspace.length > 0) {
      out.push({ kind: "fold", fold: "workspace" });
      if (this.open.workspace)
        out.push(...workspace.map((field): Row => ({ kind: "field", field })));
    }
    out.push({ kind: "run" });
    return out;
  }

  private current(): Row | undefined {
    const all = this.rowsOf();
    this.focus = Math.max(0, Math.min(this.focus, all.length - 1));
    return all[this.focus];
  }

  focused(): string | undefined {
    const r = this.current();
    return r?.kind === "field" ? r.field.id : r?.kind === "fold" ? `fold:${r.fold}` : "run";
  }

  /** Focuses a field by id, opening its fold. */
  focusField(id: string): void {
    const f = this.form.field(id);
    if (f?.advanced) this.open.advanced = true;
    if (f?.workspace) this.open.workspace = true;
    const at = this.rowsOf().findIndex((r) => r.kind === "field" && r.field.id === id);
    if (at >= 0) this.focus = at;
  }

  inField(): boolean {
    const r = this.current();
    return r?.kind === "field" && !r.field.boolean && r.field.choices === undefined;
  }

  private cycle(field: Field, step: 1 | -1): void {
    const choices = ["", ...(field.choices ?? [])];
    const now = String(this.form.get(field.id));
    const i = choices.indexOf(now);
    this.form.setValue(field.id, choices[(i + step + choices.length) % choices.length] as string);
    this.form.touched.add(field.id);
  }

  async submit(ctx: Ctx): Promise<void> {
    const errors = this.form.validate(ctx.ws, ctx.io);
    this.error = errors[0];
    if (this.error !== undefined) {
      if (this.error.field !== undefined) this.focusField(this.error.field);
      return;
    }
    const argv = this.form.argv(ctx.ws);
    const result = await ctx.act(this.form.spec, argv, this.form.flagValues());
    if (result !== undefined)
      ctx.push(new ResultScreen(this.form.spec, result, this.form.flagValues()));
  }

  async action(name: string, ctx: Ctx): Promise<boolean> {
    const all = this.rowsOf();
    const r = this.current();
    switch (name) {
      case "next":
      case "field-down":
        this.focus = Math.min(all.length - 1, this.focus + 1);
        return true;
      case "prev":
      case "field-up":
        this.focus = Math.max(0, this.focus - 1);
        return true;
      case "submit":
        await this.submit(ctx);
        return true;
      case "leave":
        return this.leave(ctx);
      case "toggle":
      case "accept":
      case "choose-next":
      case "choose-prev": {
        if (r?.kind === "run") {
          if (name === "accept" || name === "toggle") await this.submit(ctx);
          return true;
        }
        if (r?.kind === "fold") {
          if (name !== "choose-prev" && name !== "choose-next")
            this.open[r.fold] = !this.open[r.fold];
          return true;
        }
        if (r?.kind !== "field") return false;
        const f = r.field;
        if (f.boolean && name !== "accept") {
          this.form.setValue(f.id, this.form.get(f.id) !== true);
          this.form.touched.add(f.id);
          return true;
        }
        if (f.choices !== undefined && name !== "accept") {
          this.cycle(f, name === "choose-prev" ? -1 : 1);
          return true;
        }
        if (name === "accept" && f.multiple) {
          const editor = this.form.editors.get(f.id);
          if (editor !== undefined && editor.value.trim() !== "") {
            this.form.setValue(f.id, [...(this.form.get(f.id) as string[]), editor.value.trim()]);
            editor.set("");
            this.form.touched.add(f.id);
            return true;
          }
        }
        if (name === "accept") this.focus = Math.min(all.length - 1, this.focus + 1);
        return true;
      }
    }
    return false;
  }

  /** Back: asks first when the form has input. */
  async leave(ctx: Ctx): Promise<boolean> {
    if (!this.form.dirty()) {
      ctx.pop();
      return true;
    }
    const yes = await ctx.confirm({
      title: "Leave this form?",
      lines: ["What you typed in it is lost. Nothing was run."],
      action: "Leave",
    });
    if (yes) ctx.pop();
    return true;
  }

  raw(data: string): boolean {
    const r = this.current();
    if (r?.kind !== "field") return false;
    const editor = this.form.editors.get(r.field.id);
    if (editor === undefined) return false;
    // Backspace in an empty list entry removes the last value.
    if (r.field.multiple && editor.value === "" && (data === "\x7f" || data === "\b")) {
      const list = this.form.get(r.field.id) as string[];
      this.form.setValue(r.field.id, list.slice(0, -1));
    } else editor.type(data);
    this.form.touched.add(r.field.id);
    this.error = undefined;
    return true;
  }

  command(ctx: Ctx): CommandRow {
    const argv = this.form.argv(ctx.ws);
    if (this.error?.field === undefined) return { argv };
    // The faulty flag marked <here> (docs/design/tui.md 9.4).
    const f = this.form.field(this.error.field);
    const flag = f === undefined ? undefined : f.positional ? undefined : `--${f.name}`;
    const at = flag === undefined ? -1 : argv.indexOf(flag);
    return {
      argv: at < 0 ? argv : [...argv.slice(0, at + 1), "<here>", ...argv.slice(at + 2)],
      note: "(not run: see the form)",
    };
  }

  hints(): string {
    return "tab next  space toggle  ctrl+s run";
  }

  spec(): CommandSpec {
    return this.form.spec;
  }

  private control(_ctx: Ctx, f: Field, focused: boolean, width: number): string {
    const v = this.form.get(f.id);
    if (f.boolean) return v === true ? "[x] on" : "[ ] off";
    if (f.choices !== undefined) {
      const choices = ["", ...f.choices];
      return choices
        .map(
          (c) =>
            `${c === v ? "(o)" : "( )"} ${c === "" ? (f.defaultText === undefined ? "unset" : "default") : c}`,
        )
        .join("  ");
    }
    const editor = this.form.editors.get(f.id);
    const box = `[ ${editor?.render(width - 4, focused) ?? ""} ]`;
    if (f.multiple) {
      const list = v as readonly string[];
      return `${list.length === 0 ? "" : `${list.join(", ")}  `}${box}`;
    }
    return box;
  }

  private hint(f: Field): string {
    const parts: string[] = [];
    if (f.positional) parts.push(f.help);
    else if (f.defaultText !== undefined) parts.push(`default ${f.defaultText}`);
    if (f.multiple) parts.push("enter adds");
    if (f.card !== undefined) parts.push(f.card);
    return parts.join("; ");
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const t = ctx.theme;
    const spec = this.form.spec;
    const head = [` engram ${spec.usage}: ${spec.summary}`, ""];
    if (this.error !== undefined && this.error.field === undefined)
      head.push(...para(`${t.status("fail", this.error.message)}`, width), "");
    const lines: string[] = [];
    let focusLine = 0;
    const inputWidth = Math.max(12, Math.min(44, width - LABEL - 24));
    for (const [i, r] of this.rowsOf().entries()) {
      const on = i === this.focus;
      if (on) focusLine = lines.length;
      const mark = on ? ">" : " ";
      if (r.kind === "fold") {
        const fields = this.form.fields.filter(
          (f) =>
            this.visible(f) && (r.fold === "workspace" ? f.workspace : f.advanced && !f.workspace),
        );
        const glyph = this.open[r.fold] ? t.glyphs.open : t.glyphs.closed;
        const summary =
          r.fold === "workspace"
            ? `Workspace flags  ${fields.flatMap((f) => (this.form.get(f.id) === "" || (Array.isArray(this.form.get(f.id)) && (this.form.get(f.id) as string[]).length === 0) ? [] : [`--${f.name}`])).join(" ") || "none set"}; ctrl+o sets them for every command`
            : `Advanced: ${fields.length} more`;
        const text = ` ${mark} ${glyph} ${summary}`;
        lines.push(on ? t.reverse(fit(text, width)) : text);
        continue;
      }
      if (r.kind === "run") {
        lines.push("");
        if (on) focusLine = lines.length;
        const label = `[ Run: engram ${spec.name
          .split(" ")
          .filter((w) => !w.startsWith("--"))
          .join(" ")} ]`;
        lines.push(`   ${on ? t.reverse(label) : label}   ctrl+s from any field`);
        continue;
      }
      const f = r.field;
      const label = fit(`${f.label}${f.required ? " *" : ""}`, LABEL);
      const control = this.control(ctx, f, on, inputWidth);
      const text = ` ${mark} ${label} ${control}  ${this.hint(f)}`;
      lines.push(on && !this.inField() ? t.reverse(cut(text, width)) : cut(text, width));
      if (this.error?.field === f.id)
        for (const l of wrap(t.status("fail", this.error.message), width - LABEL - 6))
          lines.push(`${" ".repeat(LABEL + 4)}${l}`);
    }
    const room = height - head.length;
    if (focusLine < this.scroll) this.scroll = focusLine;
    if (focusLine >= this.scroll + room) this.scroll = focusLine - room + 1;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, lines.length - room)));
    return rows([...head, ...lines.slice(this.scroll, this.scroll + room)], height, width);
  }
}

/** What the exit code means, in the registry entry's words. */
export const exitMeaning = (spec: CommandSpec, code: number) =>
  spec.exitCodes.find((e) => e.code === code)?.when ?? "";

export class ResultScreen implements Screen {
  readonly kind = "result" as const;
  readonly spec_: CommandSpec;
  result: RunResult;
  private readonly values: Values;
  private offset = 0;

  constructor(spec: CommandSpec, result: RunResult, values: Values) {
    this.spec_ = spec;
    this.result = result;
    this.values = values;
  }

  title(): string {
    return this.spec_.title;
  }

  private lines(width: number): string[] {
    const text = `${this.result.out}${this.result.err}`.replace(/\n$/, "");
    return text === "" ? [" (no output)"] : text.split("\n").flatMap((l) => para(l, width));
  }

  async action(name: string, ctx: Ctx): Promise<boolean> {
    const page = Math.max(1, ctx.rows - 6);
    switch (name) {
      case "up":
        this.offset = Math.max(0, this.offset - 1);
        return true;
      case "down":
        this.offset += 1;
        return true;
      case "page-up":
        this.offset = Math.max(0, this.offset - page);
        return true;
      case "page-down":
        this.offset += page;
        return true;
      case "first":
        this.offset = 0;
        return true;
      case "last":
        this.offset = Number.MAX_SAFE_INTEGER;
        return true;
      case "rerun": {
        const again = await ctx.act(this.spec_, this.result.argv, this.values);
        if (again !== undefined) {
          this.result = again;
          this.offset = 0;
        }
        return true;
      }
      case "leave":
        ctx.pop();
        return true;
    }
    return false;
  }

  inField(): boolean {
    return false;
  }
  raw(): boolean {
    return false;
  }

  command(): CommandRow {
    return { argv: this.result.argv, exit: this.result.code };
  }

  hints(): string {
    return "r run again  up down scroll  q back";
  }

  spec(): CommandSpec {
    return this.spec_;
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const t = ctx.theme;
    const code = this.result.code;
    const kind = code === 0 ? "ok" : code === 2 ? "warn" : "fail";
    const head = [` ${t.status(kind, `exit ${code}`)}  ${exitMeaning(this.spec_, code)}`, ""];
    const body = this.lines(width - 1);
    const room = height - head.length;
    this.offset = Math.max(0, Math.min(this.offset, Math.max(0, body.length - room)));
    const shown = body.slice(this.offset, this.offset + room);
    const below = body.length - this.offset - room;
    if (below > 0) shown[shown.length - 1] = ` ${t.glyphs.open} ${below} more lines: pgdn`;
    return rows([...head, ...shown], height, width);
  }
}
