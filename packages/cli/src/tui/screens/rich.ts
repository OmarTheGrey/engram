// What the memory and audit screens share (card E8.15c, docs/design/tui.md
// 8.5 to 8.8, 8.16 to 8.19, 8.22, 8.26, 9 and 10). Each screen is a command's
// form laid out by hand over the registry's own Form (the same argument
// vector, the same checks), a result read from the answer the command's one
// call returned, and the plain and JSON views, which show the command's own
// output byte for byte (v and J). Nothing here decides anything: a decision,
// a reason and a policy id are shown as the answer carries them, the first
// line of every result is the decision, and every text from the plane or a
// command passes `safe` (no control character, no URL's secrets).
import { sliceByColumn } from "@earendil-works/pi-tui";
import type { Actor, MemoryItem, ReadResponse } from "@engram/sdk";
import { contentText } from "@engram/view";
import type { CommandSpec, Values } from "../../registry.ts";
import { redactSecrets } from "../../setup.ts";
import { actorNow, madeAsLines, madeAsOther } from "../actor.ts";
import type { TextField } from "../fields.ts";
import { type Field, type FieldValue, Form, type FormError } from "../forms.ts";
import { box, clean, cut, fit, para, rows, visibleWidth, wrap } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { CommandRow, Ctx, Screen, ScreenKind } from "../screen.ts";
import type { StatusKind, Theme } from "../theme.ts";
import { decisionOf, exitMeaning } from "./form.ts";

const URL = /[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi;

/** Text from the plane or a command as the TUI draws it: no control character, no URL's secrets. */
export function safe(text: string): string {
  let out = clean(text);
  for (const url of out.match(URL) ?? []) out = redactSecrets(out, url);
  return out;
}

/** One line of text as a single row: newlines as spaces. */
export const oneLine = (text: string) => safe(text).replace(/\s*\n\s*/g, " ");

/** The JSON body of the last call to a route that answered 2xx, as the command received it. */
export function answerOf<T>(r: RunResult | undefined, route: RegExp): T | undefined {
  for (const c of [...(r?.calls ?? [])].reverse())
    if (route.test(c.path) && c.status >= 200 && c.status < 300) return c.body as T;
  return undefined;
}

/** The JSON body a command sent to a route, as it sent it. */
export function requestOf<T>(r: RunResult | undefined, route: RegExp): T | undefined {
  for (const c of [...(r?.calls ?? [])].reverse()) if (route.test(c.path)) return c.request as T;
  return undefined;
}

/** A decision as a status word: allow, deny or ask, its symbol coloured (10.1). */
export const statusOf = (d: string): StatusKind =>
  d === "allow" ? "allow" : d === "ask" ? "ask" : "deny";

/**
 * The first line of a result: the decision the answer carries, then the exit
 * code the plain command returns and what the registry says it means (10.1).
 */
export function decisionHead(t: Theme, spec: CommandSpec, r: RunResult): string {
  const d = decisionOf(r);
  const code = r.code;
  const kind = code === 0 ? "ok" : code === 2 ? "warn" : "fail";
  const meaning = exitMeaning(spec, code);
  return d === undefined
    ? ` ${t.status(kind, `exit ${code}`)}  ${meaning}`
    : ` ${t.status(d, d)}   exit ${code}  ${meaning}`;
}

/** The error a command printed (its stderr), verbatim but for control characters and secrets. */
export function errorLines(r: RunResult, width: number): string[] {
  const text = safe(r.err).replace(/\n$/, "");
  return text === "" ? [] : text.split("\n").flatMap((l) => para(l, width, "   "));
}

/** The command's own text output, each line wrapped with a two-space hanging indent (8.7). */
export function outputLines(r: RunResult, width: number): string[] {
  const text = safe(r.out).replace(/\n$/, "");
  if (text === "") return [];
  return text.split("\n").flatMap((l) => {
    const first = wrap(l, width - 1)[0] ?? "";
    // The rest of the line as it is, wrapped again: a word cut at the width is not split by a space.
    const tail = l.slice(first.length).replace(/^ /, "");
    return [` ${first}`, ...(tail === "" ? [] : para(tail, width, "   "))];
  });
}

/**
 * The plain and JSON views (docs/design/tui.md 8.5, 9.1): the command's text
 * output and its --json output as the CLI prints them, from the one call the
 * screen made, unwrapped and scrollable both ways.
 */
export class Views {
  mode: "rich" | "plain" | "json" = "rich";
  private top = 0;
  private left = 0;

  /** The keys a view takes while open, and v and J always; true when it took the key. */
  action(name: string, result: RunResult | undefined, ctx: Ctx): boolean {
    if (name === "plain" || name === "json") {
      if (result === undefined) {
        ctx.say("nothing has run on this screen yet: run it first");
        return true;
      }
      this.mode = this.mode === name ? "rich" : name;
      this.top = 0;
      this.left = 0;
      return true;
    }
    if (this.mode === "rich") return false;
    const page = Math.max(1, ctx.rows - 6);
    switch (name) {
      case "back":
      case "leave":
        this.mode = "rich";
        return true;
      case "up":
        this.top = Math.max(0, this.top - 1);
        return true;
      case "down":
        this.top += 1;
        return true;
      case "page-up":
        this.top = Math.max(0, this.top - page);
        return true;
      case "page-down":
        this.top += page;
        return true;
      case "first":
        this.top = 0;
        this.left = 0;
        return true;
      case "last":
        this.top = Number.MAX_SAFE_INTEGER;
        return true;
      case "choose-prev":
        this.left = Math.max(0, this.left - 8);
        return true;
      case "choose-next":
        this.left += 8;
        return true;
    }
    // Every other key waits until the view is closed.
    return true;
  }

  render(ctx: Ctx, r: RunResult, width: number, height: number): string[] {
    const json = this.mode === "json";
    const text = json
      ? (r.other ??
        (r.code !== 0
          ? `The command failed before it printed (exit ${r.code}):\n${r.err}`
          : "This command prints no --json output.\n"))
      : `${r.out}${r.err}` || "(no output)\n";
    const lines = safe(text).replace(/\n$/, "").split("\n");
    const head = [
      cut(
        ` ${json ? "JSON view: the --json output" : "Plain view: the text output"}, byte for byte as engram prints it. ${json ? "J" : "v"} or esc goes back; left and right scroll sideways`,
        width,
      ),
      "",
    ];
    const room = height - head.length;
    this.top = Math.max(0, Math.min(this.top, Math.max(0, lines.length - room)));
    const shown = lines
      .slice(this.top, this.top + room)
      .map((l) => ` ${sliceByColumn(l, this.left, width - 1)}`);
    const below = lines.length - this.top - room;
    if (below > 0) shown[shown.length - 1] = ` ${ctx.theme.glyphs.open} ${below} more lines: pgdn`;
    return rows([...head, ...shown], height, width);
  }
}

/** A place focus can stop on a rich screen: a form field, a button, or a list the screen draws. */
export type Stop =
  | { kind: "field"; id: string }
  | { kind: "button"; id: string; label: string }
  | { kind: "list"; id: string };

/** A field's control as the generated form draws it (./form.ts), from the registry's Form. */
export function control(form: Form, f: Field, focused: boolean, width: number): string {
  const v = form.get(f.id);
  if (f.boolean) return v === true ? "[x] on" : "[ ] off";
  if (f.choices !== undefined)
    return ["", ...f.choices]
      .map(
        (c) =>
          `${c === v ? "(o)" : "( )"} ${c === "" ? `default${f.defaultText ? ` (${f.defaultText})` : ""}` : c}`,
      )
      .join("  ");
  const editor = form.editors.get(f.id);
  const box = `[ ${editor?.render(width, focused) ?? ""} ]`;
  if (f.multiple) {
    const list = v as readonly string[];
    return `${list.length === 0 ? "" : `${list.join(", ")}  `}${box}`;
  }
  return box;
}

/**
 * The base of every memory and audit screen: the registry's Form for the
 * command, the result of its last run, the plain and JSON views, and focus
 * over the screen's stops. A screen names its stops, draws its body, and
 * acts on the keys the base does not take.
 */
export abstract class RichScreen implements Screen {
  abstract readonly kind: ScreenKind;
  readonly command_: CommandSpec;
  form: Form;
  /** The last run of this screen's command, if any. */
  result: RunResult | undefined;
  /** The form changed since that run: the command row shows the command as it now stands. */
  protected edited = false;
  protected readonly views = new Views();
  private at = 0;
  /** The focused stop's index; a move by the screen is taken as it is. */
  protected get focus(): number {
    return this.at;
  }
  protected set focus(i: number) {
    this.at = i;
    this.held = false;
  }
  protected error: FormError | undefined;
  /** The screen has left the stack (./screen.ts close). */
  protected closed = false;
  /** Text fields of the screen's own that are no flag of the command (the reviewer's principal). */
  protected readonly extras = new Map<string, TextField>();

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
  ) {
    this.command_ = spec;
    this.form = new Form(spec, ctx.ws, values, positionals);
  }

  /** The stops, in focus order. */
  abstract stops(): Stop[];
  /** The body in the rich view. */
  protected abstract body(ctx: Ctx, width: number, height: number): string[];
  /**
   * The actor this screen's answer was made as, when it is not the actor now
   * (card E8.15c review, findings 1 and 2): the screen then draws no part of
   * it. A screen with more than one answer names each.
   */
  protected staleAs(ctx: Ctx): string | undefined {
    return madeAsOther(ctx.ws, this.result);
  }

  /** The answer to draw: the last run's, unless it was made as another actor. */
  protected answerNow(ctx: Ctx): RunResult | undefined {
    return this.staleAs(ctx) === undefined ? this.result : undefined;
  }

  /** A key the base did not take. */
  protected abstract onKey(
    name: string,
    ctx: Ctx,
    stop: Stop | undefined,
  ): Promise<boolean> | boolean;

  title(): string {
    return this.command_.title;
  }
  spec(): CommandSpec {
    return this.command_;
  }
  close(): void {
    this.closed = true;
  }

  /** The id of the stop focused last, so focus stays on it when the stops before it change. */
  private focusId: string | undefined;

  protected current(): Stop | undefined {
    const all = this.stops();
    if (this.focusId !== undefined && all[this.at]?.id !== this.focusId && this.held) {
      const at = all.findIndex((s) => s.id === this.focusId);
      if (at >= 0) this.at = at;
    }
    this.at = Math.max(0, Math.min(this.at, all.length - 1));
    this.focusId = all[this.at]?.id;
    this.held = true;
    return all[this.at];
  }

  /** Whether `focus` was set through current() since the last move, so an id lookup is right. */
  private held = false;

  /** Focuses a stop by id; false when the screen has none of that id now. */
  focusOn(id: string): boolean {
    const at = this.stops().findIndex((s) => s.id === id);
    if (at < 0) return false;
    this.focus = at;
    return true;
  }

  focused(): string | undefined {
    return this.current()?.id;
  }

  /** esc, or q outside a field: back, asking first where a screen has unsent input. */
  protected async leave(ctx: Ctx): Promise<boolean> {
    ctx.pop();
    return true;
  }

  protected field(id: string): Field | undefined {
    return this.form.field(id);
  }

  inField(): boolean {
    if (this.views.mode !== "rich") return false;
    const s = this.current();
    if (s?.kind !== "field") return false;
    if (this.extras.has(s.id)) return true;
    const f = this.field(s.id);
    return f !== undefined && !f.boolean && f.choices === undefined;
  }

  /** A value changed by the person: the command row follows it, the screen may react. */
  protected changed(_ctx: Ctx): void {
    this.edited = true;
    this.error = undefined;
  }

  protected set(id: string, v: FieldValue): void {
    this.form.setValue(id, v);
    this.form.touched.add(id);
  }

  async action(name: string, ctx: Ctx): Promise<boolean> {
    const stale = this.staleAs(ctx);
    if (stale !== undefined && STALE_KEYS.has(name)) {
      ctx.say(`that answer was made as ${stale}; r runs it again as you`);
      return true;
    }
    if (stale !== undefined) this.views.mode = "rich";
    if (this.views.action(name, stale === undefined ? this.result : undefined, ctx)) return true;
    const stop = this.current();
    const n = this.stops().length;
    switch (name) {
      case "next":
        this.focus = (this.focus + 1) % Math.max(1, n);
        return true;
      case "prev":
        this.focus = (this.focus - 1 + Math.max(1, n)) % Math.max(1, n);
        return true;
      case "back":
      case "leave":
        return this.leave(ctx);
    }
    if (stop?.kind === "field") {
      const f = this.field(stop.id);
      if (
        f !== undefined &&
        (name === "toggle" || name === "choose-next" || name === "choose-prev")
      ) {
        if (f.boolean) this.set(f.id, this.form.get(f.id) !== true);
        else if (f.choices !== undefined) {
          const choices = ["", ...f.choices];
          const i = choices.indexOf(String(this.form.get(f.id)));
          const step = name === "choose-prev" ? -1 : 1;
          this.set(f.id, choices[(i + step + choices.length) % choices.length] as string);
        } else return this.onKey(name, ctx, stop);
        this.changed(ctx);
        return true;
      }
      if (f?.multiple && name === "accept") {
        const editor = this.form.editors.get(f.id);
        if (editor !== undefined && editor.value.trim() !== "") {
          this.set(f.id, [...(this.form.get(f.id) as string[]), editor.value.trim()]);
          editor.set("");
          this.changed(ctx);
          return true;
        }
      }
    }
    return this.onKey(name, ctx, stop);
  }

  raw(data: string, ctx: Ctx): boolean {
    if (this.views.mode !== "rich") return false;
    const s = this.current();
    if (s?.kind !== "field") return false;
    const own = this.extras.get(s.id);
    if (own !== undefined) {
      own.type(data);
      this.error = undefined;
      return true;
    }
    const f = this.field(s.id);
    const editor = this.form.editors.get(s.id);
    if (f === undefined || editor === undefined) return false;
    if (f.multiple && editor.value === "" && (data === "\x7f" || data === "\b"))
      this.set(f.id, (this.form.get(f.id) as string[]).slice(0, -1));
    else editor.type(data);
    this.form.touched.add(f.id);
    this.changed(ctx);
    return true;
  }

  /** The command as the form now stands, the faulty flag marked <here> (9.4). */
  protected argvNow(ctx: Ctx): string[] {
    return this.form.argv(ctx.ws);
  }

  command(ctx: Ctx): CommandRow {
    if (this.staleAs(ctx) !== undefined) return { argv: this.argvNow(ctx) };
    if (this.result !== undefined && !this.edited)
      return { argv: this.result.argv, exit: this.result.code };
    const argv = this.argvNow(ctx);
    if (this.error?.field === undefined) return { argv };
    const f = this.form.field(this.error.field);
    const flag = f === undefined || f.positional ? undefined : `--${f.name}`;
    const at = flag === undefined ? -1 : argv.indexOf(flag);
    return {
      argv: at < 0 ? argv : [...argv.slice(0, at + 1), "<here>", ...argv.slice(at + 2)],
      note: "(not run: see the form)",
    };
  }

  /**
   * Checks the form with the CLI's own checks and runs its command through
   * the router (asking first where the registry says it changes state); the
   * result is kept, and undefined is returned when it did not run.
   */
  protected async run(
    ctx: Ctx,
    argv: readonly string[] = this.argvNow(ctx),
    extra: readonly string[] = [],
  ): Promise<RunResult | undefined> {
    const errors = this.form.validate(ctx.ws, ctx.io);
    this.error = errors[0];
    if (this.error !== undefined) {
      if (this.error.field !== undefined) this.focusOn(this.error.field);
      return undefined;
    }
    const result = await ctx.act(this.command_, argv, this.form.flagValues(), extra);
    if (result === undefined) return undefined;
    this.result = result;
    this.edited = false;
    this.views.mode = "rich";
    return result;
  }

  /** The form's error, where it names no field: at the top, in the CLI's words. */
  protected errorHead(ctx: Ctx, width: number): string[] {
    if (this.error === undefined) return [];
    const where =
      this.error.field === undefined ? "" : ` (${this.field(this.error.field)?.label ?? ""})`;
    return para(`${ctx.theme.status("fail", this.error.message)}${where}`, width);
  }

  /** One field as a labelled row, the focus marked. */
  protected fieldRow(ctx: Ctx, id: string, width: number, label = 14, hint?: string): string {
    const f = this.field(id);
    if (f === undefined) return "";
    const on = this.current()?.id === id && this.views.mode === "rich";
    const inputWidth = Math.max(10, Math.min(40, width - label - 30));
    const text = ` ${on ? ">" : " "} ${fit(f.label, label)} ${control(this.form, f, on, inputWidth)}  ${hint ?? (f.defaultText ? `default ${f.defaultText}` : f.help)}`;
    return on && !this.inField() ? ctx.theme.reverse(cut(text, width)) : cut(text, width);
  }

  /** Whether the Advanced fold is open: the advanced flags and this command's workspace flags. */
  protected advancedOpen = false;

  /** The fold's stops: the button, then, when open, every advanced or workspace field (--at only with the test clock). */
  protected advancedStops(): Stop[] {
    const out: Stop[] = [{ kind: "button", id: "advanced", label: "Advanced" }];
    if (!this.advancedOpen) return out;
    for (const f of this.form.fields) {
      if (f.positional || !(f.advanced || f.workspace)) continue;
      if (f.name === "at" && !this.form.offersAt()) continue;
      out.push({ kind: "field", id: f.id });
    }
    return out;
  }

  /** The fold's lines: its button and, when open, its fields. */
  protected advancedLines(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const fields = this.advancedStops().slice(1);
    const glyph = this.advancedOpen ? t.glyphs.open : t.glyphs.closed;
    const on = this.current()?.id === "advanced";
    const head = ` ${on ? ">" : " "} ${glyph} Advanced${this.advancedOpen ? "" : ": id, the test clock and this command's workspace flags"}`;
    return [
      on ? t.reverse(cut(head, width)) : cut(head, width),
      ...fields.map((s) => this.fieldRow(ctx, s.id, width, 20)),
    ];
  }

  /** One of the screen's own text fields as a labelled row. */
  protected extraRow(_ctx: Ctx, id: string, label: string, width: number, hint: string): string {
    const on = this.current()?.id === id;
    const editor = this.extras.get(id);
    const inputWidth = Math.max(10, Math.min(40, width - label.length - 30));
    return cut(
      ` ${on ? ">" : " "} ${fit(label, 14)} [ ${editor?.render(inputWidth, on) ?? ""} ]  ${hint}`,
      width,
    );
  }

  /** A button, reverse video when focused. */
  protected button(ctx: Ctx, id: string, label: string): string {
    const on = this.current()?.id === id;
    return on ? ctx.theme.reverse(`[ ${label} ]`) : `[ ${label} ]`;
  }

  hints(_ctx: Ctx): string {
    if (this.views.mode !== "rich") return "up down pgup pgdn scroll  left right sideways";
    return this.ownHints();
  }

  /** The screen's own key hints in the rich view. */
  protected abstract ownHints(): string;

  /** Whether the screen keeps its form on screen when its answer is another actor's (Write, Promote, Grants). */
  protected readonly keepsForm: boolean = false;

  /** What a form-keeping screen forgets with an answer made as another actor (Grants: its undo). */
  protected forgetAnswer(): void {
    this.result = undefined;
    this.edited = false;
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const stale = this.staleAs(ctx);
    // A form stays: the answer made as another actor goes, and ctrl+s runs the form as the actor now.
    if (stale !== undefined && this.keepsForm) this.forgetAnswer();
    else if (stale !== undefined) {
      const now = actorNow(ctx.ws)?.id;
      return rows(["", ...madeAsLines(stale, now).flatMap((l) => para(l, width))], height, width);
    }
    if (this.views.mode !== "rich" && this.result !== undefined)
      return this.views.render(ctx, this.result, width, height);
    return rows(this.body(ctx, width, height), height, width);
  }
}

/** The keys that would act on an answer made as another actor: refused, with why (card E8.15c review). */
const STALE_KEYS = new Set([
  "plain",
  "json",
  "explain",
  "item",
  "promote",
  "grants",
  "who",
  "supersede",
  "undo",
  "follow",
]);

/** A list's visible window: `selected` kept in view among `count` rows of `room`. */
export function windowOf(selected: number, count: number, room: number, start: number): number {
  if (count <= room) return 0;
  let s = Math.max(0, Math.min(start, count - room));
  if (selected < s) s = selected;
  if (selected >= s + room) s = selected - room + 1;
  return s;
}

/** Lines in a box, cut to fit, with a line saying how many more there are. */
export function boxed(
  theme: Theme,
  title: string,
  lines: readonly string[],
  width: number,
  height: number,
): string[] {
  const inner = height - 2;
  if (inner <= 0) return [];
  const shown = lines.slice(0, inner);
  if (lines.length > inner)
    shown[inner - 1] =
      ` ${theme.glyphs.open} ${lines.length - inner + 1} more: tab to this pane, then up and down`;
  return box(theme, title, shown, width, height);
}

/** The width of a column of labels, for lining up rows. */
export const labelWidth = (labels: readonly string[]) =>
  Math.max(...labels.map((l) => visibleWidth(l)));

// The session: what this session's commands returned, read for pickers and
// the item page. Only answers made to the actor now acting are used, so a
// change of actor (the workspace panel, the reviewer handoff) never shows one
// viewer what the plane returned to another.

/** The actor the workspace names now, built as every command builds it; undefined when none. */
export function viewerOf(ctx: Ctx): Actor | undefined {
  return actorNow(ctx.ws);
}

/** The session's results whose call was made as `actorId`, newest first. */
export function resultsAs(ctx: Ctx, actorId: string | undefined): RunResult[] {
  if (actorId === undefined) return [];
  return [...ctx.results]
    .reverse()
    .filter((r) =>
      r.calls.some(
        (c) => (c.request as { actor?: { id?: unknown } } | undefined)?.actor?.id === actorId,
      ),
    );
}

const READ_ROUTE = /\/api\/v1\/read(\/[^/]+)?$/;

/** The answer of the session's last read as the actor now acting (a read or a read --item). */
export function lastRead(ctx: Ctx): { result: RunResult; answer: ReadResponse } | undefined {
  for (const r of resultsAs(ctx, viewerOf(ctx)?.id)) {
    const answer = answerOf<ReadResponse>(r, READ_ROUTE);
    if (answer !== undefined) return { result: r, answer };
  }
  return undefined;
}

/** Every item the session's reads as the actor now acting returned, the newest state of each. */
export function readItems(ctx: Ctx): MemoryItem[] {
  const out = new Map<string, MemoryItem>();
  for (const r of resultsAs(ctx, viewerOf(ctx)?.id).reverse()) {
    const answer = answerOf<ReadResponse>(r, READ_ROUTE);
    for (const item of answer?.items ?? []) out.set(item.id, item);
  }
  return [...out.values()];
}

/** The newest state of an item any of the session's answers as this actor carries. */
export function knownState(ctx: Ctx, id: string): MemoryItem | undefined {
  for (const r of resultsAs(ctx, viewerOf(ctx)?.id))
    for (const c of [...r.calls].reverse()) {
      const b = c.body as { items?: MemoryItem[]; item?: MemoryItem | null } | undefined;
      const found = b?.item?.id === id ? b.item : b?.items?.find((i) => i.id === id);
      if (found) return found;
    }
  return undefined;
}

/** An item's first line of content, for a row. */
export function firstLine(item: Pick<MemoryItem, "content">): string {
  const text = oneLine(contentText(item));
  return text;
}
