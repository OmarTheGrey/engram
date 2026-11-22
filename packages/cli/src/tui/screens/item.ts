// The item page (card E8.15c, docs/design/tui.md 8.17): the inspector's
// item page (card E8.11) in the terminal. Its provenance is an indented tree
// of the same provenanceGraph nodes and edges, its versions are itemVersions
// with a line diff between two, and its events are itemEvents: all from
// @engram/view, over what this session's reads as the actor now acting and
// one `engram events` returned. The leak rule is the package's: an ancestor
// the viewer may not see leaves no node, no edge and no count, and the page
// never prints an item's lineage itself. Opened by id, with no read of the
// item in the session, the page runs `engram read --item <id>` first, a read
// (with a store folder it asks once a session, 8.5).
import type { MemoryEvent, MemoryItem } from "@engram/sdk";
import {
  eventDetail,
  type GraphEdge,
  type ItemNode,
  itemEvents,
  itemVersions,
  type ProvenanceGraph,
  provenanceGraph,
  type Version,
} from "@engram/view";
import { type CommandSpec, command } from "../../registry.ts";
import { actorKeyNow, actorKeyOfResult, madeAsOther } from "../actor.ts";
import { Form } from "../forms.ts";
import { box, cut, fit, para } from "../layout.ts";
import type { RunResult } from "../runner.ts";
import type { Ctx } from "../screen.ts";
import { openOnItem } from "./read.ts";
import {
  answerOf,
  decisionHead,
  errorLines,
  firstLine,
  oneLine,
  RichScreen,
  readItems,
  type Stop,
  safe,
  statusOf,
  viewerOf,
  windowOf,
} from "./rich.ts";

/** The lines of `a` and `b` as a line diff: kept, removed and added, in order (an LCS). */
export function lineDiff(a: string, b: string): { op: " " | "-" | "+"; text: string }[] {
  const x = a.split("\n");
  const y = b.split("\n");
  const n = x.length;
  const m = y.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      (lcs[i] as number[])[j] =
        x[i] === y[j]
          ? ((lcs[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((lcs[i + 1] as number[])[j] as number, (lcs[i] as number[])[j + 1] as number);
  const out: { op: " " | "-" | "+"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      out.push({ op: " ", text: x[i] as string });
      i++;
      j++;
    } else if (
      j < m &&
      (i >= n || ((lcs[i] as number[])[j + 1] as number) >= ((lcs[i + 1] as number[])[j] as number))
    ) {
      out.push({ op: "+", text: y[j] as string });
      j++;
    } else {
      out.push({ op: "-", text: x[i] as string });
      i++;
    }
  }
  return out;
}

type Pane = "provenance" | "versions" | "events";

export class ItemScreen extends RichScreen {
  readonly kind = "item" as const;
  /** The `engram events` run the page is built from. */
  private events: RunResult | undefined;
  /** The `engram read --item` run, when the page made one. */
  private readById: RunResult | undefined;
  private sel: Record<Pane, number> = { provenance: 0, versions: 0, events: 0 };
  private detail = false;

  constructor(spec: CommandSpec, ctx: Ctx, values = {}, positionals: readonly string[] = []) {
    super(spec, ctx, values, positionals);
  }

  override title(): string {
    return "Item page";
  }

  /** The item whose page this is. */
  itemId(): string {
    return String(this.form.get("pos:itemId")).trim();
  }

  stops(): Stop[] {
    if (this.events === undefined) return [{ kind: "field", id: "pos:itemId" }];
    return [
      { kind: "list", id: "provenance" },
      { kind: "list", id: "versions" },
      { kind: "list", id: "events" },
    ];
  }

  async opened(ctx: Ctx): Promise<void> {
    if (this.itemId() !== "") await this.load(ctx);
  }

  /** Reads the item by id when the session has no read of it, then the events; asks where 8.5 says. */
  private async load(
    ctx: Ctx,
    readLine?: readonly string[],
    eventsLine?: readonly string[],
  ): Promise<void> {
    const id = this.itemId();
    if (!readItems(ctx).some((i) => i.id === id)) {
      const r = await this.run(ctx, readLine);
      if (r === undefined) return;
      this.readById = r;
      if (r.code !== 0) return;
    }
    const spec = command("events") as CommandSpec;
    const events = new Form(spec, ctx.ws);
    if (events.validate(ctx.ws, ctx.io).length > 0) return;
    const r = await ctx.act(spec, eventsLine ?? events.argv(ctx.ws), events.flagValues());
    if (r === undefined) return;
    this.events = r;
    this.result = r;
    this.edited = false;
    this.focusOn("provenance");
  }

  /** The events the page was built from, only when they were made as the actor now (review finding 1). */
  private visibleEvents(ctx: Ctx): MemoryEvent[] {
    if (actorKeyOfResult(this.events) !== actorKeyNow(ctx.ws)) return [];
    return answerOf<{ events: MemoryEvent[] }>(this.events, /\/api\/v1\/events$/)?.events ?? [];
  }

  protected override staleAs(ctx: Ctx): string | undefined {
    return madeAsOther(ctx.ws, this.events) ?? madeAsOther(ctx.ws, this.readById);
  }

  /** The page's three parts, from @engram/view over the session's answers as this actor. */
  page(ctx: Ctx): {
    graph: ProvenanceGraph | null;
    versions: Version[];
    events: MemoryEvent[];
    items: MemoryItem[];
  } {
    const items = readItems(ctx);
    const events = this.visibleEvents(ctx);
    const id = this.itemId();
    return {
      graph: provenanceGraph(id, items, events),
      versions: itemVersions(id, items, events),
      events: itemEvents(id, events),
      items,
    };
  }

  protected async onKey(name: string, ctx: Ctx, stop: Stop | undefined): Promise<boolean> {
    const pane = stop?.kind === "list" ? (stop.id as Pane) : undefined;
    switch (name) {
      case "rerun": {
        // The same command lines again (N1): the actor's flags the workspace's when another actor made them.
        const read = this.readById === undefined ? undefined : this.rerunLine(ctx, this.readById);
        const events = this.events === undefined ? undefined : this.rerunLine(ctx, this.events);
        this.events = undefined;
        this.readById = undefined;
        await this.load(ctx, read, events);
        return true;
      }
      case "accept":
      case "submit":
        if (pane === undefined) {
          await this.load(ctx);
          return true;
        }
        if (pane === "events") this.detail = !this.detail;
        return true;
      case "up":
      case "down":
        if (pane !== undefined)
          this.sel[pane] = Math.max(0, this.sel[pane] + (name === "up" ? -1 : 1));
        return true;
      case "promote":
      case "grants":
      case "who":
      case "supersede":
        if (this.itemId() === "") return true;
        openOnItem(
          ctx,
          { promote: "promote", grants: "grants", who: "who-can-read", supersede: "supersede" }[
            name
          ],
          this.itemId(),
        );
        return true;
    }
    return false;
  }

  protected ownHints(): string {
    return this.events === undefined
      ? "enter open"
      : "p promote  g grants  w who  S supersede  enter event  tab pane";
  }

  /** The provenance tree: the focus, its decisions, then its ancestors and descendants, indented. */
  private treeLines(ctx: Ctx, graph: ProvenanceGraph): string[] {
    const t = ctx.theme;
    const nodes = new Map(
      graph.nodes.flatMap((n) => (n.kind === "item" ? [[n.id, n] as [string, ItemNode]] : [])),
    );
    const decisions = (id: string) =>
      graph.nodes.flatMap((n) => (n.kind === "event" && n.event.item_id === id ? [n.event] : []));
    const lineage = graph.edges.filter((e): e is GraphEdge => e.kind === "lineage");
    const label = (n: ItemNode) =>
      n.state === null
        ? `${n.focus ? "This item" : n.id}  (its content is not yours to see)`
        : `${n.focus ? "This item" : n.id}  v${n.state.version}  ${n.state.scope}`;
    // The tree's branches in the theme's glyphs: ASCII under --ascii (11.7).
    const ascii = t.glyphSet === "ascii";
    const tee = ascii ? "|- " : "├─ ";
    const elbow = ascii ? "`- " : "└─ ";
    const out: string[] = [];
    const seen = new Set<string>();
    const walk = (id: string, indent: string, head: string) => {
      const n = nodes.get(id);
      if (n === undefined || seen.has(id)) return;
      seen.add(id);
      out.push(`${indent}${head}${label(n)}`);
      const kids: string[] = [];
      for (const e of decisions(id))
        kids.push(
          `${e.op === "write" ? "written" : e.op} by event ${e.seq}, ${e.op} ${t.symbol(e.decision === "allow" ? "allow" : e.decision === "ask" ? "ask" : "deny")} ${e.decision}, ${e.actor}`,
        );
      const from = lineage.filter((e) => e.target === id && !seen.has(e.source));
      const later = n.focus ? lineage.filter((e) => e.source === id && !seen.has(e.target)) : [];
      const deeper = indent + (head === "" ? "" : "   ");
      if (from.length === 0 && later.length === 0 && n.focus) kids.push("no earlier version");
      kids.forEach((k, i) => {
        const last = i === kids.length - 1 && from.length === 0 && later.length === 0;
        out.push(`${deeper}${last ? elbow : tee}${k}`);
      });
      for (const e of from) walk(e.source, deeper, `${elbow}from `);
      for (const e of later) walk(e.target, deeper, `${elbow}superseded by `);
    };
    const focus = [...nodes.values()].find((n) => n.focus);
    if (focus !== undefined) walk(focus.id, " ", "");
    return out.map((l) => cut(safe(l), 200));
  }

  protected body(ctx: Ctx, width: number, height: number): string[] {
    const t = ctx.theme;
    const out: string[] = [];
    if (this.itemId() === "" || this.events === undefined) {
      out.push(
        this.fieldRow(ctx, "pos:itemId", width, 6, "an item id (a UUIDv7)"),
        ...this.errorHead(ctx, width),
        "",
      );
      const r = this.readById ?? this.result;
      if (r !== undefined && r.code !== 0)
        out.push(decisionHead(t, this.command_, r), "", ...errorLines(r, width));
      else
        out.push(
          ...para(
            "Opens an item's page: its provenance, its versions and the events naming it, from engram read --item and engram events.",
            width,
          ),
        );
      return out;
    }
    const { graph, versions, events } = this.page(ctx);
    const id = this.itemId();
    if (graph === null) {
      out.push(
        ` ${id}`,
        "",
        ...para(
          "Nothing of this item is yours to see: no read you made returned it and no event you may see names it.",
          width,
        ),
      );
      return out;
    }
    const state = (graph.nodes.find((n) => n.kind === "item" && n.focus) as ItemNode).state;
    if (state === null) out.push(cut(` ${id}   its content is not yours to see`, width));
    else {
      out.push(cut(` ${id}   ${state.class}   ${state.scope}   ${state.status}`, width));
      out.push(cut(` ${firstLine(state)}`, width));
      const ref = state.store_ref ? `${state.store_ref.adapter}:${state.store_ref.key}` : "nowhere";
      out.push(
        ...para(
          oneLine(
            `owner ${state.owner}  source ${state.provenance.kind} ${state.provenance.ref}  confidence ${state.confidence}  valid from ${state.valid_from}, ${state.valid_to ?? "open"}  grants ${state.grants.length === 0 ? "none" : state.grants.length}  stored ${ref}`,
          ),
          width,
        ),
      );
    }
    const rest = height - out.length;
    const focus = this.current()?.id;
    const pick = (pane: Pane, lines: string[], size: number, title: string, rowsOf?: number[]) => {
      const room = size - 2;
      const at = Math.min(this.sel[pane], Math.max(0, (rowsOf?.length ?? lines.length) - 1));
      this.sel[pane] = at;
      const line = rowsOf?.[at] ?? at;
      const start = windowOf(line, lines.length, room, 0);
      const shown = lines
        .slice(start, start + room)
        .map((l, i) => (focus === pane && start + i === line ? t.reverse(cut(l, width - 2)) : l));
      return box(t, title, shown, width, size);
    };
    const tree = this.treeLines(ctx, graph);
    const provHeight = Math.max(4, Math.min(tree.length + 2, Math.floor(rest / 3)));
    out.push(...pick("provenance", tree, provHeight, "Provenance"));
    // Versions: the list, then the diff of the selected one against the next.
    const vLines: string[] = [];
    if (versions.length <= 1) vLines.push(" one version; nothing to compare");
    else {
      const a = Math.min(this.sel.versions, versions.length - 2);
      const from = versions[a] as Version;
      const to = versions[a + 1] as Version;
      vLines.push(` ${oneLine(from.label)}  to  ${oneLine(to.label)}   up down another pair`);
      for (const d of lineDiff(from.text, to.text)) vLines.push(` ${d.op} ${oneLine(d.text)}`);
    }
    const evHeight = Math.max(
      4,
      rest - provHeight - Math.min(vLines.length + 2, Math.floor(rest / 3)),
    );
    const verHeight = rest - provHeight - evHeight;
    out.push(
      ...box(
        t,
        `Versions  ${versions.length === 0 ? 0 : Math.min(this.sel.versions + 1, versions.length)} of ${versions.length}`,
        vLines.map((l) => cut(l, width - 2)),
        width,
        verHeight,
      ),
    );
    const eLines = events.map((e) =>
      cut(
        ` ${String(e.seq).padStart(4)}  ${fit(e.op, 8)} ${t.status(e.decision === "allow" ? "allow" : e.decision === "ask" ? "ask" : "deny", fit(e.decision, 6))}  ${safe(e.policy_id)}`,
        width - 2,
      ),
    );
    if (eLines.length === 0) eLines.push(" no event you may see names this item");
    const chosen = events[Math.min(this.sel.events, events.length - 1)];
    // The detail in place of the list, the reason second and whole, so it is in reach at 80x24 (review 14).
    if (this.detail && chosen !== undefined) {
      const fields = eventDetail(chosen);
      const reason = fields.find(([k]) => k === "reason")?.[1] ?? "";
      const lines = [
        cut(
          ` event ${chosen.seq}  ${chosen.op}  ${t.status(statusOf(chosen.decision), chosen.decision)}  by ${chosen.actor}`,
          width - 2,
        ),
        ...para(`reason     ${oneLine(reason)}`, width - 2, "   "),
        ...fields
          .filter(([k]) => k !== "reason")
          .map(([k, v]) => cut(`   ${fit(k, 11)}${oneLine(v)}`, width - 2)),
      ];
      out.push(
        ...box(t, `Event ${chosen.seq}  enter goes back to the list`, lines, width, evHeight),
      );
      return out;
    }
    out.push(
      ...pick(
        "events",
        eLines,
        evHeight,
        "Events naming this item",
        events.map((_, i) => i),
      ),
    );
    return out;
  }
}
