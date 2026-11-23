// Read and explain, and Explain (card E8.15c, docs/design/tui.md 8.5 and
// 8.6). Read is `engram read [query] [--at]`: the query and the validity
// time, then the read's decision first, the store's sync when the route
// returned one, the inspector's scope lanes (buildLanes, laneGroups) and the
// selected item's explanation in the CLI's own lines (explanationLines). A
// read with a store folder asks once a session, by the router's dialog of 8.5.
// Explain is `engram explain <readId>`: the inspector's explain view
// (explainView), or the CLI's error and, when the read's event is known, who
// made it. Nothing here decides: every word about a decision is the answer's.
import type { ExplainResponse, Explanation, MemoryEvent, ReadResponse } from "@engram/sdk";
import {
  buildLanes,
  type ExplainView,
  explainView,
  type Lane,
  type LaneItem,
  laneGroups,
} from "@engram/view";
import { explanationLines, plural } from "../../format.ts";
import { type CommandSpec, command, type Values } from "../../registry.ts";
import { box, cut, fit, para, rows } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { Ctx } from "../screen.ts";
import { shortPath } from "../workspace.ts";
import {
  answerOf,
  decisionHead,
  errorLines,
  firstLine,
  oneLine,
  RichScreen,
  requestOf,
  type Stop,
  safe,
  viewerOf,
  windowOf,
} from "./rich.ts";

const READ_ROUTE = /\/api\/v1\/read(\/[^/]+)?$/;

/** One row of the lanes pane: a group's heading, a lane's, or an item. */
type LaneRow =
  | { kind: "group"; text: string; note: string }
  | { kind: "lane"; lane: Lane }
  | { kind: "empty"; text: string }
  | { kind: "item"; item: LaneItem };

/** Opens a registry command's screen on an item: promote, grants, who can read, supersede. */
export function openOnItem(ctx: Ctx, name: string, itemId: string, values: Values = {}): void {
  const spec = command(name);
  if (spec === undefined) return;
  ctx.openCommand(spec, values, [itemId]);
}

export class ReadScreen extends RichScreen {
  readonly kind = "read" as const;
  private selected = 0;
  private start = 0;

  stops(): Stop[] {
    const out: Stop[] = [
      { kind: "field", id: "pos:query" },
      { kind: "field", id: "at" },
    ];
    if (this.answer() !== undefined && this.items().length > 0)
      out.push({ kind: "list", id: "lanes" });
    else if (this.result !== undefined) out.push({ kind: "list", id: "result" });
    return out;
  }

  /** The read's answer, when the last run returned one. */
  answer(): ReadResponse | undefined {
    return answerOf<ReadResponse>(this.result, READ_ROUTE);
  }

  /** The lanes as the inspector groups them, for the actor the read was made as. */
  private laneRows(): LaneRow[] {
    const answer = this.answer();
    if (answer === undefined) return [];
    const sent = requestOf<{ actor?: { id: string; memberships: string[] } }>(
      this.result,
      READ_ROUTE,
    );
    const viewer = sent?.actor ?? { id: answer.event.actor, memberships: [] };
    const out: LaneRow[] = [];
    for (const g of laneGroups(buildLanes(viewer, answer))) {
      out.push({ kind: "group", text: g.title, note: g.note });
      if (g.lanes.length === 0) out.push({ kind: "empty", text: "none held" });
      for (const lane of g.lanes) {
        out.push({ kind: "lane", lane });
        if (lane.items.length === 0) out.push({ kind: "empty", text: "nothing to read" });
        for (const item of lane.items) out.push({ kind: "item", item });
      }
    }
    return out;
  }

  private items(): LaneItem[] {
    return this.laneRows().flatMap((r) => (r.kind === "item" ? [r.item] : []));
  }

  /** The item selected in the lanes, if the read returned any. */
  selectedItem(): LaneItem | undefined {
    const items = this.items();
    this.selected = Math.max(0, Math.min(this.selected, items.length - 1));
    return items[this.selected];
  }

  /**
   * Every later read with a store folder repeats what the first one asked
   * about (8.5): it changes the log too. Only on a later read, never on the
   * first, and on its own row, so it never squeezes the command row (N5).
   */
  private laterReadNote(ctx: Ctx): string | undefined {
    const first = ctx.ran.findIndex((r) => r.argv[0] === "read" && r.argv.includes("--root"));
    if (first < 0) return undefined;
    const argv = this.command(ctx).argv ?? [];
    if (!argv.includes("--root")) return undefined;
    // The first read with a store folder, shown as its own result, is the one that asked.
    const at = this.result === undefined || this.edited ? -1 : ctx.results.indexOf(this.result);
    if (at === first) return undefined;
    return " This read also changes the log, as asked: it sweeps and adopts the store.";
  }

  protected body(ctx: Ctx, width: number, height: number): string[] {
    const out = this.main(ctx, width, height);
    const note = this.laterReadNote(ctx);
    if (note === undefined) return out;
    return [...rows(out, height - 1, width), cut(note, width)];
  }

  /** esc in the lanes goes back to the query, as to the form; esc in a field leaves. */
  protected override async leave(ctx: Ctx): Promise<boolean> {
    if (this.current()?.kind === "list") {
      this.focusOn("pos:query");
      return true;
    }
    ctx.pop();
    return true;
  }

  private async read(ctx: Ctx, argv?: readonly string[]): Promise<void> {
    const r = await this.run(ctx, argv);
    if (r !== undefined) {
      this.selected = 0;
      this.start = 0;
      // Off the field, so the result's keys act (c, v, J, r).
      if (!this.focusOn("lanes")) this.focusOn("result");
    }
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    const item = this.selectedItem();
    switch (name) {
      case "submit":
        await this.read(ctx);
        return true;
      case "accept":
        if (stop?.kind === "list" && item !== undefined) {
          openOnItem(ctx, "read --item", item.id);
          return true;
        }
        await this.read(ctx);
        return true;
      case "rerun":
        if (this.result !== undefined) await this.read(ctx, this.rerunLine(ctx));
        return true;
      case "up":
      case "down":
        if (stop?.kind === "list") {
          this.selected += name === "up" ? -1 : 1;
          return true;
        }
        this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
      case "page-up":
      case "page-down":
        this.selected += (name === "page-up" ? -1 : 1) * Math.max(1, ctx.rows - 14);
        return true;
      case "first":
        this.selected = 0;
        return true;
      case "last":
        this.selected = Number.MAX_SAFE_INTEGER;
        return true;
      case "explain": {
        const answer = this.answer();
        if (answer === undefined) {
          ctx.say("nothing read yet: enter reads");
          return true;
        }
        const contents = new Map(this.items().map((i) => [i.id, i.content]));
        ctx.push(
          new ExplainScreen(command("explain") as CommandSpec, ctx, {}, [answer.event.id], {
            event: answer.event,
            contents,
          }),
        );
        return true;
      }
      case "promote":
      case "grants":
      case "who":
      case "supersede":
        if (item === undefined) {
          ctx.say("no item selected: read first, then choose one in the lanes");
          return true;
        }
        openOnItem(ctx, ITEM_COMMAND[name] as string, item.id);
        return true;
    }
    return false;
  }

  protected ownHints(): string {
    return this.answer() === undefined
      ? "enter read  tab next field"
      : "v plain  J json  enter item page  e explain  p promote  g grants  w who  S supersede";
  }

  private fieldsLine(_ctx: Ctx, width: number): string {
    const q = this.form.editors.get("pos:query");
    const at = this.form.editors.get("at");
    const on = this.current()?.id;
    const atText = at?.value === "" && on !== "at" ? "now (the server's clock)" : undefined;
    const qWidth = Math.max(16, Math.min(40, width - 54));
    const query = `${on === "pos:query" ? ">" : " "}Query [ ${q?.render(qWidth, on === "pos:query") ?? ""} ]`;
    const when = `${on === "at" ? ">" : " "}Judge validity windows at [ ${atText === undefined ? (at?.render(16, on === "at") ?? "") : fit(atText, 16)} ]`;
    return cut(` ${query}  ${when}`, width);
  }

  private main(ctx: Ctx, width: number, height: number): string[] {
    const t = ctx.theme;
    const wide = width >= 120 && ctx.rows >= 40;
    const out = [this.fieldsLine(ctx, width), ...this.errorHead(ctx, width)];
    const r = this.result;
    const answer = this.answer();
    if (r === undefined || this.edited) {
      if (r === undefined) out.push("");
      const root = ctx.ws.get("root");
      const actor = viewerOf(ctx);
      out.push(
        ...para(
          `Reads through the plane as ${actor?.id ?? "the actor (give --owner or --as with ctrl+o)"} and explains every item it returns.`,
          width,
        ),
        ...para(
          root === undefined || ctx.ws.server() !== undefined
            ? ctx.ws.server() !== undefined
              ? "With a server, its own store and log."
              : "No store: reading the log only."
            : `With ${shortPath(root, ctx.io)}: the store's memories are adopted into the log first; as its owner, your expired items are swept before that. The first read of a session asks.`,
          width,
        ),
        "",
        " enter reads   tab moves between the fields",
      );
      if (r === undefined) return out;
      out.push("");
    }
    if (answer === undefined) {
      out.push(decisionHead(t, this.command_, r), "", ...errorLines(r, width));
      return out;
    }
    const e = answer.event;
    out.push(
      cut(
        ` read ${e.id}  ${t.status(e.decision, e.decision)}   ${plural(answer.items.length, "item")} returned, ${answer.filtered} filtered${wide ? ` at ${e.ts} under ${oneLine(answer.policy)}` : ""}`,
        width,
      ),
    );
    if (answer.sync !== null) {
      const s = answer.sync;
      const a = s.adoption;
      if (wide) {
        out.push(
          cut(` store ${oneLine(s.store.name)} at ${shortPath(s.store.root, ctx.io)}`, width),
          `   retention: ${s.retention.expired.length} expired, ${s.retention.evicted.length} evicted`,
          `   imported ${a.allowed + a.denied} of ${a.listed}: ${a.allowed} allowed, ${a.denied} denied, ${a.unchanged} already in the log`,
        );
      } else
        out.push(
          cut(
            ` store ${oneLine(s.store.name)} ${shortPath(s.store.root, ctx.io)}: ${a.allowed + a.denied} imported, ${a.allowed} allowed, ${a.denied} denied; ${s.retention.expired.length} expired`,
            width,
          ),
        );
    }
    if (wide) out.push(...para(oneLine(e.reason), width, "   "));
    const rest = height - out.length;
    if (answer.items.length === 0) {
      out.push(
        "",
        ` No items returned. ${oneLine(e.reason)}`,
        "",
        " ctrl+o changes who you act as; Home's Write a memory writes one.",
      );
      return out;
    }
    const explainHeight = Math.max(6, Math.min(wide ? 9 : 7, Math.floor(rest / 2)));
    const lanesHeight = Math.max(4, rest - explainHeight - (wide ? 2 : 0));
    out.push(...this.lanesBox(ctx, width, lanesHeight, wide));
    out.push(...this.explainBox(ctx, answer, width, explainHeight));
    if (wide) {
      const hint = safe(r.out).replace(/\n$/, "").split("\n").at(-1) ?? "";
      out.push("", cut(` ${hint}`, width));
    }
    return out;
  }

  private lanesBox(ctx: Ctx, width: number, height: number, wide: boolean): string[] {
    const t = ctx.theme;
    const rows = this.laneRows();
    const chosen = this.selectedItem();
    const lines: string[] = [];
    let at = 0;
    for (const row of rows) {
      if (row.kind === "group")
        lines.push(wide ? cut(` ${fit(row.text, 14)} ${row.note}`, width - 2) : ` ${row.text}`);
      else if (row.kind === "lane")
        lines.push(`   ${row.lane.scope}  ${row.lane.member ? "member" : "through a grant"}`);
      else if (row.kind === "empty") lines.push(`   ${row.text}`);
      else {
        const on = row.item.id === chosen?.id;
        if (on) at = lines.length;
        const text = cut(
          ` ${on ? ">" : " "} ${String(row.item.rank ?? "-").padStart(2)}  ${fit(row.item.class, 10)}${fit(row.item.provenance, 8)}${oneLine(row.item.content)}`,
          width - 2,
        );
        const focused = this.current()?.id === "lanes";
        lines.push(on && focused ? t.reverse(text) : text);
      }
    }
    const room = height - 2;
    this.start = windowOf(at, lines.length, room, this.start);
    return box(t, "Lanes", lines.slice(this.start, this.start + room), width, height);
  }

  private explainBox(ctx: Ctx, answer: ReadResponse, width: number, height: number): string[] {
    const chosen = this.selectedItem();
    const items = this.items();
    if (chosen === undefined) return [];
    const e = answer.explanations.find((x) => x.item_id === chosen.id) as Explanation | undefined;
    const item = answer.items.find((i) => i.id === chosen.id);
    const lines = [
      cut(` ${chosen.id}  ${chosen.class}  ${item?.scope ?? ""}`, width - 2),
      ...(e === undefined
        ? []
        : explanationLines(e as never).map((l) => cut(` ${safe(l)}`, width - 2))),
      ...(item === undefined
        ? []
        : [cut(` source ${item.provenance.kind} ${oneLine(item.provenance.ref)}`, width - 2)]),
      cut(` > ${firstLine({ content: chosen.content })}`, width - 2),
    ];
    const n = items.findIndex((i) => i.id === chosen.id) + 1;
    return box(ctx.theme, `Explain  item ${n} of ${items.length}`, lines, width, height);
  }
}

/** The command each item key opens. */
const ITEM_COMMAND: Readonly<Record<string, string>> = {
  promote: "promote",
  grants: "grants",
  who: "who-can-read",
  supersede: "supersede",
};

/** What the opener knows of the read being explained: its event, and the lanes' text of each item. */
export interface ReadKnown {
  event?: MemoryEvent;
  contents?: ReadonlyMap<string, string>;
}

export class ExplainScreen extends RichScreen {
  readonly kind = "explain" as const;
  private readonly known: ReadKnown;
  private selected = 0;

  constructor(
    spec: CommandSpec,
    ctx: Ctx,
    values: Values = {},
    positionals: readonly string[] = [],
    known: ReadKnown = {},
  ) {
    super(spec, ctx, values, positionals);
    this.known = known;
    // From Home, the session's last read is the one offered.
    if (this.form.get("pos:readId") === "") {
      const last = [...ctx.results]
        .reverse()
        .map((r) => answerOf<ReadResponse>(r, READ_ROUTE))
        .find((a) => a !== undefined && a.event.actor === viewerOf(ctx)?.id);
      if (last !== undefined) this.form.setValue("pos:readId", last.event.id);
    }
  }

  stops(): Stop[] {
    const out: Stop[] = [{ kind: "field", id: "pos:readId" }];
    if (this.view()?.kind === "own") out.push({ kind: "list", id: "rows" });
    else if (this.result !== undefined) out.push({ kind: "list", id: "result" });
    return out;
  }

  async opened(ctx: Ctx): Promise<void> {
    if (this.known.event !== undefined) await this.explain(ctx);
  }

  private async explain(ctx: Ctx, argv?: readonly string[]): Promise<void> {
    const r = await this.run(ctx, argv);
    if (r !== undefined && !this.focusOn("rows")) this.focusOn("result");
  }

  /** The inspector's explain view of the answer, or undefined before a run or on a refusal. */
  view(): ExplainView | undefined {
    const answer = answerOf<ExplainResponse>(this.result, /\/api\/v1\/explain\//);
    if (answer === undefined) return undefined;
    const sent = requestOf<{ actor?: { id: string } }>(this.result, /\/api\/v1\/explain\//);
    const viewer = { id: sent?.actor?.id ?? "" };
    // The plane answered, so the read is the viewer's own (decision D5); its event, when known.
    const event =
      this.known.event?.id === this.form.get("pos:readId")
        ? this.known.event
        : ({
            op: "read",
            actor: viewer.id,
            id: String(this.form.get("pos:readId")),
          } as MemoryEvent);
    return explainView(viewer, event, answer, this.known.contents ?? new Map());
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    const v = this.view();
    const rows = v?.kind === "own" ? v.rows : [];
    switch (name) {
      case "submit":
        await this.explain(ctx);
        return true;
      case "rerun":
        if (this.result !== undefined) await this.explain(ctx, this.rerunLine(ctx));
        return true;
      case "accept": {
        if (stop?.kind === "list") {
          const row = rows[Math.max(0, Math.min(this.selected, rows.length - 1))];
          if (row !== undefined) openOnItem(ctx, "read --item", row.itemId);
          return true;
        }
        await this.explain(ctx);
        return true;
      }
      case "up":
      case "down":
        if (stop?.kind === "list")
          this.selected = Math.max(
            0,
            Math.min(rows.length - 1, this.selected + (name === "up" ? -1 : 1)),
          );
        else this.focus = Math.max(0, this.focus + (name === "up" ? -1 : 1));
        return true;
    }
    return false;
  }

  protected ownHints(): string {
    return this.view()?.kind === "own"
      ? "v plain  J json  enter item page  r again"
      : "enter explain  ctrl+o who you act as";
  }

  protected body(ctx: Ctx, width: number): string[] {
    const t = ctx.theme;
    const out = [
      this.fieldRow(ctx, "pos:readId", width, 6, "a read id; the session's last read is filled in"),
      ...this.errorHead(ctx, width),
    ];
    const r = this.result;
    if (r === undefined) {
      out.push(
        "",
        ...para(
          "Explains a read you made: each item it returned, its score and the rule that admitted it. Only a read's own reader may explain it.",
          width,
        ),
      );
      return out;
    }
    const v = this.view();
    if (v === undefined || v.kind !== "own") {
      out.push("", ` ${t.status("deny", "refused")}   exit ${r.code}`, "", ...errorLines(r, width));
      const ev = this.known.event;
      const me = viewerOf(ctx)?.id;
      if (ev !== undefined && ev.actor !== me)
        out.push(
          "",
          ...para(`This read was made by ${ev.actor}. You are acting as ${me ?? "no one"}.`, width),
          ...para("Change who you act as with ctrl+o, or pick one of your own reads.", width),
        );
      return out;
    }
    out.push(
      "",
      ` read ${String(this.form.get("pos:readId"))}: ${plural(v.rows.length, "explanation")}`,
      "",
    );
    if (v.counts === null) out.push(" This read's reason predates the counted format.");
    else {
      const c = v.counts;
      out.push(` Returned ${c.returned} of ${c.candidates} candidates; ${c.filtered} filtered.`);
      for (const cat of v.categories) out.push(`   ${cat.count} ${cat.label}`);
      out.push(
        ` ${c.out_of_reach} projected ${c.out_of_reach === 1 ? "item" : "items"} outside the reader's reach ${c.out_of_reach === 1 ? "was" : "were"} not candidates.`,
      );
    }
    out.push("", ` rank  ${fit("item", 38)}${fit("score", 9)}admitted by`);
    this.selected = Math.max(0, Math.min(this.selected, v.rows.length - 1));
    const focused = this.current()?.id === "rows";
    v.rows.forEach((row, i) => {
      const on = i === this.selected;
      const text = cut(
        ` ${on ? ">" : " "} ${String(row.rank).padEnd(4)}${fit(row.itemId, 38)}${fit(row.total.toFixed(4), 9)}${safe(row.admittedBy)}`,
        width,
      );
      out.push(on && focused ? t.reverse(text) : text);
    });
    const chosen = v.rows[this.selected];
    if (chosen !== undefined) {
      const answer = answerOf<ExplainResponse>(r, /\/api\/v1\/explain\//);
      const e = answer?.explanations.find((x) => x.item_id === chosen.itemId);
      out.push("", ` ${chosen.rank}. ${chosen.itemId}`);
      if (e !== undefined)
        for (const l of explanationLines(e as never)) out.push(cut(`    ${safe(l)}`, width));
      if (chosen.content !== null) out.push(cut(`    > ${oneLine(chosen.content)}`, width));
    }
    out.push(
      "",
      ...para(
        "An item's text is what the lanes show now, not its text when the read was made.",
        width,
      ),
    );
    return out;
  }
}

export type { RunResult };
