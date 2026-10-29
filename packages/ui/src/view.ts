// The inspector's view logic (cards E8.5 and E8.6; plan
// docs/tasks/gate-b-plan.md, decision 5): pure functions from what the API
// returned to what each view shows. No policy is decided here (AGENTS.md
// rule 1): lanes are what Plane.read returned to the viewer, the timeline is
// what visibleEvents gave, and the explain view's counts are core's
// readCounts, carried by the explain route. These functions only group,
// filter what is already visible, and label.
import type {
  Actor,
  ExplainResponse,
  Explanation,
  MemoryEvent,
  MemoryItem,
  ReadCounts,
  ReadResponse,
} from "./api/index.ts";

export const LEVELS = ["person", "role", "team", "org"] as const;
export type Level = Actor["level"];

// The viewer picker.

/** Member scopes from the picker's text: split on commas and white space, trimmed, first occurrence kept. */
export function parseMemberships(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).filter((s) => s.length > 0))];
}

export const formatMemberships = (memberships: readonly string[]) => memberships.join(", ");

/**
 * The actor the picker names, or the reason it names none. The id and the
 * scopes are self-asserted (ADR 0027 decision 5); the server checks the
 * actor's shape and answers 400 for a malformed one.
 */
export function viewerFrom(id: string, level: string, memberships: string): Actor | string {
  const trimmed = id.trim();
  if (trimmed === "") return "the viewer needs an id, such as person:dana";
  if (!(LEVELS as readonly string[]).includes(level)) return `unknown level ${level}`;
  return { id: trimmed, level: level as Level, memberships: parseMemberships(memberships) };
}

// Scope lanes (card E8.5).

export interface LaneItem {
  id: string;
  content: string;
  class: MemoryItem["class"];
  status: MemoryItem["status"];
  provenance: MemoryItem["provenance"]["kind"];
  validity: string;
  rank: number | null;
  admittedBy: string | null;
}

export interface Lane {
  scope: string;
  /** Whether the viewer is a member of the scope; otherwise it was reached through a grant. */
  member: boolean;
  items: LaneItem[];
}

export const contentText = (item: Pick<MemoryItem, "content">) =>
  typeof item.content === "string" ? item.content : JSON.stringify(item.content);

/** An item's validity window, as the lanes and the explain view print it. */
export function validityText(validity: { valid_from: string; valid_to: string | null }): string {
  return validity.valid_to === null
    ? `from ${validity.valid_from}`
    : `${validity.valid_from} to ${validity.valid_to}`;
}

/**
 * The lanes of one read the viewer made: a lane per member scope (empty ones
 * included, in the viewer's order), then a lane per other scope an item came
 * from (reached through a grant), sorted; items in the read's rank order.
 * Only the items the read returned appear: nothing is added from elsewhere.
 */
export function buildLanes(viewer: Pick<Actor, "memberships">, read: ReadResponse): Lane[] {
  const byId = new Map(read.explanations.map((e) => [e.item_id, e]));
  const lanes = new Map<string, Lane>();
  for (const scope of viewer.memberships) lanes.set(scope, { scope, member: true, items: [] });
  const ranked = [...read.items].sort(
    (a, b) => (byId.get(a.id)?.rank ?? Infinity) - (byId.get(b.id)?.rank ?? Infinity),
  );
  const others = [...new Set(ranked.map((i) => i.scope).filter((s) => !lanes.has(s)))].sort();
  for (const scope of others) lanes.set(scope, { scope, member: false, items: [] });
  for (const item of ranked) {
    const e = byId.get(item.id);
    lanes.get(item.scope)?.items.push({
      id: item.id,
      content: contentText(item),
      class: item.class,
      status: item.status,
      provenance: item.provenance.kind,
      validity: validityText(item),
      rank: e?.rank ?? null,
      admittedBy: e?.policy_id ?? null,
    });
  }
  return [...lanes.values()];
}

// The timeline (card E8.5).

export interface TimelineFilter {
  scope: string | null;
  op: string | null;
  decision: string | null;
}

export const NO_FILTER: TimelineFilter = { scope: null, op: null, decision: null };

const scopesOf = (e: MemoryEvent) =>
  [e.scope_from, e.scope_to].filter((s): s is string => s !== null);

/** The values each filter offers: those the visible events carry, sorted. */
export function filterOptions(events: readonly MemoryEvent[]) {
  const sorted = (values: Iterable<string>) => [...new Set(values)].sort();
  return {
    scopes: sorted(events.flatMap(scopesOf)),
    ops: sorted(events.map((e) => e.op)),
    decisions: sorted(events.map((e) => e.decision)),
  };
}

/** The visible events a filter keeps, in log order; a scope matches the source or the target. */
export function filterEvents(
  events: readonly MemoryEvent[],
  filter: TimelineFilter,
): MemoryEvent[] {
  return events.filter(
    (e) =>
      (filter.scope === null || scopesOf(e).includes(filter.scope)) &&
      (filter.op === null || e.op === filter.op) &&
      (filter.decision === null || e.decision === filter.decision),
  );
}

/**
 * The selection after a change of viewer: the new viewer's copy of the event
 * when its timeline holds it (that copy may withhold the item the previous
 * viewer's copy carried), else the selected read itself (another actor's read
 * shows its event and who may explain it, decision 5); otherwise nothing is
 * selected, so an event the new viewer may not see never stays on screen.
 */
export function keepSelection(
  selected: MemoryEvent | null,
  visible: readonly MemoryEvent[],
): MemoryEvent | null {
  if (selected === null) return null;
  const fresh = visible.find((e) => e.id === selected.id);
  if (fresh !== undefined) return fresh;
  return selected.op === "read" ? selected : null;
}

/** The scope column: the source and target scopes, or a dash for an event that names none. */
export function scopeText(e: Pick<MemoryEvent, "scope_from" | "scope_to">): string {
  if (e.scope_from !== null && e.scope_to !== null && e.scope_from !== e.scope_to)
    return `${e.scope_from} to ${e.scope_to}`;
  return e.scope_to ?? e.scope_from ?? "-";
}

/** Every field of an event, labelled, for its detail panel. */
export function eventDetail(e: MemoryEvent): [string, string][] {
  return [
    ["id", e.id],
    ["seq", String(e.seq)],
    ["time", e.ts],
    ["op", e.op],
    ["decision", e.decision],
    ["actor", e.actor],
    ["item", e.item_id ?? "-"],
    ["from scope", e.scope_from ?? "-"],
    ["to scope", e.scope_to ?? "-"],
    ["policy id", e.policy_id],
    ["reason", e.reason],
  ];
}

// The explain view (card E8.6).

/** The filtered categories of a read, as the explain view labels them, in the reason's order. */
export const FILTER_CATEGORIES = [
  ["outside_validity", "outside the validity window"],
  ["not_active", "not active"],
  ["expired", "past their ttl"],
  ["excluded", "by a grant's class or expiry"],
] as const satisfies readonly (readonly [keyof ReadCounts, string])[];

export interface ExplainRow {
  rank: number;
  itemId: string;
  /** The item's text in the current lanes, not at the read's time; null when it is not in them. */
  content: string | null;
  total: number;
  components: [string, number][];
  admittedBy: string;
  grantsUsed: string[];
  validity: string;
}

export type ExplainView =
  | { kind: "not-read"; event: MemoryEvent }
  | { kind: "other"; event: MemoryEvent; reader: string; line: string }
  | {
      kind: "own";
      event: MemoryEvent;
      rows: ExplainRow[];
      counts: ReadCounts | null;
      categories: { key: keyof ReadCounts; label: string; count: number }[];
    };

/**
 * Whether the viewer may ask to explain `event`: its own read, another
 * actor's read (only its reader may explain it, decision D5), or no read.
 * The plane enforces the rule; this only spares a call it would refuse.
 */
export function explainTarget(
  viewer: Pick<Actor, "id">,
  event: Pick<MemoryEvent, "op" | "actor">,
): "own" | "other" | "not-read" {
  if (event.op !== "read") return "not-read";
  return event.actor === viewer.id ? "own" : "other";
}

export const otherReaderLine = (reader: string) =>
  `Only ${reader}, who made this read, may explain it (decision D5).`;

function explainRow(e: Explanation, contents: ReadonlyMap<string, string>): ExplainRow {
  return {
    rank: e.rank,
    itemId: e.item_id,
    content: contents.get(e.item_id) ?? null,
    total: e.score.total,
    components: Object.entries(e.score.components),
    admittedBy: e.policy_id,
    grantsUsed: e.grants_used,
    validity: `${validityText(e.validity)}, read at ${e.validity.at}`,
  };
}

/**
 * The explain view of `event` for `viewer`. For another actor's read, or when
 * the server refused (`response` null), the event and the line naming its
 * reader; for the viewer's own read, the explanations in rank order and the
 * counts the explain route parsed from the event's reason.
 */
export function explainView(
  viewer: Pick<Actor, "id">,
  event: MemoryEvent,
  response: ExplainResponse | null,
  contents: ReadonlyMap<string, string> = new Map(),
): ExplainView {
  const target = explainTarget(viewer, event);
  if (target === "not-read") return { kind: "not-read", event };
  if (target === "other" || response === null)
    return { kind: "other", event, reader: event.actor, line: otherReaderLine(event.actor) };
  const counts = response.counts;
  return {
    kind: "own",
    event,
    rows: [...response.explanations]
      .sort((a, b) => a.rank - b.rank)
      .map((e) => explainRow(e, contents)),
    counts,
    categories:
      counts === null
        ? []
        : FILTER_CATEGORIES.map(([key, label]) => ({ key, label, count: counts[key] })),
  };
}

/** Score numbers as the views print them. */
export const score = (n: number) => n.toFixed(3);
