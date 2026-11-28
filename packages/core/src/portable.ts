// What a memory bundle holds (card E9.8, docs/bundle.md): the items an actor
// may take out of the plane, each with the decision events that shaped it. A
// pure rule over the actor, the policy, the projection and the log, decided
// here so no surface picks the rows by hand (AGENTS.md rule 1).
//
// Which items: those in a scope the read matrix lets the actor read
// (`readableScope`: a member of it, at a level its own level may read), and
// either in the actor's own person scope (the scope whose id is the actor's
// id, whoever wrote each item there) or owned by the actor (`item.owner`) in
// another scope it reads. So a person takes out everything in their person
// scope and their own items in the role, team and org scopes they belong to,
// never another member's item in a shared scope. Every status is included: a
// retired version is the history a later version's lineage names, and the
// bundle carries the item's status as data (an import never trusts it,
// docs/bundle.md).
//
// Which events: every event naming the item's id that the actor may see
// (`eventVisibleTo`, visible.ts), in log order, each without its `item`
// state: the row carries the item as it stands, and an earlier state may
// hold content a later version took out.
//
// What an import makes of a row (decision item 55; review finding E9.8-1):
// one write by the dedicated import actor `import:<importer>`, whose source
// is the least trusted of the kind the row claims and `import`, as adoption
// records a record it did not write (`adoptedItem`, plane/write.ts, card
// RV4). A row may claim `user` and is recorded `import`; a model, compaction
// or external row keeps its kind, so the gate's rules for that kind (source
// rules, source isolation, no grants, no restating retired content) hold for
// it as for a direct write. The status is candidate, or retired for a retired
// row, never more; grants are dropped; the id is new and the version 1.
import type { Actor } from "./actor.ts";
import { contentHash } from "./content-hash.ts";
import type { Db } from "./db/db.ts";
import { currentItems } from "./events.ts";
import { accessTime } from "./plane/read.ts";
import { readableScope, scopeLevel } from "./policy/evaluate.ts";
import { leastTrusted } from "./policy/promotion.ts";
import {
  type MemoryEvent,
  type MemoryItem,
  type Policy,
  type Provenance,
  ProvenanceKind,
} from "./schema.ts";
import { type EventView, eventVisibleTo, idShownTo } from "./visible.ts";

/** The bundle format's name and version (docs/bundle.md); an importer refuses any other. */
export const BUNDLE_FORMAT = "engram-bundle";
export const BUNDLE_VERSION = 1;

/** One row of a bundle: an item and the decision events on it, without their item state. */
export interface BundleRow {
  item: MemoryItem;
  events: Omit<MemoryEvent, "item">[];
}

/** Whether `item` belongs in `actor`'s bundle under `policy` (see the module comment). */
export function exportable(policy: Policy, actor: Actor, item: MemoryItem): boolean {
  if (!readableScope(policy, actor, item.scope)) return false;
  return item.scope === actor.id || item.owner === actor.id;
}

/**
 * The rows of `actor`'s bundle, ordered by item id (a UUIDv7, ADR 0003: the
 * order the plane minted them in, unless a caller chose an id), each with
 * its visible events in the order given (the log's seq order).
 */
export function bundleRows(
  policy: Policy,
  actor: Actor,
  items: readonly MemoryItem[],
  events: readonly MemoryEvent[],
): BundleRow[] {
  const chosen = items
    .filter((item) => exportable(policy, actor, item))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byItem = new Map<string, Omit<MemoryEvent, "item">[]>(chosen.map((i) => [i.id, []]));
  for (const event of events) {
    const list = event.item_id === null ? undefined : byItem.get(event.item_id);
    if (list === undefined || !eventVisibleTo(actor, event, policy)) continue;
    const { item: _state, ...rest } = event;
    list.push(rest);
  }
  return chosen.map((item) => ({ item, events: byItem.get(item.id) ?? [] }));
}

type Kind = Provenance["kind"];

/**
 * The dedicated import actor (decision item 55): `import:<importer>`, at the
 * importer's level, a member of exactly the importer's scopes, with `source`
 * (the kind the plane records, importedWrite's choice). Its id names who it
 * imports for, so the log tells every imported row from the importer's own
 * writes, and the importer, who owns the rows, cannot approve their
 * promotion (ADR 0026: the owner never approves).
 */
export function importActor(importer: Actor, source: Kind): Actor {
  return {
    id: `import:${importer.id}`,
    level: importer.level,
    memberships: [...importer.memberships],
    source,
  };
}

/** What an imported row says of itself: a bundle row's item, or a pasted memory. */
export interface ImportSource {
  class: MemoryItem["class"];
  content: MemoryItem["content"];
  confidence: number;
  valid_from: string;
  valid_to: string | null;
  ttl: number | null;
  status: MemoryItem["status"];
  /** The provenance the row claims; only its kind and model are read. */
  provenance: Pick<Provenance, "kind" | "model">;
  /** Where the row came from, recorded as the provenance ref. */
  ref: string;
}

/** A bundle row as an import source (see the module comment). */
export function bundleSource(row: BundleRow): ImportSource {
  const { item } = row;
  return {
    class: item.class,
    content: item.content,
    confidence: item.confidence,
    valid_from: item.valid_from,
    valid_to: item.valid_to,
    ttl: item.ttl,
    status: item.status,
    provenance: item.provenance,
    ref: `engram-bundle:${item.id}`,
  };
}

const RECORDS_MODEL: ReadonlySet<Kind> = new Set(["model", "compaction"]);

/** The kind an import records for a row that claims `claimed`: never more trusted than `import`. */
export function importKind(claimed: Kind): Kind {
  return leastTrusted([claimed, "import"]);
}

/** The principal an import actor acts for: its id without the `import:` prefix. */
export function importerOf(actor: Actor): string {
  return actor.id.startsWith("import:") ? actor.id.slice("import:".length) : actor.id;
}

/**
 * A served write by an `import`-sourced actor, mapped as an imported row
 * (the lead's decisions of 2026-11-22 on card E9.8, findings E9.8-8 and the
 * one before it). A credential's source replaces the one a client sends
 * (ADR 0042), so the route cannot rely on the client to cap anything; this
 * applies the whole mapping instead:
 *
 * - the actor's source, so the kind the plane records, is the least trusted
 *   of the kind the item claims, the kind the plane holds for its id when it
 *   holds one (`held`), and `import`, as adoption's `adoptedItem` (card
 *   RV4): a rewrite never raises an agent's `model` item to `import`;
 * - status candidate, or retired for a retired row;
 * - no grants;
 * - owner the importer (`importerOf`).
 *
 * Any other actor, and a body that is not an object (the plane's schema
 * rule denies it), are returned unchanged. Plane.write, adoption and the
 * oracle are untouched; the item is still judged whole by the gate.
 */
export function servedImport(
  actor: Actor,
  item: unknown,
  held: (id: string) => MemoryItem | undefined,
): { actor: Actor; item: unknown } {
  if (actor.source !== "import") return { actor, item };
  if (typeof item !== "object" || item === null || Array.isArray(item)) return { actor, item };
  const record = item as Record<string, unknown>;
  const provenance = record.provenance;
  const claimed = ProvenanceKind.safeParse(
    typeof provenance === "object" && provenance !== null
      ? (provenance as { kind?: unknown }).kind
      : undefined,
  );
  const known = typeof record.id === "string" ? held(record.id) : undefined;
  const kind = leastTrusted([
    ...(claimed.success ? [claimed.data] : []),
    ...(known ? [known.provenance.kind] : []),
    "import",
  ]);
  return {
    actor: { ...actor, source: kind },
    item: {
      ...record,
      owner: importerOf(actor),
      status: record.status === "retired" ? "retired" : "candidate",
      grants: [],
    },
  };
}

/**
 * The write an import makes of one row, and the actor that makes it (see
 * the module comment): kind the least trusted of the row's claim and
 * `import`, owner the importer, status candidate (retired for a retired
 * row), no grants, version 1, the id, scope and mapped lineage given.
 */
export function importedWrite(
  importer: Actor,
  row: BundleRow | ImportSource,
  at: { id: string; scope: string; lineage: string[] },
): { actor: Actor; item: MemoryItem } {
  const source = "item" in row ? bundleSource(row) : row;
  const kind = importKind(source.provenance.kind);
  const actor = importActor(importer, kind);
  const model = RECORDS_MODEL.has(kind) ? source.provenance.model : undefined;
  const item = {
    id: at.id,
    class: source.class,
    scope: at.scope,
    owner: importer.id,
    content: source.content,
    provenance: {
      kind,
      ref: source.ref,
      hash: contentHash(source.content),
      actor: actor.id,
      ...(model === undefined ? {} : { model }),
    },
    confidence: source.confidence,
    valid_from: source.valid_from,
    valid_to: source.valid_to,
    ttl: source.ttl,
    grants: [],
    version: 1,
    lineage: at.lineage,
    status: source.status === "retired" ? "retired" : "candidate",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
  return { actor, item };
}

/**
 * The order an import writes rows in: as given, except that a row comes
 * after every row its lineage names, so a pointer to a row in the bundle
 * always finds that row's new id. A lineage cycle, which no plane writes, is
 * broken at the row met first.
 */
export function importOrder<T extends { from: string; lineage: readonly string[] }>(
  rows: readonly T[],
): T[] {
  const byId = new Map(rows.map((r) => [r.from, r]));
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const out: T[] = [];
  const place = (row: T) => {
    if (placed.has(row.from) || visiting.has(row.from)) return;
    visiting.add(row.from);
    for (const id of row.lineage) {
      const ancestor = byId.get(id);
      if (ancestor !== undefined) place(ancestor);
    }
    visiting.delete(row.from);
    placed.add(row.from);
    out.push(row);
  };
  for (const row of rows) place(row);
  return out;
}

/**
 * A lineage mapped onto the ids an import minted so far: a pointer to a row
 * already imported takes its new id; any other (a version the bundle does
 * not hold, a row the gate denied) is dropped and counted, so no imported
 * item names an id the workspace does not hold.
 */
export function mapLineage(
  lineage: readonly string[],
  ids: ReadonlyMap<string, string>,
): { lineage: string[]; dropped: number } {
  const kept = lineage.flatMap((id) => {
    const to = ids.get(id);
    return to === undefined ? [] : [to];
  });
  return { lineage: kept, dropped: lineage.length - kept.length };
}

// The subject access export (card E9.16): a person's own bundle, as above,
// and a closure report of the items derived from it in other scopes. It
// gives evidence a controller can use for GDPR Articles 15 and 20; it is not
// a certification that a request was answered in full (docs/compliance/).
//
// Who: the subject is a person principal (`person:<id>`) and the export goes
// only to that subject, so the exporter's id must be the subject
// (`subjectRefusal`). Nobody exports another person's bundle through it,
// an operator included: the bundle holds content (AGENTS.md rule 12).
//
// The closure: an item is derived from the bundle when its lineage names a
// bundle row's id, or names an item already derived, transitively (a
// promotion's new version in a team or org scope, a supersede's successor
// there, and whatever was derived from those). A derived item already in the
// bundle is not repeated. Each derived item is named only when ADR 0047's
// by-id rule lets the subject ask for it (`idShownTo`, visible.ts, as a
// lineage pointer is shown); every other one is counted, never named, with
// no scope, class or time, so the count is the only thing the report says of
// items out of the subject's reach.

/** The subject access report's format; a reader refuses any other. */
export const SUBJECT_ACCESS_FORMAT = "engram-subject-access/1";

/**
 * Why `actor` may not take `subject`'s access export, or undefined when it
 * may: the subject is a person, and the export goes only to the subject.
 */
export function subjectRefusal(actor: Actor, subject: string): string | undefined {
  if (!/^person:[A-Za-z0-9._\-/]+$/.test(subject))
    return `a subject is a person principal, person:<id>, not ${JSON.stringify(subject)}`;
  if (actor.id !== subject)
    return `a subject access export goes only to the subject: it is exported as ${subject} itself, not as ${actor.id}`;
  return undefined;
}

/** One derived item the subject may be shown: its id and the ids it derives from that the subject may see. */
export interface DerivedShown {
  id: string;
  from: string[];
}

/** The derived items of a bundle: named where the subject may see them, a count otherwise. */
export interface SubjectClosure {
  shown: DerivedShown[];
  withheld: number;
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The closure of `bundleIds` over `items` (the projection), as `subject` is
 * shown it at `view.at` (see the comment above). Shown items are ordered by
 * id, each with its `from` ids sorted, only those the subject may see.
 */
export function subjectClosure(
  subject: Actor,
  items: readonly MemoryItem[],
  bundleIds: readonly string[],
  view: EventView,
): SubjectClosure {
  const inBundle = new Set(bundleIds);
  const reached = new Set(bundleIds);
  const derived: MemoryItem[] = [];
  const rest = items.filter((i) => !inBundle.has(i.id)).sort(byId);
  // A fixpoint: each pass adds the items whose lineage names one reached.
  for (let grew = true; grew; ) {
    grew = false;
    for (const item of rest) {
      if (reached.has(item.id) || !item.lineage.some((id) => reached.has(id))) continue;
      reached.add(item.id);
      derived.push(item);
      grew = true;
    }
  }
  const visible = new Set<string>(bundleIds);
  for (const item of derived) if (idShownTo(subject, item.id, view)) visible.add(item.id);
  const shown: DerivedShown[] = [];
  let withheld = 0;
  for (const item of derived.sort(byId)) {
    if (!visible.has(item.id)) {
      withheld += 1;
      continue;
    }
    const from = [...new Set(item.lineage.filter((id) => reached.has(id) && visible.has(id)))];
    shown.push({ id: item.id, from: from.sort() });
  }
  return { shown, withheld };
}

/** What a subject access export tells its subject beside the bundle (card E9.16). */
export interface SubjectAccessReport {
  format: typeof SUBJECT_ACCESS_FORMAT;
  subject: string;
  at: string;
  policy: { id: string; version: number };
  /** The bundle's items, counted by status, class and scope level. */
  items: {
    total: number;
    by_status: Record<string, number>;
    by_class: Record<string, number>;
    by_level: Record<string, number>;
  };
  /** The decisions on them the bundle carries, counted by operation and decision. */
  decisions: { total: number; by_op: Record<string, Record<string, number>> };
  derived: SubjectClosure;
  notes: string[];
}

const tally = (keys: readonly string[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const k of [...keys].sort()) out[k] = (out[k] ?? 0) + 1;
  return out;
};

/** The notes every subject access report carries. */
export const SUBJECT_ACCESS_NOTES = [
  "evidence for a controller answering GDPR Articles 15 and 20, not a certification that the request was answered in full",
  "the bundle holds the subject's person scope and the subject's own items in the other scopes it reads, of every status, each with the decisions on it the subject may see",
  "derived items out of the subject's reach are counted, never named",
] as const;

/** The report of `subject`'s export of `rows`, with the closure over `items` (see the comments above). */
export function subjectAccessReport(
  policy: Policy,
  subject: Actor,
  rows: readonly BundleRow[],
  items: readonly MemoryItem[],
  view: EventView,
  at: string = view.at,
): SubjectAccessReport {
  const refusal = subjectRefusal(subject, subject.id);
  if (refusal !== undefined) throw new Error(refusal);
  const byOp: Record<string, Record<string, number>> = {};
  let decisions = 0;
  for (const row of rows)
    for (const e of row.events) {
      const op = byOp[e.op] ?? {};
      byOp[e.op] = op;
      op[e.decision] = (op[e.decision] ?? 0) + 1;
      decisions += 1;
    }
  const sortedOps: Record<string, Record<string, number>> = {};
  for (const op of Object.keys(byOp).sort()) {
    const d = byOp[op] as Record<string, number>;
    sortedOps[op] = Object.fromEntries(
      Object.keys(d)
        .sort()
        .map((k) => [k, d[k] as number]),
    );
  }
  return {
    format: SUBJECT_ACCESS_FORMAT,
    subject: subject.id,
    at,
    policy: { id: policy.id, version: policy.version },
    items: {
      total: rows.length,
      by_status: tally(rows.map((r) => r.item.status)),
      by_class: tally(rows.map((r) => r.item.class)),
      by_level: tally(rows.map((r) => scopeLevel(r.item.scope))),
    },
    decisions: { total: decisions, by_op: sortedOps },
    derived: subjectClosure(
      subject,
      items,
      rows.map((r) => r.item.id),
      view,
    ),
    notes: [...SUBJECT_ACCESS_NOTES],
  };
}

/**
 * The subject access report of an export's `rows`, from the log `db` under
 * `policy` at `at` (the export's own time): the projection read once, and the
 * by-id rule judged at the log's access time, as Plane.export judges it.
 */
export function subjectAccessOf(
  db: Db,
  policy: Policy,
  subject: Actor,
  rows: readonly BundleRow[],
  at: string,
): SubjectAccessReport {
  const items = currentItems(db);
  const projected = new Map(items.map((i) => [i.id, i]));
  const view: EventView = {
    policy,
    at: accessTime(db, at),
    current: (id) => projected.get(id),
  };
  return subjectAccessReport(policy, subject, rows, items, view, at);
}
