// Events and Policy (card E8.15c, docs/design/tui.md 8.16 and 8.18).
//
// Events is `engram events [--after <seq>]`: the inspector's timeline, the
// events the actor may see, with its columns and filters (filterOptions,
// filterEvents, scopeText, eventFields from @engram/view), `/` to find in the
// reasons, and `f` to follow: a poll every 2 s asking only for events after
// the last seq seen, off by default, and only while the screen is open.
//
// Policy is `engram policy`: the policy in force and its label, as a
// foldable tree of whatever GET /policy returned, read only. Opened from a
// decision, it names the policy id it was opened at, verbatim, and reads
// nothing into it.
import type { MemoryEvent } from "@engram/sdk";
import {
  eventFields,
  explainTarget,
  filterEvents,
  filterOptions,
  findInReasons,
  NO_FILTER,
  scopeText,
  type TimelineFilter,
} from "@engram/view";
import { plural } from "../../format.ts";
import { type CommandSpec, command, type Values } from "../../registry.ts";
import { madeAsOther } from "../actor.ts";
import { TextField } from "../fields.ts";
import { Form } from "../forms.ts";
import { cut, fit, para } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { Ctx } from "../screen.ts";
import { ExplainScreen, openOnItem } from "./read.ts";
import {
  answerOf,
  decisionHead,
  errorLines,
  firstLines,
  oneLine,
  RichScreen,
  type Stop,
  safe,
  statusOf,
  viewerOf,
  windowOf,
} from "./rich.ts";

/** How often follow asks for new events (docs/design/tui.md 8.16). */
export const FOLLOW_MS = 2000;

const FILTERS = ["scope", "op", "decision", "actor"] as const;
type FilterKey = (typeof FILTERS)[number];

const EVENTS_ROUTE = /\/api\/v1\/events$/;

export class EventsScreen extends RichScreen {
  readonly kind = "events" as const;
  private filter: TimelineFilter = { ...NO_FILTER };
  private selected = 0;
  private start = 0;
  private detail = false;
  /** Events a follow poll added after the screen's own run. */
  private more: MemoryEvent[] = [];
  private follow: ReturnType<typeof setInterval> | undefined;
  private polling = false;
  /** The event seq to select once the events are in (Write's "Open the event"). */
  private readonly select: number | undefined;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
    select?: number,
  ) {
    super(spec, ctx, values, positionals);
    this.select = select;
    this.extras.set("find", new TextField(""));
  }

  override title(): string {
    return "Events";
  }

  stops(): Stop[] {
    return [
      ...FILTERS.map((k): Stop => ({ kind: "button", id: `filter:${k}`, label: k })),
      { kind: "field", id: "find" },
      { kind: "list", id: "events" },
    ];
  }

  async opened(ctx: Ctx): Promise<void> {
    await this.load(ctx);
  }

  private async load(ctx: Ctx, argv?: readonly string[]): Promise<void> {
    const r = await this.run(ctx, argv);
    if (r === undefined) return;
    this.more = [];
    this.focusOn("events");
    const shown = this.shown();
    this.unseen = undefined;
    if (this.select !== undefined) {
      const at = shown.findIndex((e) => e.seq === this.select);
      // An event the viewer may not see is said so, and nothing is selected in its place (review 7).
      if (at < 0) this.unseen = this.select;
      this.selected = at < 0 ? -1 : at;
    } else this.selected = Math.max(0, shown.length - 1);
  }

  /** The event asked for that is not among those the viewer may see. */
  private unseen: number | undefined;

  override close(): void {
    super.close();
    this.stopFollow();
  }

  private stopFollow(): void {
    if (this.follow !== undefined) clearInterval(this.follow);
    this.follow = undefined;
  }

  /** Every event the run and the polls returned, in log order. */
  events(): MemoryEvent[] {
    const first = answerOf<{ events: MemoryEvent[] }>(this.result, EVENTS_ROUTE)?.events ?? [];
    return [...first, ...this.more];
  }

  /** The events the filters keep, then those whose reason holds the text found. */
  shown(): MemoryEvent[] {
    return findInReasons(
      filterEvents(this.events(), this.filter),
      this.extras.get("find")?.value ?? "",
    );
  }

  private selectedEvent(): MemoryEvent | undefined {
    if (this.selected < 0) return undefined;
    const shown = this.shown();
    this.selected = Math.max(0, Math.min(this.selected, shown.length - 1));
    return shown[this.selected];
  }

  /** The values a filter cycles through: any, then those the visible events carry. */
  private choices(k: FilterKey): (string | null)[] {
    const o = filterOptions(this.events());
    const values = { scope: o.scopes, op: o.ops, decision: o.decisions, actor: o.actors }[k];
    return [null, ...values];
  }

  /** One poll: the events after the last seq seen, asked quietly (not a command of the session). */
  private async poll(ctx: Ctx): Promise<void> {
    // Only while this screen is the one drawn (review finding 10).
    if (this.polling || this.closed || ctx.top() !== this) return;
    this.polling = true;
    try {
      // After a change of actor, follow starts again as the actor now: all its events, then after them.
      if (madeAsOther(ctx.ws, this.result) !== undefined) {
        const r = await ctx.peek(new Form(this.command_, ctx.ws).argv(ctx.ws));
        if (!this.closed && answerOf(r, EVENTS_ROUTE) !== undefined) {
          this.result = r;
          this.more = [];
          this.selected = Math.max(0, this.shown().length - 1);
          ctx.redraw();
        }
        return;
      }
      const last = this.events().at(-1)?.seq;
      const form = new Form(
        this.command_,
        ctx.ws,
        last === undefined ? {} : { after: String(last) },
      );
      const r = await ctx.peek(form.argv(ctx.ws));
      const fresh = answerOf<{ events: MemoryEvent[] }>(r, EVENTS_ROUTE)?.events ?? [];
      if (!this.closed && fresh.length > 0) {
        this.more.push(...fresh);
        ctx.redraw();
      }
    } finally {
      this.polling = false;
    }
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    const e = this.selectedEvent();
    if (stop?.kind === "button" && stop.id.startsWith("filter:")) {
      const k = stop.id.slice(7) as FilterKey;
      if (
        name === "toggle" ||
        name === "choose-next" ||
        name === "choose-prev" ||
        name === "accept"
      ) {
        const c = this.choices(k);
        const i = c.indexOf(this.filter[k]);
        const step = name === "choose-prev" ? -1 : 1;
        this.filter = { ...this.filter, [k]: c[(i + step + c.length) % c.length] ?? null };
        this.selected = Math.max(0, this.shown().length - 1);
        return true;
      }
    }
    switch (name) {
      case "submit":
        ctx.say("r runs it again");
        return true;
      case "rerun":
        await this.load(ctx, this.result === undefined ? undefined : this.rerunLine(ctx));
        return true;
      case "up":
      case "down":
        if (stop?.kind === "list")
          this.selected = Math.max(0, this.selected + (name === "up" ? -1 : 1));
        else this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
      case "page-up":
      case "page-down":
        this.selected = Math.max(
          0,
          this.selected + (name === "page-up" ? -1 : 1) * Math.max(1, ctx.rows - 14),
        );
        return true;
      case "first":
        this.selected = 0;
        return true;
      case "last":
        this.selected = Number.MAX_SAFE_INTEGER;
        return true;
      case "accept":
        if (stop?.kind === "list") this.detail = !this.detail;
        else this.focusOn("events");
        return true;
      case "find":
        this.focusOn("find");
        return true;
      case "follow":
        if (this.follow !== undefined) {
          this.stopFollow();
          ctx.say("follow off");
        } else {
          this.follow = setInterval(() => void this.poll(ctx), FOLLOW_MS);
          this.follow.unref?.();
          ctx.say(
            `following: a poll every ${FOLLOW_MS / 1000} s with --after the last seq; f stops`,
          );
        }
        return true;
      case "item":
      case "promote":
        if (e?.item_id === null || e === undefined) {
          ctx.say("the selected event names no item");
          return true;
        }
        if (name === "promote") openOnItem(ctx, "promote", e.item_id);
        else openOnItem(ctx, "read --item", e.item_id);
        return true;
      case "explain": {
        const viewer = viewerOf(ctx);
        if (e === undefined || viewer === undefined || explainTarget(viewer, e) === "not-read") {
          ctx.say("the selected event is not a read");
          return true;
        }
        ctx.push(
          new ExplainScreen(command("explain") as CommandSpec, ctx, {}, [e.id], { event: e }),
        );
        return true;
      }
    }
    return false;
  }

  /** Whether follow is on, for tests. */
  following(): boolean {
    return this.follow !== undefined;
  }

  /** Runs one poll now, for tests. */
  pollNow(ctx: Ctx): Promise<void> {
    return this.poll(ctx);
  }

  protected ownHints(): string {
    return "J json  enter detail  o item  e explain  / search  f follow";
  }

  protected body(ctx: Ctx, width: number, height: number): string[] {
    const t = ctx.theme;
    const wide = width >= 120;
    const on = this.current()?.id;
    const filters = FILTERS.map((k) => {
      const v = this.filter[k] ?? "any";
      const text = `${k} [ ${fit(v, wide ? 18 : 6)} ]`;
      return on === `filter:${k}` ? t.reverse(text) : text;
    }).join("  ");
    const find = this.extras.get("find") as TextField;
    const out = [
      cut(` Filters  ${filters}`, width),
      cut(
        ` ${on === "find" ? ">" : " "}Find in reasons [ ${find.render(wide ? 30 : 20, on === "find")} ]${this.follow !== undefined ? `   ${t.status("running", "following")}` : ""}`,
        width,
      ),
    ];
    const r = this.result;
    if (r === undefined) return [...out, "", " Reading the events you may see..."];
    if (answerOf(r, EVENTS_ROUTE) === undefined)
      return [...out, "", decisionHead(t, this.command_, r), "", ...errorLines(r, width)];
    const all = this.events();
    const shown = this.shown();
    out.push(` ${shown.length} of ${plural(all.length, "event")}`, "");
    if (all.length === 0) {
      out.push(
        ...para(
          "No events you may see. An event shows to a member of a scope it names whose level may read that scope; one that names no scope, such as a read, only to the actor who made it.",
          width,
        ),
      );
      if (this.unseen !== undefined)
        out.push("", ` event ${this.unseen} is not one you may see; nothing is selected`);
      return out;
    }
    const head = wide
      ? ` ${fit("seq", 6)}${fit("time", 10)}${fit("op", 9)}${fit("decision", 10)}${fit("actor", 16)}${fit("scope", 24)}${fit("policy id", 34)}reason`
      : ` ${fit("seq", 6)}${fit("time", 10)}${fit("op", 9)}${fit("decision", 10)}${fit("scope", 16)}policy id`;
    out.push(cut(head, width));
    const detail = this.detail ? 13 : 4;
    const room = Math.max(1, height - out.length - detail);
    const chosen = this.selectedEvent();
    const at = chosen === undefined ? -1 : shown.indexOf(chosen);
    this.start = windowOf(Math.max(0, at), shown.length, room, this.start);
    shown.slice(this.start, this.start + room).forEach((e, i) => {
      const mark = this.start + i === at ? ">" : " ";
      const decision = `${t.symbol(statusOf(e.decision))} ${fit(e.decision, 7)}`;
      const time = e.ts.slice(11, 19);
      const text = wide
        ? ` ${mark}${String(e.seq).padStart(4)} ${fit(time, 10)}${fit(e.op, 9)}${decision} ${fit(e.actor, 16)}${fit(scopeText(e), 23)} ${fit(safe(e.policy_id), 33)} ${oneLine(e.reason)}`
        : ` ${mark}${String(e.seq).padStart(4)} ${fit(time, 10)}${fit(e.op, 9)}${decision} ${fit(scopeText(e), 15)} ${safe(e.policy_id)}`;
      out.push(
        this.start + i === at && on === "events" ? t.reverse(cut(text, width)) : cut(text, width),
      );
    });
    if (this.unseen !== undefined && chosen === undefined)
      out.push("", ` event ${this.unseen} is not one you may see; nothing is selected`);
    if (chosen !== undefined) {
      out.push("");
      if (this.detail) {
        // Each value whole, wrapped, never cut: the reason above all (10.1).
        const rows = [
          ...eventFields(chosen),
          ["policy id", oneLine(chosen.policy_id)],
          ["reason", oneLine(chosen.reason)],
        ];
        for (const [k = "", v = ""] of rows) {
          const [first = "", ...rest] = para(oneLine(v), width - 12, "");
          out.push(cut(` ${fit(k, 11)}${first}`, width), ...rest.map((l) => `            ${l}`));
        }
      } else {
        out.push(
          cut(
            ` event ${chosen.seq}  ${chosen.op}  ${t.status(statusOf(chosen.decision), chosen.decision)}  by ${chosen.actor}  item ${chosen.item_id ?? "none"}`,
            width,
          ),
        );
        out.push(...firstLines(para(`reason  ${oneLine(chosen.reason)}`, width), 2));
      }
    }
    return out;
  }
}

/** One row of the policy tree. */
interface TreeRow {
  path: string;
  depth: number;
  key: string;
  /** A scalar's text, or a folded node's summary. */
  text: string;
  foldable: boolean;
}

/** A value a policy file holds, as YAML parses it. */
type PolicyValue =
  | string
  | number
  | boolean
  | null
  | readonly PolicyValue[]
  | { readonly [key: string]: PolicyValue };

/** A value as one line: a scalar as itself, a list of scalars joined, anything else as JSON. */
function scalarText(v: PolicyValue): string {
  if (v === null) return "null";
  if (Array.isArray(v) && v.every((x) => typeof x !== "object" || x === null))
    return v.length === 0 ? "none" : v.map((x) => String(x)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const isNode = (v: unknown): v is Record<string, unknown> | unknown[] =>
  typeof v === "object" &&
  v !== null &&
  !(Array.isArray(v) && v.every((x) => typeof x !== "object" || x === null));

/** The tree's rows under `value`, unfolded where `open` holds the path. */
function treeRows(value: unknown, open: ReadonlySet<string>, path = "", depth = 0): TreeRow[] {
  const out: TreeRow[] = [];
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  for (const [key, v] of entries) {
    const p = path === "" ? key : `${path}.${key}`;
    if (isNode(v)) {
      const keys = Array.isArray(v) ? `${v.length} entries` : Object.keys(v).join(", ");
      out.push({ path: p, depth, key, text: keys, foldable: true });
      if (open.has(p)) out.push(...treeRows(v, open, p, depth + 1));
    } else out.push({ path: p, depth, key, text: scalarText(v as PolicyValue), foldable: false });
  }
  return out;
}

export class PolicyScreen extends RichScreen {
  readonly kind = "policy" as const;
  private readonly open = new Set<string>();
  private selected = 0;
  private start = 0;
  /** The decision it was opened from, if any: its policy id is shown as it came. */
  private readonly from: { policy_id: string } | undefined;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
    from?: { policy_id: string },
  ) {
    super(spec, ctx, values, positionals);
    this.from = from;
    this.extras.set("find", new TextField(""));
  }

  stops(): Stop[] {
    return [
      { kind: "field", id: "find" },
      { kind: "list", id: "tree" },
    ];
  }

  async opened(ctx: Ctx): Promise<void> {
    await this.load(ctx);
  }

  private async load(ctx: Ctx, argv?: readonly string[]): Promise<void> {
    const r = await this.run(ctx, argv);
    if (r !== undefined) this.focusOn("tree");
  }

  private answer(): { policy: Record<string, unknown>; label: string } | undefined {
    return answerOf(this.result, /\/api\/v1\/policy$/);
  }

  /** The rows shown: every row whose path or text holds the text found, with its parents unfolded. */
  rows(): TreeRow[] {
    const a = this.answer();
    if (a === undefined) return [];
    const find = (this.extras.get("find")?.value ?? "").trim().toLowerCase();
    if (find === "") return treeRows(a.policy, this.open);
    // Unfold everything, keep the matches and their parents.
    const every = new Set<string>();
    const collect = (v: unknown, p: string) => {
      if (!isNode(v)) return;
      every.add(p);
      for (const [k, x] of Array.isArray(v)
        ? v.map((x, i) => [String(i), x] as const)
        : Object.entries(v))
        collect(x, p === "" ? k : `${p}.${k}`);
    };
    for (const [k, v] of Object.entries(a.policy)) collect(v, k);
    const full = treeRows(a.policy, every);
    const hits = full.filter((r) => `${r.path} ${r.text}`.toLowerCase().includes(find));
    const keep = new Set<string>();
    for (const h of hits) {
      const parts = h.path.split(".");
      for (let i = 1; i <= parts.length; i++) keep.add(parts.slice(0, i).join("."));
    }
    return full.filter((r) => keep.has(r.path));
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    const rows = this.rows();
    this.selected = Math.max(0, Math.min(this.selected, rows.length - 1));
    const row = rows[this.selected];
    switch (name) {
      case "submit":
        ctx.say("r runs it again");
        return true;
      case "rerun":
        await this.load(ctx, this.result === undefined ? undefined : this.rerunLine(ctx));
        return true;
      case "find":
        this.focusOn("find");
        return true;
      case "up":
      case "down":
        if (stop?.kind === "list") this.selected += name === "up" ? -1 : 1;
        else this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
      case "page-up":
      case "page-down":
        this.selected += (name === "page-up" ? -1 : 1) * Math.max(1, ctx.rows - 8);
        return true;
      case "first":
        this.selected = 0;
        return true;
      case "last":
        this.selected = Number.MAX_SAFE_INTEGER;
        return true;
      case "accept":
      case "toggle":
      case "choose-next":
      case "choose-prev":
        if (stop?.kind !== "list") {
          if (name === "accept") this.focusOn("tree");
          return name === "accept";
        }
        if (row?.foldable) {
          if (name === "choose-prev" || (this.open.has(row.path) && name !== "choose-next"))
            this.open.delete(row.path);
          else this.open.add(row.path);
        }
        return true;
    }
    return false;
  }

  protected ownHints(): string {
    return "J json  enter fold  / find";
  }

  protected body(ctx: Ctx, width: number, height: number): string[] {
    const t = ctx.theme;
    const a = this.answer();
    const r = this.result as RunResult | undefined;
    const on = this.current()?.id;
    const find = this.extras.get("find") as TextField;
    const out: string[] = [];
    if (a === undefined) {
      if (r === undefined) return [" Reading the policy in force..."];
      return [decisionHead(t, this.command_, r), "", ...errorLines(r, width)];
    }
    out.push(
      cut(
        ` ${oneLine(a.label)}   read only: a policy is edited in its file, then named with --policy`,
        width,
      ),
    );
    if (this.from !== undefined)
      out.push(cut(` opened from a decision: policy id ${oneLine(this.from.policy_id)}`, width));
    out.push(
      cut(` ${on === "find" ? ">" : " "}Find [ ${find.render(24, on === "find")} ]`, width),
      "",
    );
    const rows = this.rows();
    this.selected = Math.max(0, Math.min(this.selected, rows.length - 1));
    const room = Math.max(1, height - out.length);
    this.start = windowOf(this.selected, rows.length, room, this.start);
    rows.slice(this.start, this.start + room).forEach((row, i) => {
      const chosen = this.start + i === this.selected;
      const glyph = row.foldable
        ? this.open.has(row.path) || find.value !== ""
          ? t.glyphs.open
          : t.glyphs.closed
        : " ";
      const text = cut(
        ` ${chosen ? ">" : " "} ${"  ".repeat(row.depth)}${glyph} ${row.key}${row.foldable && (this.open.has(row.path) || find.value !== "") ? "" : `  ${oneLine(row.text)}`}`,
        width,
      );
      out.push(chosen && on === "tree" ? t.reverse(text) : text);
    });
    if (rows.length === 0) out.push(" nothing matches");
    return out;
  }
}
