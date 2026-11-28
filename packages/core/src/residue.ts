// The erasure-residue scan (card X19, proposal U7 of the pre-registration):
// after an offboarding, where does the erased content still stand? The caller
// names what to look for (needles: a fact's text, a content hash's hex) and
// the person scope that was erased; the scan searches every row of every
// table of the log's database and every record the store holds under a scope
// or a ref the log names, and says of each hit whether it is retained by a
// decision the plane made on purpose, or residue.
//
// Retained by decision, never residue (ADR 0010; lead-decisions items 38 and
// 38a; offboard.ts):
// - `promoted`: the hit is in an item outside the person scope that a
//   promotion out of the person scope made (its `promote` event names the
//   person scope as scope_from), so it is the target scope's, not the person's;
// - `outside-person-scope`: the hit is in another item that lives outside the
//   person scope, which offboarding does not erase;
// - `shared-store-ref`: the hit is in a store record whose ref an item
//   outside the person scope holds, which offboarding keeps and reports;
// - `erased-content-hash`: the hit is in the reason of an erase or sweep event
//   carrying LEFT_CONTENT_CLAUSE, the hashes the log keeps by design so that
//   adoption refuses a record left in a store or not found at its ref;
// - `surviving-hash`: the needle is a hash a surviving item also holds (its
//   content's strict hash or its provenance hash), so it is not the erased
//   item's alone.
// Anything else is residue: a copy of erased content the erasure should have
// removed, including a record left in a store the plane could not delete
// from (the deletion report lists it, but the bytes are there).
//
// What this scan cannot see is the caller's to search with scanBytes: the
// database file's free pages and write-ahead log, a store's files on disk and
// its own history (a MemFS repository's git objects). Those bytes cannot be
// attributed to an item, so scanBytes only says which needles occur.
//
// Read-only: no event is appended, nothing in the store changes. Core reads
// no clock and draws no randomness; the result is in a fixed order. Card
// E9.14 (the signed erasure receipt) calls it with the hashes a receipt names.
import type { Adapter, StoreRef } from "./adapter.ts";
import { strictContentHash } from "./content-hash.ts";
import type { Db } from "./db/db.ts";
import { ERASURE_ID, keptInStore } from "./events.ts";
import { itemById, itemsByStoreRef } from "./items.ts";
import type { MemoryEvent, MemoryItem } from "./schema.ts";

/** The rule of an offboarding's sweep (plane/commit.ts OFFBOARD_SWEPT_ID); kept here to avoid an import cycle. */
const SWEPT_ID = "engram/offboard/swept";

/** One string to look for, under the caller's key (a canary's id, a hash's label). */
export interface ResidueNeedle {
  key: string;
  text: string;
}

export const RESIDUE_TIERS = [
  "projection",
  "explanations",
  "events",
  "log-other",
  "store-records",
] as const;
export type ResidueTier = (typeof RESIDUE_TIERS)[number];

export const RETAINED_KINDS = [
  "promoted",
  "outside-person-scope",
  "shared-store-ref",
  "erased-content-hash",
  "surviving-hash",
] as const;
export type RetainedKind = (typeof RETAINED_KINDS)[number];

/** The parts of an event body a hit is reported in (proposal U7: content, reason, provenance ref, evidence hash). */
export const EVENT_FIELDS = [
  "item.content",
  "item.provenance.ref",
  "item.provenance.hash",
  "reason",
  "other",
] as const;
export type EventField = (typeof EVENT_FIELDS)[number];

export interface ResidueHit {
  needle: string;
  tier: ResidueTier;
  /** The table (log tiers) or the store's name (store-records). */
  table: string;
  /** The row's key: an item id, an event id, an explanation's read id, or a store record's ref key. */
  row: string;
  /** Events only: the part of the body that holds the needle. */
  field?: EventField;
  /** The item the row is about, when it names one. */
  item_id: string | null;
  /** Retained by decision, and why; null is residue. */
  retained: RetainedKind | null;
}

export interface ResidueScan {
  person: string;
  hits: ResidueHit[];
  /** How many rows and store records were searched, per tier. */
  searched: Record<ResidueTier, number>;
}

export interface ResidueRequest {
  /** The person scope that was erased, `person:<id>`. */
  person: string;
  needles: readonly ResidueNeedle[];
  /**
   * Extra store refs to read, beyond every ref the log names: refs the
   * caller noted before the erasure (a receipt's targets).
   */
  refs?: readonly StoreRef[];
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The keys of the needles `text` holds, in the needles' order. */
export function needlesIn(text: string, needles: readonly ResidueNeedle[]): string[] {
  return needles.filter((n) => n.text !== "" && text.includes(n.text)).map((n) => n.key);
}

/**
 * The keys of the needles `bytes` holds verbatim as UTF-8, in the needles'
 * order: for the bytes the log and the store tiers cannot see (a database
 * file's free pages, a write-ahead log, a store's files, git objects).
 */
export function scanBytes(bytes: Uint8Array, needles: readonly ResidueNeedle[]): string[] {
  // Latin-1 maps each byte to one code unit, so an ASCII or UTF-8 needle's
  // bytes are found exactly where `indexOf` finds its Latin-1 image.
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
  return needles
    .filter((n) => n.text !== "" && text.includes(Buffer.from(n.text, "utf8").toString("latin1")))
    .map((n) => n.key);
}

/** The table names of the log's database, sorted. */
function tables(db: Db): string[] {
  const rows =
    db.dialect === "sqlite"
      ? db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
      : db
          .prepare(
            "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'",
          )
          .all();
  return rows.map((r) => String(r.name)).sort(compareText);
}

const cellText = (value: unknown): string =>
  value instanceof Uint8Array
    ? Buffer.from(value).toString("latin1")
    : typeof value === "bigint"
      ? value.toString()
      : value === null || value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

/** What a scan of one erased person scope knows about the log, read once. */
interface Context {
  person: string;
  /** Item ids a promotion out of the person scope made. */
  promotedOut: Set<string>;
  /** Strict content hashes and provenance hashes of items outside the person scope. */
  survivingHashes: Set<string>;
  needles: readonly ResidueNeedle[];
}

function context(db: Db, request: ResidueRequest): Context {
  const promotedOut = new Set<string>();
  for (const row of db.prepare("SELECT body FROM events WHERE op = 'promote'").all()) {
    const e = JSON.parse(String(row.body)) as MemoryEvent;
    if (e.decision === "allow" && e.scope_from === request.person && e.item_id !== null)
      promotedOut.add(e.item_id);
  }
  const survivingHashes = new Set<string>();
  for (const row of db.prepare("SELECT body FROM items").all()) {
    const i = JSON.parse(String(row.body)) as MemoryItem;
    if (i.scope === request.person) continue;
    survivingHashes.add(strictContentHash(i.content));
    survivingHashes.add(i.provenance.hash);
  }
  return { person: request.person, promotedOut, survivingHashes, needles: request.needles };
}

/** Whether `needle` is part of a hash a surviving item holds. */
const survivingHash = (ctx: Context, needle: ResidueNeedle) =>
  [...ctx.survivingHashes].some((h) => h.includes(needle.text));

/** Why the item `id` keeps what it holds, or null when it is erased or still in the person scope. */
function itemRetention(db: Db, ctx: Context, id: string | null): RetainedKind | null {
  if (id === null) return null;
  const item = itemById(db, id);
  if (!item || item.scope === ctx.person) return null;
  return ctx.promotedOut.has(id) ? "promoted" : "outside-person-scope";
}

function retention(
  db: Db,
  ctx: Context,
  needle: ResidueNeedle,
  itemId: string | null,
  keptHash: boolean,
): RetainedKind | null {
  const byItem = itemRetention(db, ctx, itemId);
  if (byItem) return byItem;
  if (keptHash) return "erased-content-hash";
  if (survivingHash(ctx, needle)) return "surviving-hash";
  return null;
}

/** The part of an event body that holds `text`, in EVENT_FIELDS order: the first that does. */
function eventFields(event: MemoryEvent, text: string): EventField[] {
  const item = event.item;
  const parts: [EventField, string][] = [
    ["item.content", item ? cellText(item.content) : ""],
    ["item.provenance.ref", item ? item.provenance.ref : ""],
    ["item.provenance.hash", item ? item.provenance.hash : ""],
    ["reason", event.reason],
  ];
  const found = parts.filter(([, value]) => value.includes(text)).map(([field]) => field);
  if (found.length > 0) return found;
  return JSON.stringify(event).includes(text) ? ["other"] : [];
}

function scanLog(db: Db, ctx: Context, searched: ResidueScan["searched"]): ResidueHit[] {
  const hits: ResidueHit[] = [];
  const byKey = new Map(ctx.needles.map((n) => [n.key, n]));
  for (const table of tables(db)) {
    const tier: ResidueTier =
      table === "items"
        ? "projection"
        : table === "explanations"
          ? "explanations"
          : table === "events"
            ? "events"
            : "log-other";
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    searched[tier] += rows.length;
    for (const row of rows) {
      const text = Object.keys(row)
        .sort(compareText)
        .map((k) => cellText(row[k]))
        .join("\u0000");
      const found = needlesIn(text, ctx.needles);
      if (found.length === 0) continue;
      if (tier === "events") {
        const event = JSON.parse(String(row.body)) as MemoryEvent;
        const kept =
          (event.policy_id === ERASURE_ID || event.policy_id === SWEPT_ID) && keptInStore(event);
        for (const key of found) {
          const needle = byKey.get(key) as ResidueNeedle;
          for (const field of eventFields(event, needle.text))
            hits.push({
              needle: key,
              tier,
              table,
              row: event.id,
              field,
              item_id: event.item_id,
              retained: retention(db, ctx, needle, event.item_id, kept && field === "reason"),
            });
        }
        continue;
      }
      const itemId =
        tier === "projection" ? String(row.id) : row.item_id == null ? null : String(row.item_id);
      const rowKey =
        tier === "projection"
          ? String(row.id)
          : tier === "explanations"
            ? `${cellText(row.read_id)}#${cellText(row.rank)}`
            : `${Object.keys(row)
                .sort(compareText)
                .slice(0, 1)
                .map((k) => cellText(row[k]))
                .join("")}`;
      for (const key of found) {
        const needle = byKey.get(key) as ResidueNeedle;
        hits.push({
          needle: key,
          tier,
          table,
          row: rowKey,
          item_id: itemId,
          retained: retention(db, ctx, needle, itemId, false),
        });
      }
    }
  }
  return hits;
}

const refKey = (r: StoreRef) => `${r.adapter}\u0000${r.key}`;

/** Every scope and store ref the log names, in a fixed order. */
function logReach(db: Db, person: string): { scopes: string[]; refs: StoreRef[] } {
  const scopes = new Set<string>([person]);
  const refs = new Map<string, StoreRef>();
  for (const row of db.prepare("SELECT body FROM events ORDER BY seq").all()) {
    const e = JSON.parse(String(row.body)) as MemoryEvent;
    if (e.scope_from) scopes.add(e.scope_from);
    if (e.scope_to) scopes.add(e.scope_to);
    if (e.item?.store_ref) refs.set(refKey(e.item.store_ref), e.item.store_ref);
  }
  return {
    scopes: [...scopes].sort(compareText),
    refs: [...refs.values()].sort((a, b) => compareText(refKey(a), refKey(b))),
  };
}

async function scanStore(
  db: Db,
  adapter: Adapter,
  ctx: Context,
  extra: readonly StoreRef[],
  searched: ResidueScan["searched"],
): Promise<ResidueHit[]> {
  const { scopes, refs } = logReach(db, ctx.person);
  const records = new Map<string, MemoryItem>();
  for (const scope of scopes)
    for (const record of await adapter.list(scope))
      if (record.store_ref) records.set(refKey(record.store_ref), record);
  const wanted = new Map([...refs, ...extra].map((r) => [refKey(r), r]));
  for (const [key, ref] of [...wanted].sort(([a], [b]) => compareText(a, b))) {
    if (records.has(key) || ref.adapter !== adapter.name) continue;
    const record = await adapter.read(ref).catch(() => undefined);
    if (record) records.set(key, { ...record, store_ref: record.store_ref ?? ref });
  }
  searched["store-records"] += records.size;
  const byKey = new Map(ctx.needles.map((n) => [n.key, n]));
  const hits: ResidueHit[] = [];
  for (const [key, record] of [...records].sort(([a], [b]) => compareText(a, b))) {
    const found = needlesIn(JSON.stringify(record), ctx.needles);
    if (found.length === 0) continue;
    const ref = record.store_ref as StoreRef;
    const holders = itemsByStoreRef(db, ref).filter((i) => i.scope !== ctx.person);
    for (const k of found) {
      const needle = byKey.get(k) as ResidueNeedle;
      const own = itemRetention(db, ctx, record.id);
      hits.push({
        needle: k,
        tier: "store-records",
        table: adapter.name,
        row: key.replace("\u0000", ":"),
        item_id: record.id,
        retained:
          own ??
          (holders.length > 0
            ? "shared-store-ref"
            : survivingHash(ctx, needle)
              ? "surviving-hash"
              : null),
      });
    }
  }
  return hits;
}

const tierOrder = (t: ResidueTier) => RESIDUE_TIERS.indexOf(t);

/**
 * Searches the log and the store for `request.needles` after `request.person`
 * was erased, and classifies every hit (see the header). Read-only.
 */
export async function findResidue(
  deps: { db: Db; adapter: Adapter },
  request: ResidueRequest,
): Promise<ResidueScan> {
  const searched = Object.fromEntries(RESIDUE_TIERS.map((t) => [t, 0])) as ResidueScan["searched"];
  const ctx = context(deps.db, request);
  const hits = [
    ...scanLog(deps.db, ctx, searched),
    ...(await scanStore(deps.db, deps.adapter, ctx, request.refs ?? [], searched)),
  ].sort(
    (a, b) =>
      tierOrder(a.tier) - tierOrder(b.tier) ||
      compareText(a.table, b.table) ||
      compareText(a.row, b.row) ||
      compareText(a.needle, b.needle) ||
      compareText(a.field ?? "", b.field ?? ""),
  );
  return { person: request.person, hits, searched };
}
