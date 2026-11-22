// The overlays (card E8.15b, docs/design/tui.md 8.27 to 8.29, 9.2 to 9.5):
// the help overlay, generated from the key table and the screen's registry
// entry so it cannot drift from either; the command palette, which
// fuzzy-searches every registry command by its title, name, flags and help
// line, plus the TUI's own actions and the session's commands, and opens a
// pasted command line as its form; and the confirmation, one shape for
// every action that changes state, the safe button focused.
import { fuzzyFilter } from "@earendil-works/pi-tui";
import { parse } from "../commands.ts";
import {
  type CommandSpec,
  closest,
  commandWords,
  parseOptions,
  REGISTRY,
  type Values,
} from "../registry.ts";
import { splitWords } from "./argv.ts";
import { TextField } from "./fields.ts";
import { actionsOn, EVERYWHERE, type KeyAction } from "./keys.ts";
import { box, cut, fit, para, visibleWidth, wrap } from "./layout.ts";
import type { ConfirmRequest, Ctx, Overlay, Screen } from "./screen.ts";
import { ResultScreen } from "./screens/form.ts";

/** The key lines of the help overlay: each label once, with its description. */
function keyLines(actions: readonly KeyAction[], width: number): string[] {
  const seen = new Set<string>();
  const cells: string[] = [];
  for (const a of actions) {
    if (seen.has(a.label)) continue;
    seen.add(a.label);
    cells.push(`${a.label}  ${a.description}`);
  }
  // Two columns where they fit.
  const col = Math.floor((width - 2) / 2);
  const lines: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const left = cells[i] as string;
    const right = cells[i + 1];
    if (right !== undefined && left.length < col && right.length < col)
      lines.push(`  ${fit(left, col)}${right}`);
    else {
      lines.push(`  ${left}`);
      if (right !== undefined) lines.push(`  ${right}`);
    }
  }
  return lines;
}

const GLOBAL_ACTIONS = new Set([
  "help",
  "palette",
  "workspace",
  "back",
  "copy",
  "redraw",
  "quit-now",
]);

export class HelpOverlay implements Overlay {
  readonly kind = "help" as const;
  private offset = 0;
  private readonly screen: Screen;

  constructor(screen: Screen) {
    this.screen = screen;
  }

  width(total: number): number {
    return Math.min(total - 4, 96);
  }

  private body(ctx: Ctx, inner: number): string[] {
    const kind = this.screen.kind;
    // A screen that names its actions (card E8.15d) lists only those.
    const named = this.screen.actions?.();
    const own = actionsOn(kind).filter(
      (a) => !GLOBAL_ACTIONS.has(a.action) && (named === undefined || named.includes(a.action)),
    );
    const everywhere = actionsOn(EVERYWHERE[0] as "home").filter((a) =>
      GLOBAL_ACTIONS.has(a.action),
    );
    const lines = [
      "This screen",
      ...(own.length > 0 ? keyLines(own, inner) : ["  no keys of its own"]),
      "Everywhere",
      ...keyLines(everywhere, inner),
      ctx.mouse
        ? "  The mouse is on: Shift+drag selects text. --no-mouse turns it off."
        : "  The mouse is off (--no-mouse): the terminal's own selection works.",
      "  In a text field every printable key types; ctrl+g opens this help.",
    ];
    const spec = this.screen.spec?.(ctx);
    if (spec !== undefined) {
      lines.push(`engram ${spec.usage}`, `  ${spec.summary}`);
      for (const l of spec.helpSection) lines.push(...wrap(l, inner));
    }
    return lines.flatMap((l) => (l.length > inner ? wrap(l, inner) : [l]));
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const inner = width - 2;
    // One column of padding inside the border on both sides (review UX item).
    const body = this.body(ctx, inner - 2).map((l) => ` ${l}`);
    const room = height - 2;
    this.offset = Math.max(0, Math.min(this.offset, body.length - room));
    const shown = body.slice(this.offset, this.offset + room);
    if (body.length > room) {
      const below = body.length - this.offset - room;
      shown[shown.length - 1] =
        below > 0 ? ` ${ctx.theme.glyphs.open} ${below} more: down` : (shown.at(-1) ?? "");
    }
    return box(
      ctx.theme,
      `Help: ${this.screen.title(ctx)}`,
      shown,
      width,
      Math.min(height, body.length + 2),
    );
  }

  action(name: string, ctx: Ctx): boolean {
    if (name === "close" || name === "close-help") ctx.closeOverlay(this);
    else if (name === "up") this.offset = Math.max(0, this.offset - 1);
    else if (name === "down") this.offset += 1;
    else return false;
    return true;
  }
  inField(): boolean {
    return false;
  }
  raw(): boolean {
    return false;
  }
}

/** One row of the palette. */
interface PaletteItem {
  label: string;
  /** The command it stands for, shown on the right. */
  command: string;
  /** The text the fuzzy filter searches. */
  search: string;
  /** Undefined for the entry with no action (Procedures). */
  run?: (ctx: Ctx) => void;
}

/** The registry commands the TUI offers: every one but the TUI itself. */
export const offered = () => REGISTRY.filter((s) => s.name !== "tui");

/** The entry a command line names: the longest registry name its words start with. */
export function specOfWords(words: readonly string[]): CommandSpec | undefined {
  let best: CommandSpec | undefined;
  for (const s of offered()) {
    const n = s.name.split(" ");
    if (
      n.every((w, i) => words[i] === w) &&
      (best === undefined || n.length > best.name.split(" ").length)
    )
      best = s;
  }
  return best;
}

export class PaletteOverlay implements Overlay {
  readonly kind = "palette" as const;
  private readonly query = new TextField("");
  private selected = 0;
  private problem: string | undefined;

  width(total: number): number {
    return Math.min(total - 8, 80);
  }

  private items(ctx: Ctx): PaletteItem[] {
    const commands = offered().map(
      (s): PaletteItem => ({
        label: s.title,
        command: `engram ${s.usage}`,
        search: [s.title, s.name, ...Object.keys(s.options).map((o) => `--${o}`), s.summary].join(
          " ",
        ),
        run: (c) => c.openCommand(s),
      }),
    );
    const own: PaletteItem[] = [
      {
        label: "Open the workspace",
        command: "ctrl+o",
        search: "workspace switch actor connection log",
        run: (c) => c.push(workspaceScreen(c)),
      },
      {
        label: "Forget saved workspace",
        command: "tui.json",
        search: "forget saved workspace delete",
        run: (c) => forgetFlow(c),
      },
      {
        label: "Switch actor",
        command: "ctrl+o, Acting as",
        search: "switch actor acting as viewer who",
        run: (c) => c.push(workspaceScreen(c, "as")),
      },
      {
        label: "Run the last command again",
        command:
          ctx.ran.length === 0 ? "nothing has run yet" : ctx.shown(ctx.ran.at(-1)?.argv ?? []),
        search: "rerun run the last command again repeat",
        run: (c) => void rerunLast(c),
      },
      {
        label: "Copy the command line",
        command: "c, alt+c",
        search: "copy the command line clipboard",
        run: (c) => c.copyCommand(),
      },
      { label: "Home", command: "", search: "home menu", run: (c) => c.home() },
      {
        label: "Line mode",
        command: "card E8.15e",
        search: "line mode screen reader",
        run: (c) =>
          c.say("line mode comes with card E8.15e; engram --help lists the plain commands"),
      },
      {
        label: "Procedures: not yet available (backlog)",
        command: "",
        search: "procedures distill",
      },
    ];
    const recent = [...ctx.ran].reverse().map(
      (r): PaletteItem => ({
        label: `Run again (exit ${r.code})`,
        command: ctx.shown(r.argv),
        search: ctx.shown(r.argv),
        run: (c) => {
          const spec = specOfWords(r.argv);
          if (spec !== undefined) openLine(c, r.argv);
        },
      }),
    );
    return [...recent, ...commands, ...own];
  }

  private shown(ctx: Ctx): PaletteItem[] {
    const q = this.query.value.trim();
    const items = this.items(ctx);
    if (q === "") return items;
    const typed = typedItem(q, ctx);
    // A label or command that starts with the query first, then one with a word that does,
    // then the rest in fuzzy order (review M5); ties keep the registry's order.
    const lower = q.toLowerCase();
    const rank = (i: PaletteItem) => {
      const label = i.label.toLowerCase();
      const words = `${label} ${i.command.toLowerCase().replace(/^engram /, "")}`.split(
        /[\s:,()]+/,
      );
      if (
        label.startsWith(lower) ||
        i.command
          .toLowerCase()
          .replace(/^engram /, "")
          .startsWith(lower)
      )
        return 0;
      return words.some((w) => w.startsWith(lower)) ? 1 : 2;
    };
    const found = fuzzyFilter(items, q, (i) => i.search)
      .map((item, at) => ({ item, at, r: rank(item) }))
      .sort((a, b) => a.r - b.r || a.at - b.at)
      .map((x) => x.item);
    return typed === undefined ? found : [typed, ...found];
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const inner = width - 2;
    const items = this.shown(ctx);
    this.selected = Math.max(0, Math.min(this.selected, items.length - 1));
    const room = Math.max(1, Math.min(items.length, height - 7));
    const start = Math.max(0, Math.min(this.selected - room + 1, items.length - room));
    const body = [` > ${this.query.render(inner - 4, true)}`, ""];
    if (items.length === 0) {
      const word = this.query.value.trim().split(/\s+/)[0] ?? "";
      const near = closest(word, commandWords());
      body.push(` No command matches.${near === undefined ? "" : ` Did you mean ${near}?`}`);
    }
    // As wide as the longest label shown, so none is cut (review M5).
    const labelWidth = Math.min(
      Math.max(12, ...items.map((i) => visibleWidth(i.label))),
      inner - 24,
    );
    for (const [i, item] of items.slice(start, start + room).entries()) {
      const mark = start + i === this.selected ? ">" : " ";
      const row = ` ${mark} ${fit(item.label, labelWidth)} ${cut(item.command, inner - labelWidth - 6)}`;
      body.push(start + i === this.selected ? ctx.theme.reverse(fit(row, inner)) : row);
    }
    if (this.problem !== undefined) body.push("", ...wrap(` ${this.problem}`, inner));
    body.push("", " enter open   tab fill   esc close");
    return box(ctx.theme, "Commands", body, width, Math.min(height, body.length + 2));
  }

  action(name: string, ctx: Ctx): boolean {
    const items = this.shown(ctx);
    if (name === "close") ctx.closeOverlay(this);
    else if (name === "up") this.selected = Math.max(0, this.selected - 1);
    else if (name === "down") this.selected = Math.min(items.length - 1, this.selected + 1);
    else if (name === "fill") {
      const item = items[this.selected];
      if (item?.command.startsWith("engram "))
        this.query.set(item.command.replace(/ <[^>]+>| \[[^\]]+\]/g, ""));
    } else if (name === "choose") {
      const item = items[this.selected];
      if (item?.run === undefined) {
        if (item !== undefined) ctx.say(`${item.label}: no command exists or is planned`);
        return true;
      }
      const problem = tryRun(item, ctx, this);
      if (problem !== undefined) this.problem = problem;
    } else return false;
    return true;
  }
  inField(): boolean {
    return true;
  }
  raw(data: string): boolean {
    this.query.type(data);
    this.selected = 0;
    this.problem = undefined;
    return true;
  }
}

/** Runs a palette item, then closes the palette; a pasted line's parse error comes back instead. */
function tryRun(item: PaletteItem, ctx: Ctx, palette: Overlay): string | undefined {
  try {
    item.run?.(ctx);
  } catch (e) {
    return (e as Error).message;
  }
  ctx.closeOverlay(palette);
  return undefined;
}

/** The top row for a query that is a command line: "Open as typed". */
function typedItem(q: string, ctx: Ctx): PaletteItem | undefined {
  const words = splitWords(q, ctx.shell);
  if (words === undefined || words.length < 2) return undefined;
  if (specOfWords(words) === undefined) return undefined;
  return {
    label: "Open as typed",
    command: ctx.shown(words),
    search: q,
    run: (c) => openLine(c, words),
  };
}

/** Opens the form a command line names, filled from its flags; throws the CLI's parse error. */
export function openLine(ctx: Ctx, words: readonly string[]): void {
  const spec = specOfWords(words);
  if (spec === undefined) throw new Error(`no command starts ${words.slice(0, 2).join(" ")}`);
  const nameWords = spec.name.split(" ").filter((w) => !w.startsWith("--"));
  const { values, positionals } = parse(
    [...words.slice(1)],
    parseOptions(spec),
    spec.allowPositionals,
  );
  ctx.openCommand(spec, values as Values, positionals.slice(nameWords.length - 1));
}

/** Set by the router: the workspace screen's constructor (no import cycle). */
let workspaceScreen: (ctx: Ctx, focus?: string) => Screen = () => {
  throw new Error("the workspace screen is not registered");
};
export const registerWorkspaceScreen = (make: (ctx: Ctx, focus?: string) => Screen) => {
  workspaceScreen = make;
};

/** The palette's rerun: the session's last command, run again through the same path, asking as before. */
async function rerunLast(ctx: Ctx): Promise<void> {
  const last = ctx.ran.at(-1);
  const spec = last === undefined ? undefined : specOfWords(last.argv);
  if (last === undefined || spec === undefined) {
    ctx.say("nothing has run this session");
    return;
  }
  const result = await ctx.act(spec, last.argv, {});
  if (result !== undefined) ctx.push(new ResultScreen(spec, result, {}));
}

/** Forget saved workspace: asks, then deletes tui.json. */
export async function forgetFlow(ctx: Ctx): Promise<void> {
  const yes = await ctx.confirm({
    title: "Forget the saved workspace?",
    lines: [
      "Deletes ~/.engram/tui.json, which holds the workspace's flags only. The event log and the memories are not touched.",
      "The next engram tui starts with first run, unless its flags name a workspace.",
    ],
    action: "Forget",
  });
  if (!yes) return;
  ctx.say(
    ctx.forget()
      ? "the saved workspace is forgotten: tui.json deleted"
      : "there was no saved workspace",
  );
}

export class ConfirmOverlay implements Overlay {
  readonly kind = "confirm" as const;
  private focus: "cancel" | "action" = "cancel";
  private readonly typed: TextField | undefined;
  private readonly request: ConfirmRequest;
  private readonly settle: (yes: boolean) => void;

  constructor(request: ConfirmRequest, settle: (yes: boolean) => void) {
    this.request = request;
    this.settle = settle;
    this.typed = request.typed === undefined ? undefined : new TextField("");
  }

  width(total: number): number {
    return Math.min(total - 10, 72);
  }

  private ready(): boolean {
    return this.typed === undefined || this.typed.value === this.request.typed;
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const inner = width - 2;
    const body: string[] = [];
    for (const p of this.request.lines) body.push(...para(`${p}`, inner - 1), "");
    if (this.request.argv !== undefined) {
      // The buttons stay in sight: a command too long for the room is cut, and shown whole below (card E8.15c).
      const command = para(`$ ${ctx.shown(this.request.argv)}`, inner - 1);
      const room = height - 2 - body.length - 4 - (this.typed === undefined ? 0 : 2);
      body.push(
        ...(command.length <= room
          ? command
          : [
              ...command.slice(0, Math.max(1, room - 1)),
              " ... (cut to fit the dialog; it runs whole)",
            ]),
        "",
      );
    }
    if (this.typed !== undefined) {
      // The box fits the dialog whatever the word's length (review E8.15d-10).
      const label = ` Type ${this.request.typed} to go on: [ `;
      const room = Math.max(8, Math.min(40, inner - 2 - visibleWidth(label) - 2));
      body.push(`${label}${this.typed.render(room, true)} ]`, "");
    }
    const button = (label: string, on: boolean) =>
      on ? ctx.theme.reverse(`[ ${label} ]`) : `[ ${label} ]`;
    body.push(
      `       ${button("Cancel", this.focus === "cancel")}      ${button(this.request.action, this.focus === "action")}`,
    );
    // While the word is typed, y and n type; enter acts once the word is right.
    body.push(
      "",
      this.typed === undefined
        ? ` y ${this.request.action.toLowerCase()}   n or esc cancel   tab the other button`
        : ` enter ${this.request.action.toLowerCase()}s once the id is typed   esc cancel`,
    );
    return box(ctx.theme, this.request.title, body, width, Math.min(height, body.length + 2));
  }

  private finish(ctx: Ctx, yes: boolean): void {
    ctx.closeOverlay(this);
    this.settle(yes);
  }

  action(name: string, ctx: Ctx): boolean {
    if (name === "no") this.finish(ctx, false);
    else if (name === "yes") {
      if (this.ready()) this.finish(ctx, true);
      else ctx.say(`type ${this.request.typed} first`);
    } else if (name === "switch") this.focus = this.focus === "cancel" ? "action" : "cancel";
    else if (name === "choose") {
      // With the word typed, enter is the action wherever the focus is (review E8.15d-10);
      // without it, enter on the action asks for the word and changes nothing.
      if (this.typed !== undefined) {
        if (this.ready()) this.finish(ctx, true);
        else if (this.focus === "cancel" && this.typed.value === "") this.finish(ctx, false);
        else ctx.say(`type ${this.request.typed} first`);
      } else if (this.focus === "cancel") this.finish(ctx, false);
      else this.finish(ctx, true);
    } else return false;
    return true;
  }
  inField(): boolean {
    return this.typed !== undefined;
  }
  raw(data: string): boolean {
    if (this.typed === undefined) return false;
    this.typed.type(data);
    return true;
  }
}
