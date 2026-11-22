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
import { readableScope } from "./policy/evaluate.ts";
import { leastTrusted } from "./policy/promotion.ts";
import {
  type MemoryEvent,
  type MemoryItem,
  type Policy,
  type Provenance,
  ProvenanceKind,
} from "./schema.ts";
import { eventVisibleTo } from "./visible.ts";

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

/**
 * An `import`-sourced actor as a served write records it (the lead's
 * decision of 2026-11-22 on card E9.8): its source lowered to importKind of
 * the kind the item claims, so a client can only lower trust, never raise
 * it. A credential's source replaces the one a client sends (ADR 0042), so
 * an import key held at `import` would otherwise record a model row as
 * `import`. Any other actor, and an item whose claimed kind is not a kind
 * (the plane's schema rule denies it), are returned unchanged. Plane.write
 * and adoption are untouched.
 */
export function capImportSource(actor: Actor, item: unknown): Actor {
  if (actor.source !== "import") return actor;
  const provenance =
    typeof item === "object" && item !== null
      ? (item as { provenance?: unknown }).provenance
      : undefined;
  const claimed = ProvenanceKind.safeParse(
    typeof provenance === "object" && provenance !== null
      ? (provenance as { kind?: unknown }).kind
      : undefined,
  );
  if (!claimed.success) return actor;
  return { ...actor, source: importKind(claimed.data) };
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
