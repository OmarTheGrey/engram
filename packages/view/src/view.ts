// The inspector's view logic (cards E8.5, E8.6 and E9.4; plan
// docs/tasks/gate-b-plan.md, decision 5): pure functions from what the API
// returned to what each view shows. No policy is decided here (AGENTS.md
// rule 1): lanes are what Plane.read returned to the viewer, the timeline is
// what visibleEvents gave, the explain view's counts are core's readCounts,
// carried by the explain route, and a grant change is decided by the plane
// (Plane.changeGrants), whose decision the grants editor shows. These
// functions only group, filter what is already visible, read a form, and label.
import type {
  Actor,
  ExplainResponse,
  Explanation,
  Grant,
  GrantResponse,
  MemoryEvent,
  MemoryItem,
  ReadCounts,
  ReadResponse,
  WhoCanReadAnswer,
} from "@engram/sdk";

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
  owner: string;
  /**
   * The grants the lanes show (card E9.4): every grant the item carries when
   * the viewer is its owner, otherwise only those naming the viewer (review
   * finding M2 of PR #44). The read returns them all; the inspector does not
   * show one grantee who else may read the item.
   */
  grants: Grant[];
  /** Whether `grants` is every grant on the item, or only the viewer's own. */
  grantsShown: "all" | "yours";
}

/** Does a grant's `to` name `viewerId`: exactly, or by a prefix ending in `*`. Display only. */
export const namesViewer = (to: string, viewerId: string) =>
  to.endsWith("*") ? viewerId.startsWith(to.slice(0, -1)) : to === viewerId;

/** The grants to show `viewerId` on an item `owner` owns: all to the owner, its own to anyone else. */
export function shownGrants(
  grants: readonly Grant[],
  owner: string,
  viewerId: string,
): { grants: Grant[]; grantsShown: "all" | "yours" } {
  if (owner === viewerId) return { grants: [...grants], grantsShown: "all" };
  return { grants: grants.filter((g) => namesViewer(g.to, viewerId)), grantsShown: "yours" };
}

export interface Lane {
  scope: string;
  /** The scope's level, read from its name: `person:<id>`, `role:<id>`, `team:<id>` or `org`. */
  kind: Level;
  /** Whether the viewer is a member of the scope; otherwise it was reached through a grant. */
  member: boolean;
  items: LaneItem[];
}

/** A scope's level, from its name. */
export const scopeKind = (scope: string): Level =>
  (scope === "org" ? "org" : scope.split(":")[0]) as Level;

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
export function buildLanes(viewer: Pick<Actor, "id" | "memberships">, read: ReadResponse): Lane[] {
  const byId = new Map(read.explanations.map((e) => [e.item_id, e]));
  const lanes = new Map<string, Lane>();
  for (const scope of viewer.memberships)
    lanes.set(scope, { scope, kind: scopeKind(scope), member: true, items: [] });
  const ranked = [...read.items].sort(
    (a, b) => (byId.get(a.id)?.rank ?? Infinity) - (byId.get(b.id)?.rank ?? Infinity),
  );
  const others = [...new Set(ranked.map((i) => i.scope).filter((s) => !lanes.has(s)))].sort();
  for (const scope of others)
    lanes.set(scope, { scope, kind: scopeKind(scope), member: false, items: [] });
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
      owner: item.owner,
      ...shownGrants(item.grants, item.owner, viewer.id),
    });
  }
  return [...lanes.values()];
}

// Person versus role lanes (card E9.4, the twin profile, ADR 0021).

export type LaneGroupKey = "person" | "role" | "shared" | "granted";

export interface LaneGroup {
  key: LaneGroupKey;
  title: string;
  /** What the group holds, in one line. */
  note: string;
  lanes: Lane[];
}

/**
 * The lanes in the twin's groups: the viewer's person scope, the role scopes
 * it holds, the team and org scopes it is a member of, and the scopes it
 * reached only through a grant. The person and role groups are always
 * shown, empty or not, since the split is what the twin profile is about;
 * the other two only when they hold a lane. Lane order within a group is
 * buildLanes' order.
 */
export function laneGroups(lanes: readonly Lane[]): LaneGroup[] {
  const of = (key: LaneGroupKey) =>
    lanes.filter((l) =>
      key === "granted"
        ? !l.member
        : l.member && (key === "shared" ? l.kind === "team" || l.kind === "org" : l.kind === key),
    );
  const groups: LaneGroup[] = [
    {
      key: "person",
      title: "Person scope",
      note: "The viewer's own memory: no one else reads it without a grant.",
      lanes: of("person"),
    },
    {
      key: "role",
      title: "Role scopes",
      note: "The work memory of each role the viewer holds, handed to a successor at offboarding.",
      lanes: of("role"),
    },
    {
      key: "shared",
      title: "Team and org",
      note: "Shared scopes the viewer is a member of.",
      lanes: of("shared"),
    },
    {
      key: "granted",
      title: "Through a grant",
      note: "Items in scopes the viewer is not a member of, admitted by a live grant naming it.",
      lanes: of("granted"),
    },
  ];
  return groups.filter((g) => g.key === "person" || g.key === "role" || g.lanes.length > 0);
}

// The grants editor (card E9.4).

export const GRANT_CLASSES = ["episodic", "semantic", "procedural"] as const;
export const GRANT_MODES = ["read", "read_write"] as const;

/** The add-grant form as typed: an empty class or expiry means none. */
export interface GrantDraft {
  to: string;
  class: string;
  mode: string;
  expires: string;
}

export const EMPTY_DRAFT: GrantDraft = { to: "", class: "semantic", mode: "read", expires: "" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * The grant a draft names, or why it names none. Only the form is read here:
 * a date becomes midnight UTC, a timestamp must be UTC with a Z, and an empty
 * class or expiry is left out. Whether the grant is acceptable (a principal
 * or a prefixed pattern, a class, an expiry in the future) is the plane's
 * decision, recorded as an event either way; the editor shows it.
 */
export function grantFrom(draft: GrantDraft): Grant | string {
  const to = draft.to.trim();
  if (to === "") return "a grant names who it is for, such as person:sam";
  if (draft.class !== "" && !(GRANT_CLASSES as readonly string[]).includes(draft.class))
    return `unknown class ${draft.class}`;
  if (!(GRANT_MODES as readonly string[]).includes(draft.mode)) return `unknown mode ${draft.mode}`;
  const typed = draft.expires.trim();
  let expires: string | undefined;
  if (typed === "") expires = undefined;
  else if (DATE.test(typed)) expires = `${typed}T00:00:00Z`;
  else if (INSTANT.test(typed)) expires = typed;
  else return "the expiry is a UTC date (2026-12-01) or timestamp (2026-12-01T00:00:00Z)";
  return {
    to,
    ...(draft.class === "" ? {} : { class: draft.class as NonNullable<Grant["class"]> }),
    mode: draft.mode as Grant["mode"],
    ...(expires === undefined ? {} : { expires }),
  };
}

/** A grant as the editor lists it. */
export function grantLabel(g: Grant): string {
  const until = g.expires === undefined ? "no expiry" : `until ${g.expires}`;
  return `${g.to}: ${g.class ?? "any class"}, ${g.mode}, ${until}`;
}

/** What the editor says about the plane's decision on a change. */
export interface GrantOutcome {
  itemId: string;
  decision: GrantResponse["decision"];
  policyId: string;
  reason: string;
  eventId: string;
}

export const grantOutcome = (itemId: string, r: GrantResponse): GrantOutcome => ({
  itemId,
  decision: r.decision,
  policyId: r.event.policy_id,
  reason: r.event.reason,
  eventId: r.event.id,
});

// The timeline (card E8.5).

export interface TimelineFilter {
  scope: string | null;
  /** The event's type. */
  op: string | null;
  decision: string | null;
  /** Who made the event (card E8.11). */
  actor: string | null;
}

export const NO_FILTER: TimelineFilter = { scope: null, op: null, decision: null, actor: null };

const scopesOf = (e: MemoryEvent) =>
  [e.scope_from, e.scope_to].filter((s): s is string => s !== null);

/** The values each filter offers: those the visible events carry, sorted. */
export function filterOptions(events: readonly MemoryEvent[]) {
  const sorted = (values: Iterable<string>) => [...new Set(values)].sort();
  return {
    scopes: sorted(events.flatMap(scopesOf)),
    ops: sorted(events.map((e) => e.op)),
    decisions: sorted(events.map((e) => e.decision)),
    actors: sorted(events.map((e) => e.actor)),
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
      (filter.decision === null || e.decision === filter.decision) &&
      (filter.actor === null || e.actor === filter.actor),
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

// The inspector's pages (card E8.11): the workspace, and an item's page at
// `#/item/<id>`, so the browser's back button and a pasted link work.

export type Route = { page: "workspace" } | { page: "item"; itemId: string };

/** The location hash of an item's page. */
export const itemHref = (itemId: string) => `#/item/${encodeURIComponent(itemId)}`;

/** The page a location hash names: an item's page, else the workspace. */
export function parseRoute(hash: string): Route {
  const match = /^#\/item\/([^/]+)$/.exec(hash);
  if (match === null) return { page: "workspace" };
  try {
    return { page: "item", itemId: decodeURIComponent(match[1] as string) };
  } catch {
    return { page: "workspace" };
  }
}

// Who can read this memory (card E2.13).

export interface ReaderRow {
  key: string;
  kind: "members" | "grant";
  /** The scope of a members entry, or the `to` of a grant entry. */
  who: string;
  text: string;
  policyId: string;
}

export interface ReaderView {
  answered: boolean;
  reason: string;
  /** Why nobody may read the item now, with its rule; null when it is open. */
  closed: string | null;
  rows: ReaderRow[];
  /** The owner's grants that admit nobody now, each with why. */
  dormant: string[];
  /** Whether grants naming others are withheld from this viewer. */
  withheld: boolean;
}

/**
 * The who-can-read panel's rows from the plane's answer
 * (Plane.whoCanReadItem through POST /who-can-read/item). Which readers and
 * grants the viewer may see is the plane's decision; this only labels them.
 */
export function readerView(a: WhoCanReadAnswer): ReaderView {
  return {
    answered: a.answered,
    reason: a.reason,
    closed: a.closed === null ? null : `${a.closed.reason} (${a.closed.policy_id})`,
    rows: a.readers.map((r, i) =>
      r.kind === "members"
        ? {
            key: `members:${r.scope}:${r.level}`,
            kind: "members",
            who: r.scope,
            text: `every member of ${r.scope} reading as ${r.level}`,
            policyId: r.policy_id,
          }
        : {
            // A non-owner's grant labels carry no position, so two may be alike.
            key: `${i}:${r.grant}`,
            kind: "grant",
            who: r.to,
            text: `${r.to} by ${r.grant}, until ${r.grant_detail.expires ?? "no expiry"}`,
            policyId: r.policy_id,
          },
    ),
    dormant: a.dormant.map((d) => `${d.grant}: ${d.reason}`),
    withheld: a.grants_shown === "yours",
  };
}
