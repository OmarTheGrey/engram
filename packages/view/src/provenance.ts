// The item page's view logic (card E8.11): pure functions from what the
// server returned to the viewer (the items its read returned, the events
// visibleEvents gave it) to the provenance graph, the versions to diff and
// the events naming an item. No policy is decided here (AGENTS.md rule 1).
//
// The leak rule. An item's `lineage` names the ids of the versions it
// supersedes, whether or not the viewer may read them: a team item written
// from a note in a person scope names the note. So an id a lineage names
// becomes a node only when the server gave the viewer something of that item
// itself: its state (a read returned it, or a visible event carries it, which
// visibleEvents allows only when the read filter would return it now), or an
// allowed write or promotion of it among the viewer's events. visibleEvents
// shows a write only to a reader of its scope, and a promotion to a reader
// of its target or of its source scope (core's visible.ts): a reader of the
// source alone sees the promoted item's id in that event and, withheld, not
// its state, so the item page shows a node whose content is not shown,
// linked by no lineage (its lineage is in the state withheld). That is the
// event the timeline already shows, not a leak. Otherwise the id leaves no
// node, no edge and no count, and nothing on the page says one was left out.
import type { MemoryEvent, MemoryItem } from "@engram/sdk";

/** An item the viewer may see something of, with its latest state when it may see that. */
export interface KnownItem {
  id: string;
  /** The latest state the server gave the viewer, or null when it gave only an allowed write. */
  state: MemoryItem | null;
}

/** The ops whose allowed event makes the item it names one the viewer may see. */
const CREATING_OPS = new Set<MemoryEvent["op"]>(["write", "promote"]);
/** The ops whose allowed event retires the item it names (core's events.ts). */
const RETIRING_OPS = new Set<MemoryEvent["op"]>(["retire", "evict"]);
/**
 * Whether an event erases the item it names: core's `erases` (events.ts),
 * injected by the caller, since the package imports no runtime code and
 * holds no rule id (no-policy.test.ts). Without it, an erased item shows as
 * retired, its content already redacted in the log by core.
 */
export type Erases = (event: MemoryEvent) => boolean;
const NONE: Erases = () => false;

/**
 * The items the viewer may see something of: every item its read returned,
 * every item a visible event carries, and every item an allowed write or
 * promotion among its events names. The state kept is the read's, else the
 * one the latest event carries, retired by a later allowed retire or evict.
 * An id only a lineage, a denied write or a read's returned ids names is not
 * known.
 */
export function knownItems(
  items: readonly MemoryItem[],
  events: readonly MemoryEvent[],
  erases: Erases = NONE,
): Map<string, KnownItem> {
  const known = new Map<string, KnownItem>();
  for (const e of events) {
    if (e.item) known.set(e.item.id, { id: e.item.id, state: e.item });
    else if (
      // An allowed retire or evict carries no item and retires the one it
      // names, as core's projection does (events.ts applyEvent): a drift or
      // ttl retirement shows as retired (card D4).
      e.item_id !== null &&
      e.decision === "allow" &&
      RETIRING_OPS.has(e.op)
    ) {
      // An erasure removes its item, as core's projection does (events.ts
      // erases): it is absent, not retired.
      if (erases(e)) {
        known.delete(e.item_id);
        continue;
      }
      const was = known.get(e.item_id)?.state;
      if (was) known.set(e.item_id, { id: e.item_id, state: { ...was, status: "retired" } });
    } else if (
      e.item_id !== null &&
      e.decision === "allow" &&
      CREATING_OPS.has(e.op) &&
      !known.has(e.item_id)
    )
      known.set(e.item_id, { id: e.item_id, state: null });
  }
  for (const item of items) known.set(item.id, { id: item.id, state: item });
  return known;
}

export interface ItemNode {
  kind: "item";
  id: string;
  /** The item whose page this is. */
  focus: boolean;
  state: MemoryItem | null;
}

export interface EventNode {
  kind: "event";
  id: string;
  event: MemoryEvent;
}

export type GraphNode = ItemNode | EventNode;

export interface GraphEdge {
  /** `lineage:<ancestor>><version>` or `decision:<item>><event>`. */
  id: string;
  source: string;
  target: string;
  kind: "lineage" | "decision";
}

export interface ProvenanceGraph {
  /** Item nodes by id, then event nodes in log order. */
  nodes: GraphNode[];
  /** Lineage edges by their version's node order and its lineage order, then decision edges in log order. */
  edges: GraphEdge[];
  /** How many item nodes and event nodes: only what the nodes are, never what was left out. */
  items: number;
  decisions: number;
}

/**
 * The provenance graph of `focusId` for the viewer: the item, every item
 * linked to it by a lineage both ends of which the viewer may see (ancestors
 * and descendants, followed through each other), and the decision events
 * naming any of them (every op but a read; a read is a recall, listed in the
 * item's event table). Null when the viewer may see nothing of the item.
 */
export function provenanceGraph(
  focusId: string,
  items: readonly MemoryItem[],
  events: readonly MemoryEvent[],
  erases: Erases = NONE,
): ProvenanceGraph | null {
  const known = knownItems(items, events, erases);
  if (!known.has(focusId)) return null;
  // Every lineage link whose two ends the viewer may see; an item is never its own ancestor.
  const links: [string, string][] = [];
  for (const k of [...known.values()].sort((a, b) => compare(a.id, b.id)))
    for (const ancestor of k.state?.lineage ?? [])
      if (ancestor !== k.id && known.has(ancestor)) links.push([ancestor, k.id]);
  // The items linked to the focus, through links either way.
  const reached = new Set([focusId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [a, b] of links)
      if (reached.has(a) !== reached.has(b)) {
        reached.add(reached.has(a) ? b : a);
        grew = true;
      }
  }
  const itemIds = [...reached].sort(compare);
  const lineageEdges = itemIds.flatMap((target) =>
    [...new Set(known.get(target)?.state?.lineage ?? [])]
      .filter((source) => source !== target && reached.has(source))
      .map(
        (source): GraphEdge => ({
          id: `lineage:${source}>${target}`,
          source,
          target,
          kind: "lineage",
        }),
      ),
  );
  const decided = events.filter(
    (e) => e.op !== "read" && e.item_id !== null && reached.has(e.item_id),
  );
  return {
    nodes: [
      ...itemIds.map(
        (id): ItemNode => ({
          kind: "item",
          id,
          focus: id === focusId,
          state: known.get(id)?.state ?? null,
        }),
      ),
      ...decided.map((event): EventNode => ({ kind: "event", id: event.id, event })),
    ],
    edges: [
      ...lineageEdges,
      ...decided.map(
        (e): GraphEdge => ({
          id: `decision:${e.item_id}>${e.id}`,
          source: e.item_id as string,
          target: e.id,
          kind: "decision",
        }),
      ),
    ],
    items: itemIds.length,
    decisions: decided.length,
  };
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** One version of an item the viewer may diff. */
export interface Version {
  /** The id of the event that carries it, or `current:<item id>` for a state only the read returned. */
  key: string;
  itemId: string;
  version: number;
  /** The content as the diff compares it. */
  text: string;
  /** The event that made this version, or null when the viewer sees none. */
  event: MemoryEvent | null;
  label: string;
}

/** An item's content as text: a string as it is, anything else as indented JSON. */
export function versionText(item: MemoryItem): string {
  return typeof item.content === "string" ? item.content : JSON.stringify(item.content, null, 2);
}

/**
 * The versions of `focusId` the viewer may diff: every state of the item and
 * of its ancestors in the provenance graph that a visible event carries, in
 * log order, each with the event that made it; and the read's state of the
 * item when no event carries that version (an item read through a grant
 * whose writes the viewer does not see). Empty when the graph is null.
 */
export function itemVersions(
  focusId: string,
  items: readonly MemoryItem[],
  events: readonly MemoryEvent[],
  erases: Erases = NONE,
): Version[] {
  const graph = provenanceGraph(focusId, items, events, erases);
  if (graph === null) return [];
  // The focus and the item nodes it descends from, through lineage edges.
  const ancestors = new Set([focusId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of graph.edges)
      if (e.kind === "lineage" && ancestors.has(e.target) && !ancestors.has(e.source)) {
        ancestors.add(e.source);
        grew = true;
      }
  }
  const of = (state: MemoryItem, event: MemoryEvent | null): Version => ({
    key: event?.id ?? `current:${state.id}`,
    itemId: state.id,
    version: state.version,
    text: versionText(state),
    event,
    label: `${state.id === focusId ? "this item" : state.id} v${state.version}${event ? `, event ${event.seq} (${event.op})` : ", as read now"}`,
  });
  const versions = events.flatMap((e) =>
    e.item && ancestors.has(e.item.id) ? [of(e.item, e)] : [],
  );
  const current = items.find((i) => i.id === focusId);
  if (
    current !== undefined &&
    !versions.some((v) => v.itemId === focusId && v.version === current.version)
  )
    versions.push(of(current, null));
  return versions;
}

/** The events naming `itemId`, in log order: those about it, and the reads that returned it. */
export function itemEvents(itemId: string, events: readonly MemoryEvent[]): MemoryEvent[] {
  return events.filter((e) => e.item_id === itemId || (e.item_ids ?? []).includes(itemId));
}
