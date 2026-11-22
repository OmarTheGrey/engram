// Home (card E8.15b, docs/design/tui.md 8.1): the registry's commands in
// its six groups, each with a plain-language title, its access letter and,
// when the terminal is wide, its command. The right pane says what the
// selected command does, what it changes (from its entry's `writes`, never
// from a policy) and its exit codes. Keys 1 to 6 jump to a group; a letter
// opens its command. No letter is one of the keys that act everywhere or in
// lists. At 80x24 the list scrolls and says how much is below.
import { type CommandSpec, GROUPS, type Group, type Values, type Writes } from "../../registry.ts";
import { box, cut, fit, para, sideBySide } from "../layout.ts";
import { offered } from "../overlays.ts";
import type { CommandRow, Ctx, Screen } from "../screen.ts";
import { shortPath } from "../workspace.ts";

export const GROUP_TITLES: Record<Group, string> = {
  memory: "Memory",
  policy: "Policy",
  audit: "Audit",
  data: "Data",
  surfaces: "Surfaces",
  machine: "Machine",
};

/** Keys a Home letter may never be (docs/design/tui.md 8.1 and 9.1). */
export const RESERVED_LETTERS = ["j", "k", "c", "q", "v", "J", "L", "/", ";", "?"] as const;

/**
 * Each command's access letter on Home, from the design's mockups where it
 * names one. `d` is Doctor's and named in the status strip.
 */
export const LETTERS: Readonly<Record<string, string>> = {
  read: "r",
  "read --item": "o",
  write: "w",
  check: "C",
  promote: "p",
  supersede: "S",
  grants: "g",
  explain: "E",
  "who-can-read": "n",
  scopes: "u",
  retain: "t",
  lint: "l",
  simulate: "s",
  policy: "y",
  events: "e",
  "log verify": "f",
  "log checkpoint": "F",
  export: "x",
  import: "i",
  serve: "h",
  mcp: "m",
  "hook claude-code": "b",
  "key create": "a",
  "key list": "A",
  "key revoke": "R",
  doctor: "d",
};

/** What a command changes, in words, from its registry entry's `writes` (docs/design/tui.md 9.5). */
export function changesText(spec: CommandSpec, ws: Values, root: string | undefined): string {
  const w: Writes = spec.writes({}, ws);
  if (spec.name.startsWith("read") || spec.name === "scopes")
    return w === "state"
      ? `Changes: adopts ${root ?? "the store folder"} into the log; as its owner, first sweeps your expired items. Asks the first time a session.`
      : "Changes: appends one read event; nothing else.";
  switch (w) {
    case "none":
      return "Changes nothing: no item, no event.";
    case "audit":
      return "Changes: appends events to the log; no item.";
    case "state":
      return "Changes the log. Asks before it runs, with the command.";
    case "retire":
      return "Retires items for good. Asks first; it cannot be undone.";
    case "erase":
      return "Cannot be undone. Asks first, with the id typed to go on.";
    case "file":
      return "Writes a file. Asks first, naming it.";
    case "process":
      return "Runs until stopped (card E8.15d's screen runs it).";
  }
}

type Row = { kind: "group"; group: Group; n: number } | { kind: "command"; spec: CommandSpec };

export class HomeScreen implements Screen {
  readonly kind = "home" as const;
  private selected = 0;
  private offset = 0;
  private readonly entries: Row[];

  constructor() {
    this.entries = [];
    GROUPS.forEach((group, i) => {
      this.entries.push({ kind: "group", group, n: i + 1 });
      for (const spec of offered().filter((s) => s.group === group))
        this.entries.push({ kind: "command", spec });
    });
    this.selected = this.entries.findIndex((r) => r.kind === "command");
  }

  /** The commands in Home's order. */
  commands(): CommandSpec[] {
    return this.entries.flatMap((r) => (r.kind === "command" ? [r.spec] : []));
  }

  selectedSpec(): CommandSpec {
    const r = this.entries[this.selected];
    return (r?.kind === "command" ? r.spec : this.commands()[0]) as CommandSpec;
  }

  title(): string {
    return "Home";
  }

  private moveTo(index: number, direction: 1 | -1): void {
    let i = Math.max(0, Math.min(this.entries.length - 1, index));
    while (this.entries[i]?.kind === "group") {
      const next = i + direction;
      if (next < 0 || next >= this.entries.length) {
        direction = direction === 1 ? -1 : 1;
        continue;
      }
      i = next;
    }
    this.selected = i;
  }

  action(name: string, ctx: Ctx): boolean {
    const page = Math.max(1, ctx.rows - 10);
    switch (name) {
      case "up":
        this.moveTo(this.selected - 1, -1);
        return true;
      case "down":
        this.moveTo(this.selected + 1, 1);
        return true;
      case "page-up":
        this.moveTo(this.selected - page, -1);
        return true;
      case "page-down":
        this.moveTo(this.selected + page, 1);
        return true;
      case "first":
        this.moveTo(0, 1);
        return true;
      case "last":
        this.moveTo(this.entries.length - 1, -1);
        return true;
      case "open":
        ctx.openCommand(this.selectedSpec());
        return true;
    }
    const group = /^group-(\d)$/.exec(name)?.[1];
    if (group !== undefined) {
      const at = this.entries.findIndex((r) => r.kind === "group" && r.n === Number(group));
      this.moveTo(at + 1, 1);
      this.offset = at;
      return true;
    }
    return false;
  }

  inField(): boolean {
    return false;
  }

  /** A letter opens its command. */
  raw(data: string, ctx: Ctx): boolean {
    const spec = this.commands().find((s) => LETTERS[s.name] === data);
    if (spec === undefined) return false;
    this.selected = this.entries.findIndex((r) => r.kind === "command" && r.spec === spec);
    ctx.openCommand(spec);
    return true;
  }

  command(ctx: Ctx): CommandRow {
    const spec = this.selectedSpec();
    const words = spec.name.split(" ").filter((w) => !w.startsWith("--"));
    const flag = spec.name.split(" ").find((w) => w.startsWith("--"));
    const pos = spec.positionals.filter((p) => p.required).map((p) => `<${p.name}>`);
    return { argv: [...words, ...(flag ? [flag] : []), ...pos, ...ctx.ws.argsFor(spec)] };
  }

  hints(): string {
    return "enter open  1-6 group  letter action";
  }

  spec(): CommandSpec {
    return this.selectedSpec();
  }

  focused(): string {
    return this.selectedSpec().name;
  }

  private listLines(ctx: Ctx, width: number, room: number, wide: boolean): string[] {
    const lines: string[] = [];
    const index: number[] = [];
    for (const [i, r] of this.entries.entries()) {
      if (r.kind === "group") {
        lines.push(` ${r.n} ${GROUP_TITLES[r.group]}`);
      } else {
        const on = i === this.selected;
        const letter = LETTERS[r.spec.name] ?? " ";
        const card = r.spec.card === undefined ? "" : `  ${r.spec.card}`;
        const head = `${on ? ">" : " "} [${letter}] ${r.spec.title}`;
        const text = wide
          ? ` ${fit(head, 37)} ${fit(`engram ${r.spec.usage}`, width - 42 - card.length)}${card}`
          : ` ${fit(head, width - 2 - card.length)}${card}`;
        lines.push(on ? ctx.theme.reverse(fit(text, width)) : text);
      }
      index.push(i);
    }
    // Scroll so the selection shows, with a line saying what is above or below.
    if (lines.length <= room) return lines;
    const at = index.indexOf(this.selected);
    const body = room - 1;
    if (at < this.offset + 1) this.offset = Math.max(0, at - 1);
    if (at >= this.offset + body - 1) this.offset = at - body + 2;
    this.offset = Math.max(0, Math.min(this.offset, lines.length - body));
    const shown = lines.slice(this.offset, this.offset + body);
    if (this.offset > 0) shown[0] = `   ${this.offset} more above: pgup`;
    const below = lines.length - this.offset - body;
    shown.push(below > 0 ? `   ${ctx.theme.glyphs.open} ${below} more below: pgdn` : "");
    return shown;
  }

  private detailLines(ctx: Ctx, width: number): string[] {
    const spec = this.selectedSpec();
    const root = ctx.ws.get("root");
    const shownRoot = root === undefined ? undefined : shortPath(root, ctx.io);
    const lines = [` ${spec.title}`, "", ...para(`${capital(spec.summary)}.`, width), ""];
    lines.push(...para(`${changesText(spec, ctx.ws.flagValues(), shownRoot)}`, width), "");
    const exits = spec.exitCodes.map((e) => `${e.code} ${e.when}`).join("; ");
    lines.push(...para(`Exit     ${exits}`, width), "");
    if (spec.card !== undefined) lines.push(` Card     ${spec.card}, in flight`, "");
    lines.push(...para(`engram ${spec.usage}`, width), "", " enter open   c copy command");
    return lines;
  }

  /** The health strip: the last doctor run of this session, the log, the policy. */
  strip(ctx: Ctx, _width: number, wide: boolean): string[] {
    const t = ctx.theme;
    const doctor =
      ctx.lastDoctor === undefined
        ? `${t.symbol("skip")} doctor not run this session: d`
        : ctx.lastDoctor.code === 0
          ? `${t.symbol("ok")} doctor: all checks passed ${ctx.lastDoctor.at.slice(11, 16)}`
          : `${t.symbol("fail")} doctor: a check failed ${ctx.lastDoctor.at.slice(11, 16)}`;
    const log =
      ctx.ws.server() !== undefined ? "log the server's own" : `log ${ctx.checks.logLabel ?? "?"}`;
    const policy =
      ctx.ws.server() !== undefined ? "" : `policy ${ctx.checks.policyLabel ?? "does not load"}`;
    const first = ` ${doctor}   ${log}   ${policy}`;
    if (!wide) return [first];
    const store = ctx.ws.get("root");
    const exp = ctx.ws.get("otlp") ?? ctx.ws.get("export-jsonl");
    const second = [
      ` store ${ctx.ws.get("store") ?? "files"} ${store === undefined ? "(none: reading the log only)" : shortPath(store, ctx.io)}`,
      `owner ${ctx.ws.get("owner") ?? "none"}`,
      `member of ${ctx.ws.list("member").join(", ") || "the actor's own scope"}`,
      ctx.noSaved
        ? "not saved (--no-saved)"
        : ctx.savedInUse
          ? "workspace saved"
          : "workspace not saved",
      `decision export ${exp === undefined ? "off" : `on: ${exp}`}`,
    ].join("    ");
    return [first, second];
  }

  render(ctx: Ctx, width: number, height: number): string[] {
    const wide = width >= 120 && ctx.rows >= 40;
    const strip = this.strip(ctx, width, wide);
    const boxHeight = height - strip.length;
    const leftWidth = wide ? Math.floor(width * 0.6) : Math.floor(width * 0.45);
    const rightWidth = width - leftWidth;
    const left = box(
      ctx.theme,
      wide ? "Actions" : "",
      this.listLines(ctx, leftWidth - 2, boxHeight - 2, wide),
      leftWidth,
      boxHeight,
    );
    const right = box(
      ctx.theme,
      wide ? "Selected" : "",
      this.detailLines(ctx, rightWidth - 2),
      rightWidth,
      boxHeight,
    );
    return [...sideBySide(left, leftWidth, right, rightWidth), ...strip.map((l) => cut(l, width))];
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
