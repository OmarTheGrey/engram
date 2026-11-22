// The hand-made screens' frame (card E8.15d, docs/design/tui.md 8.9 to 8.15
// and 8.20 to 8.24): a command's form laid out by its screen, every flag of
// its registry entry still reachable (the ones the screen does not place sit
// under "More flags"), the buttons, and the result under them, in the
// screen's rich view, the command's own text (v) or its --json (J). The
// argument vector is the generated form's (./forms.ts), validated by the
// CLI's own checks; running goes through the router's `act`, which asks
// first where the entry's `writes` says so, but for Import, which asks its
// own question (the rows it offers) and then runs through `runNow` (review
// E8.15d-13). Nothing here decides anything:
// what a screen shows of a decision is a field of the answer, or the
// command's own text.
import type { CommandSpec, Values } from "../../registry.ts";
import { type Field, Form, type FormError } from "../forms.ts";
import { clean, cut, fit, para, rows, visibleWidth, wrap } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { CommandRow, Ctx, Screen } from "../screen.ts";
import type { StatusKind } from "../theme.ts";
import { decisionOf, exitMeaning } from "./form.ts";

/** One row of a screen: a field, a screen-level choice, buttons, a fold, a list entry, or text. */
export type Row =
  | { kind: "field"; id: string; label?: string; hint?: string }
  | {
      kind: "choice";
      id: string;
      label: string;
      options: readonly { value: string; label: string }[];
      value: () => string;
      set: (value: string) => void;
    }
  | { kind: "buttons"; buttons: readonly Button[] }
  | { kind: "fold"; id: string }
  | { kind: "item"; id: string; lines: readonly string[]; press?: (ctx: Ctx) => unknown }
  | { kind: "text"; lines: readonly string[] }
  /** A paragraph wrapped at the screen's width when drawn. */
  | { kind: "para"; text: string };

export interface Button {
  id: string;
  label: string;
  press: (ctx: Ctx) => unknown;
}

/** The actions every hand-made screen takes from the key table. */
const BASE_ACTIONS = [
  "next",
  "prev",
  "field-up",
  "field-down",
  "accept",
  "toggle",
  "choose-prev",
  "choose-next",
  "submit",
  "leave",
  "page-up",
  "page-down",
] as const;

const MORE = "fold:more";

/** A line drawn from a focusable unit, so the screen can scroll to it. */
interface Drawn {
  lines: string[];
  /** The line of `lines` that holds the focus, if any. */
  focusLine?: number;
}

export abstract class SurfaceScreen implements Screen {
  readonly kind = "surface" as const;
  readonly form: Form;
  /** The id of the focused unit: a field id, `choice:<id>`, a button id, `fold:more` or an item id. */
  protected focusId: string | undefined;
  protected readonly folds = new Set<string>();
  protected error: FormError | undefined;
  /** The last run's result, shown under the buttons. */
  result: RunResult | undefined;
  /** The view of the result: the screen's own, the command's text, or its --json. */
  view: "rich" | "plain" | "json" = "rich";
  protected json: string | undefined;
  /** A line under the buttons that is not a result: what is running, what was copied. */
  protected note: string | undefined;
  private scroll = 0;
  private follow = true;
  /** The context the screen was opened in: inField, which the router asks with none, reads it. */
  protected readonly ctx: Ctx;

  readonly spec_: CommandSpec;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    this.spec_ = spec;
    this.ctx = ctx;
    this.form = new Form(spec, ctx.ws, values, positionals);
  }

  // What a screen gives.

  abstract title(ctx: Ctx): string;
  /** The rows above "More flags": the fields and choices the screen lays out. */
  protected abstract top(ctx: Ctx): Row[];
  /** The buttons under the form; Run by default. */
  protected buttons(_ctx: Ctx): Button[] {
    return [{ id: "button:run", label: `Run: engram ${this.words()}`, press: (c) => this.run(c) }];
  }
  /** The rows of the result in the screen's own view; the command's text by default. */
  protected rich(_ctx: Ctx, width: number, result: RunResult): Row[] {
    return [{ kind: "text", lines: this.plainLines(result, width) }];
  }
  /** The rows after the result: what the screen says about it, or before a run. */
  protected footer(_ctx: Ctx, _width: number): Row[] {
    return [];
  }
  /** The actions the screen takes beyond the form's (the help overlay lists only these). */
  protected ownActions(): readonly string[] {
    return ["plain", "json", "rerun"];
  }
  /** A screen's own action; true when it acted. */
  protected extra(_name: string, _ctx: Ctx): boolean | Promise<boolean> {
    return false;
  }
  /** A check of the screen's own, before the CLI's: a field the TUI needs that the CLI does not. */
  protected precheck(_ctx: Ctx): FormError | undefined {
    return undefined;
  }
  /** The flags of fields the screen hides by its choices, left out of the command line. */
  protected hidden(): ReadonlySet<string> {
    return new Set();
  }
  /** The --json view of a result: undefined when the screen offers none, with the reason said. */
  protected async jsonOf(_ctx: Ctx, _result: RunResult): Promise<string | undefined> {
    return undefined;
  }
  /** The key hints of the screen, before the ones every screen has. */
  protected keyHints(_ctx: Ctx): string {
    return this.result === undefined ? "tab next  ctrl+s run" : "r again  v plain  J json";
  }

  // The command.

  /** The command's words without the name's flag: "key create", "hook claude-code". */
  protected words(): string {
    return this.spec_.name
      .split(" ")
      .filter((w) => !w.startsWith("--"))
      .join(" ");
  }

  /** The argument vector the form builds, without the flags of hidden fields. */
  argv(ctx: Ctx): string[] {
    return dropFlags(this.form.argv(ctx.ws), this.hidden(), this.form.fields);
  }

  /** Checks, then runs the command through the router (which asks first where it must). */
  async run(ctx: Ctx, argv?: readonly string[]): Promise<RunResult | undefined> {
    if (argv === undefined) {
      const mine = this.precheck(ctx);
      const errors = mine === undefined ? this.form.validate(ctx.ws, ctx.io) : [mine];
      this.error =
        errors.find((e) => e.field === undefined || !this.hidden().has(e.field)) ?? errors[0];
      if (this.error !== undefined) {
        if (this.error.field !== undefined) this.focusField(this.error.field);
        return undefined;
      }
    }
    const result = await this.execute(ctx, argv ?? this.argv(ctx));
    if (result !== undefined) this.show(result);
    return result;
  }

  /** Runs `argv`: `act`, so the confirmation of 9.5 applies. */
  protected execute(ctx: Ctx, argv: readonly string[]): Promise<RunResult | undefined> {
    return ctx.act(this.spec_, argv, this.form.flagValues());
  }

  /** Shows a result in the rich view. */
  show(result: RunResult): void {
    this.result = result;
    this.view = "rich";
    this.json = undefined;
    this.note = undefined;
    this.follow = false;
    this.scroll = Number.MAX_SAFE_INTEGER;
    this.atResult = true;
    // Off the text field the run started from, so the result's keys (v, J, r) act at once.
    const first = this.buttons(this.ctx)[0];
    if (this.inField() && first !== undefined) this.focusId = first.id;
  }
  /** Scroll to the result's first line on the next draw. */
  private atResult = false;
  /** Set when the form's command was used without a run here: a Try it, a copy. */
  protected used = false;
  /** Scroll to the last line on the next draw: what Try it or a start just printed (card E8.15d). */
  protected toEnd = false;

  // Focus.

  /** Every row, in order: the screen's, More flags, the buttons, the result, the footer. */
  protected allRows(ctx: Ctx, width: number): { rows: Row[]; resultAt: number } {
    const out = [...this.top(ctx)];
    const placed = new Set(out.flatMap((r) => (r.kind === "field" ? [r.id] : [])));
    const more = this.moreFields(placed);
    if (more.length > 0) {
      out.push({ kind: "fold", id: MORE });
      if (this.folds.has(MORE)) for (const f of more) out.push({ kind: "field", id: f.id });
    }
    const buttons = this.buttons(ctx);
    if (buttons.length > 0) out.push({ kind: "text", lines: [""] }, { kind: "buttons", buttons });
    if (this.note !== undefined) out.push({ kind: "text", lines: ["", ...para(this.note, width)] });
    const resultAt = out.length;
    if (this.result !== undefined) out.push(...this.resultRows(ctx, width, this.result));
    out.push(...this.footer(ctx, width));
    return { rows: out, resultAt };
  }

  /** The form's fields the screen does not place, nor hide: under More flags. */
  private moreFields(placed: ReadonlySet<string>): Field[] {
    const hidden = this.hidden();
    return this.form.fields.filter(
      (f) =>
        !placed.has(f.id) &&
        !hidden.has(f.name) &&
        (f.name !== "at" || f.positional || this.form.offersAt()),
    );
  }

  private units(ctx: Ctx): string[] {
    const { rows: all } = this.allRows(ctx, Math.max(40, ctx.columns));
    return all.flatMap((r) => unitIds(r));
  }

  private current(ctx: Ctx): string | undefined {
    const units = this.units(ctx);
    if (this.focusId === undefined || !units.includes(this.focusId)) this.focusId = units[0];
    return this.focusId;
  }

  focused(): string | undefined {
    return this.focusId;
  }

  /** Focuses a field by id, opening More flags when it is there. */
  focusField(id: string): void {
    this.focusId = id;
    if (!this.top(this.ctx).some((r) => r.kind === "field" && r.id === id)) this.folds.add(MORE);
    this.follow = true;
  }

  /** Moves the focus a unit; tab and shift+tab wrap around, the arrows stop at the ends. */
  private move(ctx: Ctx, step: 1 | -1, wrap = false): void {
    const units = this.units(ctx);
    const at = Math.max(0, units.indexOf(this.current(ctx) ?? ""));
    const to = wrap
      ? (at + step + units.length) % units.length
      : Math.max(0, Math.min(units.length - 1, at + step));
    this.focusId = units[to];
    this.follow = true;
  }

  /** The row that holds the focused unit. */
  private focusedRow(ctx: Ctx): Row | undefined {
    const id = this.current(ctx);
    return this.allRows(ctx, Math.max(40, ctx.columns)).rows.find((r) =>
      unitIds(r).includes(id ?? ""),
    );
  }

  private fieldOf(r: Row | undefined): Field | undefined {
    return r?.kind === "field" ? this.form.field(r.id) : undefined;
  }

  inField(): boolean {
    const f = this.fieldOf(this.focusedRow(this.ctx));
    return f !== undefined && !f.boolean && f.choices === undefined;
  }

  actions(): readonly string[] {
    return [...BASE_ACTIONS, ...this.ownActions()];
  }

  // Keys.

  async action(name: string, ctx: Ctx): Promise<boolean> {
    const r = this.focusedRow(ctx);
    switch (name) {
      case "next":
        this.move(ctx, 1, true);
        return true;
      case "prev":
        this.move(ctx, -1, true);
        return true;
      case "field-down":
      case "down":
        this.move(ctx, 1);
        return true;
      case "field-up":
      case "up":
        this.move(ctx, -1);
        return true;
      case "page-down":
        this.scroll += Math.max(1, ctx.rows - 6);
        this.follow = false;
        return true;
      case "page-up":
        this.scroll = Math.max(0, this.scroll - Math.max(1, ctx.rows - 6));
        this.follow = false;
        return true;
      case "submit":
        await this.submit(ctx);
        return true;
      case "leave":
        return this.leave(ctx);
      case "plain":
        if (this.result === undefined) return this.nothingYet(ctx);
        this.view = this.view === "plain" ? "rich" : "plain";
        this.scroll = 0;
        return true;
      case "json": {
        if (this.result === undefined) return this.nothingYet(ctx);
        if (this.view === "json") {
          this.view = "rich";
          return true;
        }
        this.json ??= await this.jsonOf(ctx, this.result);
        if (this.json !== undefined) {
          this.view = "json";
          this.scroll = 0;
        }
        return true;
      }
      case "rerun":
        if (this.result === undefined) await this.submit(ctx);
        else await this.run(ctx, this.result.argv);
        return true;
      case "toggle":
      case "accept":
      case "choose-next":
      case "choose-prev":
        return this.press(name, r, ctx);
    }
    return this.extra(name, ctx);
  }

  private nothingYet(ctx: Ctx): boolean {
    ctx.say("nothing has run on this screen yet: ctrl+s runs it");
    return true;
  }

  /** ctrl+s: the screen's first button, Run by default. */
  protected async submit(ctx: Ctx): Promise<void> {
    const first = this.buttons(ctx)[0];
    if (first !== undefined) await first.press(ctx);
  }

  private async press(name: string, r: Row | undefined, ctx: Ctx): Promise<boolean> {
    const id = this.focusId;
    if (r === undefined) return false;
    switch (r.kind) {
      case "buttons": {
        if (name === "choose-next" || name === "choose-prev") {
          this.move(ctx, name === "choose-next" ? 1 : -1);
          return true;
        }
        const b = r.buttons.find((x) => x.id === id);
        if (b !== undefined) await b.press(ctx);
        return true;
      }
      case "fold":
        if (name !== "choose-next" && name !== "choose-prev") {
          if (this.folds.has(r.id)) this.folds.delete(r.id);
          else this.folds.add(r.id);
        }
        return true;
      case "item":
        if (name === "accept" || name === "toggle") await r.press?.(ctx);
        return true;
      case "choice": {
        const values = r.options.map((o) => o.value);
        const at = values.indexOf(r.value());
        const step = name === "choose-prev" ? -1 : 1;
        if (name === "accept") {
          this.move(ctx, 1);
          return true;
        }
        r.set(values[(at + step + values.length) % values.length] as string);
        this.error = undefined;
        this.json = undefined;
        return true;
      }
      case "field": {
        const f = this.form.field(r.id);
        if (f === undefined) return false;
        if (f.boolean && name !== "accept") {
          this.form.setValue(f.id, this.form.get(f.id) !== true);
          this.form.touched.add(f.id);
          return true;
        }
        if (f.choices !== undefined && name !== "accept") {
          const choices = ["", ...f.choices];
          const at = choices.indexOf(String(this.form.get(f.id)));
          const step = name === "choose-prev" ? -1 : 1;
          this.form.setValue(
            f.id,
            choices[(at + step + choices.length) % choices.length] as string,
          );
          this.form.touched.add(f.id);
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
        if (name === "accept") this.move(ctx, 1);
        return true;
      }
      default:
        return false;
    }
  }

  /** Back: asks first when the form has input and nothing has run. */
  protected async leave(ctx: Ctx): Promise<boolean> {
    // After a run, a Try it or a copy, what was typed has been used: leaving does not ask.
    if (!this.form.dirty() || this.result !== undefined || this.used) {
      ctx.pop();
      return true;
    }
    const yes = await ctx.confirm({
      title: "Leave this screen?",
      lines: ["What you typed in it is lost. Nothing was run."],
      action: "Leave",
    });
    if (yes) ctx.pop();
    return true;
  }

  raw(data: string, ctx: Ctx): boolean {
    const r = this.focusedRow(ctx);
    if (r?.kind !== "field") return false;
    const f = this.form.field(r.id);
    const editor = this.form.editors.get(r.id);
    if (f === undefined || editor === undefined || f.boolean || f.choices !== undefined)
      return false;
    if (f.multiple && editor.value === "" && (data === "\x7f" || data === "\b")) {
      const list = this.form.get(r.id) as string[];
      this.form.setValue(r.id, list.slice(0, -1));
    } else editor.type(data);
    this.form.touched.add(r.id);
    this.error = undefined;
    this.json = undefined;
    return true;
  }

  // The command row and the hints.

  command(ctx: Ctx): CommandRow {
    const argv = this.argv(ctx);
    if (this.error?.field !== undefined) {
      const f = this.form.field(this.error.field);
      const flag = f === undefined || f.positional ? undefined : `--${f.name}`;
      const at = flag === undefined ? -1 : argv.indexOf(flag);
      return {
        argv: at < 0 ? argv : [...argv.slice(0, at + 1), "<here>", ...argv.slice(at + 2)],
        note: "(not run: see the form)",
      };
    }
    const shown = this.view === "json" && this.result !== undefined ? [...argv, "--json"] : argv;
    const same = this.result !== undefined && sameArgv(this.result.argv, argv);
    return same ? { argv: shown, exit: (this.result as RunResult).code } : { argv: shown };
  }

  hints(ctx: Ctx): string {
    // In a text field only keys that type nothing act: tab, and ctrl+s for the first button.
    if (!this.inField()) return this.keyHints(ctx);
    return `tab next  ctrl+s ${this.submitLabel(ctx)}`;
  }
  /** What ctrl+s does, in the hints: the first button's word by default. */
  protected submitLabel(ctx: Ctx): string {
    const first = this.buttons(ctx)[0];
    return first === undefined ? "run" : (first.label.split(":")[0] ?? "run").toLowerCase();
  }

  spec(): CommandSpec {
    return this.spec_;
  }

  // Drawing.

  /** The command's text, cleaned of control characters, wrapped at `width`. */
  protected plainLines(result: RunResult, width: number): string[] {
    const text = clean(`${result.out}${result.err}`).replace(/\n$/, "");
    return text === "" ? [" (no output)"] : text.split("\n").flatMap((l) => para(l, width));
  }

  /** The result's status line: the decision the answer carries, else the exit code, and its meaning. */
  protected status(ctx: Ctx, result: RunResult): string {
    const t = ctx.theme;
    const code = result.code;
    const kind: StatusKind = code === 0 ? "ok" : code === 2 ? "warn" : "fail";
    const decision = decisionOf(result);
    const meaning = exitMeaning(this.spec_, code);
    return decision === undefined
      ? ` ${t.status(kind, `exit ${code}`)}  ${meaning}`
      : ` ${t.status(decision, decision)}   exit ${code}  ${meaning}`;
  }

  private resultRows(ctx: Ctx, width: number, result: RunResult): Row[] {
    const head: Row = { kind: "text", lines: ["", this.status(ctx, result), ""] };
    if (this.view === "plain")
      return [head, { kind: "text", lines: this.plainLines(result, width) }];
    if (this.view === "json")
      return [
        head,
        {
          kind: "text",
          lines: clean(this.json ?? "")
            .replace(/\n$/, "")
            .split("\n")
            .flatMap((l) => para(l, width)),
        },
      ];
    return [head, ...this.rich(ctx, width, result)];
  }

  /** A field's control: its editor, toggle, choices or list. */
  private control(f: Field, focused: boolean, width: number): string {
    const v = this.form.get(f.id);
    if (f.boolean) return v === true ? "[x] on" : "[ ] off";
    if (f.choices !== undefined)
      return ["", ...f.choices]
        .map(
          (c) =>
            `${c === v ? "(o)" : "( )"} ${c === "" ? (f.defaultText === undefined ? "unset" : "default") : c}`,
        )
        .join("  ");
    const editor = this.form.editors.get(f.id);
    const box = `[ ${editor?.render(width, focused) ?? ""} ]`;
    if (!f.multiple) return box;
    const list = v as readonly string[];
    return `${list.length === 0 ? "" : `${list.join(", ")}  `}${box}`;
  }

  private hintOf(f: Field, given: string | undefined): string {
    if (given !== undefined) return given;
    const parts: string[] = [];
    if (f.defaultText !== undefined) parts.push(`default ${f.defaultText}`);
    else if (f.positional) parts.push(f.help);
    if (f.multiple) parts.push("enter adds");
    return parts.join("; ");
  }

  private draw(ctx: Ctx, r: Row, width: number): Drawn {
    const t = ctx.theme;
    const focus = this.focusId;
    const LABEL = this.labelWidth;
    switch (r.kind) {
      case "text":
        return { lines: r.lines.map((l) => cut(l, width)) };
      case "para":
        return { lines: para(r.text, width) };
      case "fold": {
        const more = this.moreFields(
          new Set(this.top(ctx).flatMap((x) => (x.kind === "field" ? [x.id] : []))),
        );
        const set = more.filter((f) => {
          const v = this.form.get(f.id);
          return v !== "" && v !== false && !(Array.isArray(v) && v.length === 0);
        });
        const glyph = this.folds.has(r.id) ? t.glyphs.open : t.glyphs.closed;
        const on = focus === r.id;
        const text = ` ${on ? ">" : " "} ${glyph} More flags: ${more.length}${set.length === 0 ? "" : `, set: ${set.map((f) => (f.positional ? f.label : `--${f.name}`)).join(" ")}`}`;
        return {
          lines: [on ? t.reverse(cut(text, width)) : cut(text, width)],
          focusLine: on ? 0 : undefined,
        };
      }
      case "buttons": {
        const parts = r.buttons.map((b) => {
          const label = `[ ${b.label} ]`;
          return b.id === focus ? t.reverse(label) : label;
        });
        // Buttons that do not fit on one line go on the next.
        const lines: string[] = [];
        let line = "";
        let focusLine: number | undefined;
        r.buttons.forEach((b, i) => {
          const part = parts[i] as string;
          const next = line === "" ? ` ${part}` : `${line}  ${part}`;
          if (line !== "" && visibleWidth(next) > width) {
            lines.push(line);
            line = ` ${part}`;
          } else line = next;
          if (b.id === focus) focusLine = lines.length;
        });
        lines.push(line);
        return { lines, focusLine };
      }
      case "item": {
        const on = focus === r.id;
        const lines = r.lines.map((l, i) =>
          i === 0 ? cut(`${on ? ">" : " "}${l}`, width) : cut(` ${l}`, width),
        );
        if (on && lines[0] !== undefined) lines[0] = t.reverse(fit(lines[0], width));
        return { lines, focusLine: on ? 0 : undefined };
      }
      case "choice": {
        const on = focus === `choice:${r.id}`;
        const label = fit(r.label, LABEL);
        const opts = r.options.map((o) => `${o.value === r.value() ? "(o)" : "( )"} ${o.label}`);
        const one = ` ${on ? ">" : " "} ${label} ${opts.join("   ")}`;
        let lines: string[];
        if (visibleWidth(one) <= width) lines = [one];
        else
          lines = opts.flatMap((o, i) =>
            wrap(o, width - LABEL - 4).map(
              (w, j) =>
                `${i === 0 && j === 0 ? ` ${on ? ">" : " "} ${label} ` : " ".repeat(LABEL + 4)}${j === 0 ? "" : "    "}${w}`,
            ),
          );
        if (on) lines = lines.map((l) => t.reverse(fit(l, width)));
        return { lines, focusLine: on ? 0 : undefined };
      }
      case "field": {
        const f = this.form.field(r.id);
        if (f === undefined) return { lines: [] };
        const on = focus === r.id;
        const inText = on && !f.boolean && f.choices === undefined;
        const label = fit(`${r.label ?? f.label}${f.required ? " *" : ""}`, LABEL);
        const hint = this.hintOf(f, r.hint);
        // One input width a screen, so the boxes line up; a hint that does not fit is cut.
        const inputWidth = Math.max(16, Math.min(40, width - LABEL - 40));
        const text = ` ${on ? ">" : " "} ${label} ${this.control(f, on, inputWidth)}  ${hint}`;
        const lines = [on && !inText ? t.reverse(cut(text, width)) : cut(text, width)];
        if (this.error?.field === f.id)
          for (const l of wrap(t.status("fail", this.error.message), width - LABEL - 5))
            lines.push(`${" ".repeat(LABEL + 4)}${l}`);
        return { lines, focusLine: on ? 0 : undefined };
      }
    }
  }

  /** The label column: as wide as the longest label laid out, from 12 to 24 columns. */
  private labelWidth = 18;

  render(ctx: Ctx, width: number, height: number): string[] {
    this.current(ctx);
    const { rows: all, resultAt } = this.allRows(ctx, width - 1);
    const labels = all.flatMap((r) => {
      if (r.kind === "choice") return [r.label.length];
      if (r.kind !== "field") return [];
      const f = this.form.field(r.id);
      return f === undefined ? [] : [(r.label ?? f.label).length + (f.required ? 2 : 0)];
    });
    this.labelWidth = Math.min(24, Math.max(12, ...labels));
    const lines: string[] = [];
    if (this.error !== undefined && this.error.field === undefined)
      lines.push(...para(ctx.theme.status("fail", this.error.message), width), "");
    let focusLine = -1;
    let focusEnd = -1;
    let resultLine = -1;
    all.forEach((r, i) => {
      if (i === resultAt) resultLine = lines.length;
      const d = this.draw(ctx, r, width);
      if (d.focusLine !== undefined) {
        focusLine = lines.length + d.focusLine;
        // An item's lines are all its own; other rows' focus is one line.
        focusEnd = r.kind === "item" ? lines.length + d.lines.length - 1 : focusLine;
      }
      lines.push(...d.lines);
    });
    if (this.toEnd) {
      this.scroll = Math.max(0, lines.length - height);
      this.toEnd = false;
      this.follow = false;
    } else if (this.atResult && resultLine >= 0) {
      // A new result scrolls into view, the form above it kept where it fits.
      this.scroll = lines.length <= height ? 0 : Math.min(resultLine, lines.length - height);
      this.atResult = false;
    } else if (this.follow && focusLine >= 0) {
      // The whole focused unit in view, clear of the lines that say more is above or below.
      const end = Math.min(focusEnd, focusLine + height - 3);
      if (end > this.scroll + height - 2) this.scroll = end - height + 2;
      if (focusLine < this.scroll + 1) this.scroll = Math.max(0, focusLine - 1);
    }
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, lines.length - height)));
    const shown = lines.slice(this.scroll, this.scroll + height);
    const below = lines.length - this.scroll - height;
    if (below > 0) shown[height - 1] = ` ${ctx.theme.glyphs.open} ${below} more lines: pgdn`;
    if (this.scroll > 0 && shown.length > 0) shown[0] = `   ${this.scroll} more above: pgup`;
    return rows(shown, height, width);
  }
}

/** The focusable units of a row. */
function unitIds(r: Row): string[] {
  switch (r.kind) {
    case "field":
      return [r.id];
    case "choice":
      return [`choice:${r.id}`];
    case "buttons":
      return r.buttons.map((b) => b.id);
    case "fold":
      return [r.id];
    case "item":
      return [r.id];
    default:
      return [];
  }
}

/** `argv` without the flags named (and their values), as the form wrote them. */
export function dropFlags(
  argv: readonly string[],
  flags: ReadonlySet<string>,
  fields: readonly Field[],
): string[] {
  if (flags.size === 0) return [...argv];
  const takesValue = new Set(fields.filter((f) => !f.boolean).map((f) => f.name));
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const w = argv[i] as string;
    if (w.startsWith("--") && flags.has(w.slice(2))) {
      if (takesValue.has(w.slice(2))) i++;
      continue;
    }
    out.push(w);
  }
  return out;
}

const sameArgv = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((w, i) => w === b[i]);

/** The JSON of the last call to `path`, as the command prints it with --json (`json(report)`). */
export function bodyJson(result: RunResult, path: string): string | undefined {
  const call = [...result.calls].reverse().find((c) => c.path === path && c.status === 200);
  return call === undefined ? undefined : `${JSON.stringify(call.body, null, 2)}\n`;
}

/** Session state the screens share: the Serve screen's answers, which Doctor and the hook read. */
export interface Shared {
  /** The bind and credential flags Serve last built, for Doctor (8.12). */
  serve?: Record<string, string | boolean>;
  /** The log Serve's --db named, absolute, for the hook's --protect (8.15). */
  serveDb?: string;
}
const shared = new WeakMap<object, Shared>();
/** The screens' shared state for this session. */
export function sharedOf(ctx: Ctx): Shared {
  let s = shared.get(ctx);
  if (s === undefined) {
    s = {};
    shared.set(ctx, s);
  }
  return s;
}
