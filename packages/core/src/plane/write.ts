// The write path (card E2.3, docs/architecture.md "Write path"): check the
// call (actor and time), validate the item against the schema, set its
// provenance from the actor's harness-set source, evaluate the write gate
// against the policy and the projected item of the same id, and only on allow
// call the adapter, record the store_ref and append the event carrying the
// stored item. A denial appends one event with its reason and policy_id and
// never reaches the adapter. A store failure after an allow appends one deny
// event naming it and rethrows, so a store write never happens without an
// event (decision D6). Adoption (`adoptWrite`, plane/adopt.ts, decision D8)
// records an allowed item at the store_ref the store already holds it under
// instead of writing it, and marks every event's reason as an adoption from
// that store; that ref goes through the same checks as one the adapter
// returns, and a ref that cannot be recorded leaves the store-failure event.
// Adoption sets the item's provenance and grants by `adoptedItem`, never
// raising trust or widening grants, and may retire a holder of its ref the
// store no longer lists (card RV4).
//
// Across db handles (card E2.6, commit.ts): the decision is checked again in
// the transaction that commits it. If the item changed, or an offboarding
// began erasing its person scope, since the decision, the write is refused
// (engram/write/conflict) and the store is put back as the log has it. A
// write the gate allows is also refused by the plane into a person scope an
// offboarding is erasing (engram/offboard/erasing), and under an id an
// offboarding erased (engram/write/erased).
//
// After a landing write, in the transaction that commits it, the budget
// check of the written scope and class runs (card E2.4, ADR 0025): so no
// write sequence leaves a scope over a recency or utility budget, and a
// manual rule's overage is asked about once per write that leaves it over.
import { z } from "zod";
import { type Actor, checkCall } from "../actor.ts";
import type { StoreRef } from "../adapter.ts";
import { contentHash } from "../content-hash.ts";
import type { Db } from "../db/db.ts";
import { appendEvent } from "../events.ts";
import { itemById, itemsByStoreRef } from "../items.ts";
import type { PlaneDeps, WriteCheckResult, WriteResult } from "../plane.ts";
import { evaluateWrite, SCHEMA_ID, STORE_FAILURE_ID, sameGrant } from "../policy/evaluate.ts";
import { leastTrusted } from "../policy/promotion.ts";
import { ITEM_TTL_ID } from "../policy/retention.ts";
import { unattestedFloor } from "../policy/trust.ts";
import { Id, MemoryItem, type Policy, Scope } from "../schema.ts";
import {
  type Basis,
  canonical,
  ERASING_ID,
  erasingReason,
  erasureBegunSince,
  erasureOpen,
  lastErasure,
  lastRemoval,
  logHead,
  ownBytes,
  removedAncestor,
  settle,
  staleness,
  touchedSince,
  WRITE_CONFLICT_ID,
} from "./commit.ts";
import { inWriteQueue } from "./queue.ts";
import { budgetRefusal, enforceBudget } from "./retention.ts";

export { checkCall, WRITE_CONFLICT_ID };
/** The rule of a write refused because its id belongs to an item an offboarding erased (card E2.6). */
export const WRITE_ERASED_ID = "engram/write/erased";

type Kind = MemoryItem["provenance"]["kind"];

const StoreRefShape = z.object({ adapter: z.string().min(1), key: z.string().min(1) });

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;

/** The valid value of `key` on an unvalidated item, or null. */
const validOrNull = (value: unknown, key: string, schema: typeof Id | typeof Scope) => {
  const parsed = schema.safeParse(field(value, key));
  return parsed.success ? parsed.data : null;
};

/**
 * The normalised content hash of every retired item in `scope`, mapped to
 * that item's id (the lowest id when several share it): what the
 * retired-content rule compares a write against (ADR 0025). Only an item an
 * allowed retire or evict event retired counts: one written with status
 * `retired` was retired by nobody, and counting it would let any member
 * plant a block on content (review finding P4-3; ADR 0010: items are
 * retired by event). Nor does expiry by the item's own ttl
 * (`engram/retention/item-ttl`), which its writer chose (P4-13); expiry by a
 * rule's ttl and budget eviction count. Nor does a source a promotion
 * superseded (`<policy>/promotion/superseded`), whose content lives on in
 * its new version (review finding P5-6); and content an active item in the
 * scope still holds is not retired at all (P5-6).
 */
export function retiredContent(db: Db, scope: string): Map<string, string> {
  const out = new Map<string, string>();
  const rows = db.prepare("SELECT body FROM items ORDER BY id").all();
  const lastChange = db.prepare(
    `SELECT op, body FROM events WHERE item_id = ? AND decision = 'allow'
     AND op IN ('write', 'update', 'promote', 'retire', 'evict') ORDER BY seq DESC LIMIT 1`,
  );
  const live = new Set<string>();
  const retired: MemoryItem[] = [];
  for (const row of rows) {
    const it = JSON.parse(String(row.body)) as MemoryItem;
    if (it.scope !== scope) continue;
    if (it.status === "active") live.add(contentHash(it.content));
    if (it.status !== "retired") continue;
    const last = lastChange.get(it.id);
    if (last?.op !== "retire" && last?.op !== "evict") continue;
    const policyId = (JSON.parse(String(last.body)) as { policy_id: string }).policy_id;
    // Expiry by the item's own ttl was set by its writer, so it is no
    // evidence of removal (review finding P4-13); a promotion's superseded
    // source lives on in its new version (P5-6).
    if (policyId === ITEM_TTL_ID) continue;
    if (policyId.endsWith("/promotion/superseded")) continue;
    retired.push(it);
  }
  for (const it of retired) {
    const hash = contentHash(it.content);
    if (!live.has(hash) && !out.has(hash)) out.set(hash, it.id);
  }
  return out;
}

/**
 * The item with the provenance the plane sets (decision D4, ADR 0004): with
 * a harness-set source, its kind and the writing actor replace what the
 * caller claimed; without one, the caller's provenance stands, unless the
 * policy's trust.unattested_floor is on (card E2.11, ADR 0040): then the
 * item is recorded at the least trusted kind, as the actor's, before the
 * gate, a promotion's confirmations or the retired-content rule read it.
 */
export function withPlaneProvenance(
  actor: Actor,
  item: MemoryItem,
  policy?: Policy,
): [MemoryItem, string] {
  if (!actor.source)
    return (
      (policy && unattestedFloor(policy, actor, item)) ?? [
        item,
        "provenance as claimed by the caller",
      ]
    );
  const provenance = { ...item.provenance, kind: actor.source, actor: actor.id };
  return [
    { ...item, provenance } as MemoryItem,
    `provenance set by the plane: source ${actor.source}, actor ${actor.id}`,
  ];
}

/**
 * The item as adoption records it (card RV4): adoption never raises trust,
 * and never widens what an item's grants admit.
 *
 * - Provenance. A record whose content and provenance are as the plane
 *   holds them for its id keeps the plane's provenance: the store holds what
 *   the plane wrote. Any other record (new to the plane, or edited in the
 *   store) is recorded as the adopter's, of the least trusted kind among
 *   what the record claims, what the plane holds for its id, and `import`
 *   (ADR 0004). So an agent's `model` item stays `model`, and a record
 *   edited by hand is `import` at most, never more trusted than it was.
 * - Grants. A grant is kept only when the plane's item of that id carries
 *   the same grant (sameGrant): one an allowed event recorded and nothing
 *   removed since. A grant the plane never recorded for that id, in a record
 *   dropped into the store or edited there, is dropped, and the reason names
 *   each grantee. The plane narrows, never widens (RV-ADP-4).
 * - `sameContent`: the kinds of the scope's items of the same content that
 *   are retired, or that this adoption retires because the store no longer
 *   lists them (review fix passes of PR #58, I-5 and N-2). A record new to
 *   the plane takes the least trusted of those too, so agent content
 *   re-filed under a new id, its claimed kind edited, keeps the kind the
 *   plane held it at, in the same adoption or a later one.
 */
export function adoptedItem(
  actor: Actor,
  item: MemoryItem,
  known: MemoryItem | undefined,
  sameContent: readonly Kind[] = [],
): [MemoryItem, string] {
  const kept = known ? item.grants.filter((g) => known.grants.some((h) => sameGrant(g, h))) : [];
  const dropped = item.grants.filter((g) => !kept.includes(g));
  const asHeld =
    known !== undefined &&
    canonical(item.content) === canonical(known.content) &&
    canonical(item.provenance) === canonical(known.provenance);
  const also = known ? [] : sameContent;
  const kind = leastTrusted([
    item.provenance.kind,
    ...(known ? [known.provenance.kind] : []),
    ...also,
    "import",
  ]);
  const provenance = asHeld ? known.provenance : { ...item.provenance, kind, actor: actor.id };
  const provenanceNote = asHeld
    ? `provenance kept as the plane holds it for item ${item.id}: kind ${provenance.kind}, actor ${provenance.actor}`
    : `provenance set by adoption: kind ${kind}, the least trusted of the record's claim${known ? ", the plane's item of that id" : ""}${also.length > 0 ? ", an item of the same content the scope no longer holds" : ""} and import; actor ${actor.id}`;
  const grantNote =
    dropped.length === 0
      ? ""
      : `; adoption dropped ${dropped.map((g) => `the grant to ${g.to}`).join(", ")}, which the plane never recorded for item ${item.id} (${known ? "its item there does not carry it" : "it holds no item of that id"}); the plane narrows, never widens`;
  return [{ ...item, provenance, grants: kept } as MemoryItem, `${provenanceNote}${grantNote}`];
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Why the ref an adapter returned cannot be recorded for `item`, or null. It
 * must be a well-formed ref of this adapter, and no unrelated item may hold
 * it: only the item itself and the versions its lineage reaches share a ref
 * (decision D1, finding R5-14). A holder in `vacated` is one adoption
 * retires in the same transaction: the store no longer lists it, and lists
 * `item` at its ref instead (card RV4).
 */
export function refProblem(
  deps: PlaneDeps,
  item: MemoryItem,
  ref: StoreRef,
  adopted: boolean,
  vacated: ReadonlySet<string> = new Set(),
): string | null {
  if (!StoreRefShape.safeParse(ref).success)
    return `the store returned a malformed ref ${JSON.stringify(ref)}`;
  if (ref.adapter !== deps.adapter.name)
    return `the store ${deps.adapter.name} returned a ref of adapter ${ref.adapter}`;
  const other = refHolders(deps, item, ref).find((h) => !vacated.has(h.id));
  // The adapter contract gives two item ids two refs (the conformance suite's
  // "two item ids are two items under two refs"), so only a non-conforming
  // store gets here. After a write the plane cannot undo it and names what it
  // left behind (finding N4); adoption wrote nothing.
  if (!other) return null;
  const held = `item ${other.id} already holds ref ${ref.adapter}/${ref.key}; two item ids get two refs under the adapter contract, so this store breaks it`;
  return adopted
    ? `the store lists item ${item.id} at a ref ${held}; nothing was written`
    : `the store returned a ref ${held}: the bytes it wrote for item ${item.id} at that ref ` +
        `are orphaned, never projected, and may have replaced item ${other.id}'s record in the store`;
}

/**
 * The projected items, of any status, that hold `ref` and are neither `item`
 * itself nor a version its lineage reaches (decision D1).
 */
export function refHolders(deps: PlaneDeps, item: MemoryItem, ref: StoreRef): MemoryItem[] {
  const related = new Set([item.id]);
  const queue = [...item.lineage];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (related.has(id)) continue;
    related.add(id);
    queue.push(...(itemById(deps.db, id)?.lineage ?? []));
  }
  return itemsByStoreRef(deps.db, ref).filter((h) => !related.has(h.id));
}

/** What adoption (plane/adopt.ts) adds to a gated write. */
export interface Adoption {
  /** The ref the store already holds the item under; it is recorded, never written. */
  ref: StoreRef;
  /** Prefixed to every event's reason, such as `adopted from store files: `. */
  prefix: string;
  /** Appended to every event's reason, such as the item's hash. */
  suffix: string;
  /**
   * The log's head when the store was listed (commit.ts `logHead`). An item
   * the log changed after it, or whose person scope an offboarding began
   * erasing after it, is not adopted from that listing (card E2.6): the
   * listing may predate that change, or show a store write in flight, so the
   * next adoption reads the store again.
   */
  listed: number;
  /**
   * A refusal decided under the log's lock, before the gate: the reason and
   * rule of a deny event, or null to let the gate decide. Adoption refuses a
   * record holding content an offboarding erased (recheck of PR #41), and
   * any other record under an erased id whose record the erasure deleted
   * (card E2.6).
   */
  refuse?: (item: MemoryItem) => { reason: string; policy_id: string; purge?: boolean } | null;
  /**
   * Whether the store has vacated `holder`, an unrelated projected item at
   * the ref the store lists the adopted record under: the store no longer
   * lists `holder` at all, so it re-keyed the record (a moved files folder
   * gives a file a new id). When every unrelated holder is vacated, the ref
   * is recordable, and each one still active is retired through `retract` in
   * the transaction that records the adoption (card RV4). Without it, any
   * unrelated holder fails closed (refProblem).
   */
  vacated?: (holder: MemoryItem) => boolean;
  /** Appends the retirement of a vacated holder, `by` the item the store now lists at its ref. */
  retract?: (holder: MemoryItem, by: MemoryItem) => void;
  /**
   * The kinds of the scope's retired items of `item`'s content, and of those
   * this adoption retires because the store no longer lists them
   * (adoptedItem's `sameContent`).
   */
  sameContent?: (item: MemoryItem) => readonly Kind[];
}

/** What the gate decides about a write, before anything is committed. */
type Decided =
  | { kind: "schema"; item_id: string | null; scope_to: string | null; reason: string }
  | {
      /** Refused by the plane after the gate allowed: the scope is being erased, or the id was. */
      kind: "refused";
      item: MemoryItem;
      reason: string;
      policy_id: string;
      provenanceNote: string;
    }
  | {
      kind: "evaluated";
      item: MemoryItem;
      decision: ReturnType<typeof evaluateWrite>;
      provenanceNote: string;
      /** What the decision rested on, for the check under the lock (commit.ts). */
      basis: Basis;
      /** The item id was new at the decision: its lineage is checked again at the commit (V4-1). */
      isNew: boolean;
    };

/**
 * Why the plane refuses a write the gate allowed, or null (card E2.6): the
 * item, as written or as projected, is in a person scope an offboarding is
 * erasing; or, for a write that is not an adoption, its id belongs to an
 * item an offboarding erased and the projection no longer holds. An erased
 * id is never used again; a new memory takes a new id. The reason names the
 * erased scope only to a member of it (finding N3).
 */
function planeRefusal(
  db: Db,
  actor: Actor,
  item: MemoryItem,
  existing: MemoryItem | undefined,
  adopting: boolean,
): { reason: string; policy_id: string } | null {
  const scopes = [...new Set([item.scope, ...(existing ? [existing.scope] : [])])];
  const erasing = scopes.find((s) => erasureOpen(db, s));
  if (erasing) return { reason: erasingReason(erasing), policy_id: ERASING_ID };
  if (adopting || existing) return null;
  // A new item whose lineage names an erased or swept id carries content
  // traced to erased content (verification pass 3 of PR #50, V3-1).
  const ancestor = removedAncestor(db, item);
  const gone = lastErasure(db, item.id) ?? (ancestor ? lastRemoval(db, ancestor) : null);
  if (!gone) return null;
  const scope = gone.scope_from;
  return {
    reason:
      scope !== null && actor.memberships.includes(scope)
        ? ancestor && !lastErasure(db, item.id)
          ? `item ${item.id} names in its lineage item ${ancestor}, which an offboarding of ${scope} took out; content traced to it is not written again`
          : `item id ${item.id} belonged to an item erased with ${scope} at an offboarding; an erased id is never used again, so a new memory takes a new id`
        : "the item id is held by an item you cannot access",
    policy_id: WRITE_ERASED_ID,
  };
}

/**
 * The gate's decision on a write, pure: the call is checked (throwing
 * InvalidCallError), the item validated, its provenance set and the policy
 * evaluated against the projected item of the same id; an allowed write is
 * then refused when the plane must refuse it (planeRefusal). Nothing is
 * written and no event appended; `gatedWrite` commits this decision and
 * `checkWrite` only reports it (decision D12).
 */
function decideWrite(
  deps: PlaneDeps,
  actor: Actor,
  input: MemoryItem,
  at: string,
  adopting = false,
  sameContent: (item: MemoryItem) => readonly Kind[] = () => [],
): Decided {
  checkCall(actor, at, "write");
  const parsed = MemoryItem.safeParse(input);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join(".") || "item"}: ${i.message}`)
      .join("; ");
    return {
      kind: "schema",
      item_id: validOrNull(input, "id", Id),
      scope_to: validOrNull(input, "scope", Scope),
      reason: `the item fails the schema: ${problems}`,
    };
  }
  // The head first: a change appended after it, even before the projection is
  // read below, then counts as a change since the decision (commit.ts).
  const head = logHead(deps.db);
  const existing = itemById(deps.db, parsed.data.id);
  // Adoption records the store's record without raising its trust or
  // widening its grants (card RV4); every other write takes the plane's
  // provenance from its harness-set source.
  const [item, provenanceNote] = adopting
    ? adoptedItem(actor, parsed.data, existing, sameContent(parsed.data))
    : withPlaneProvenance(actor, parsed.data, deps.policy);
  const decision = evaluateWrite(
    deps.policy,
    actor,
    item,
    existing,
    retiredContent(deps.db, item.scope),
    at,
  );
  if (decision.decision === "allow") {
    // A landing that trust.protect_trusted keeps from evicting a more trusted
    // item is refused too (card E2.11; plane/retention.ts budgetRefusal).
    const refused =
      planeRefusal(deps.db, actor, item, existing, adopting) ??
      budgetRefusal(deps, actor, item, decision.status ?? item.status, at);
    if (refused) return { kind: "refused", item, ...refused, provenanceNote };
  }
  const scopes = [...new Set([item.scope, ...(existing ? [existing.scope] : [])])];
  return {
    kind: "evaluated",
    item,
    decision,
    provenanceNote,
    basis: { head, items: [item.id], scopes },
    isNew: existing === undefined,
  };
}

/** The decision, reason and rule a write would get now, without committing it (decision D12). */
export function checkWrite(
  deps: PlaneDeps,
  actor: Actor,
  input: MemoryItem,
  at: string,
): WriteCheckResult {
  const decided = decideWrite(deps, actor, input, at);
  if (decided.kind === "schema")
    return { decision: "deny", reason: decided.reason, policy_id: SCHEMA_ID };
  if (decided.kind === "refused")
    return {
      decision: "deny",
      reason: `${decided.reason}; ${decided.provenanceNote}`,
      policy_id: decided.policy_id,
    };
  const { decision, provenanceNote } = decided;
  return {
    decision: decision.decision,
    reason: `${decision.reason}; ${provenanceNote}`,
    policy_id: decision.policy_id,
  };
}

const writeBase = (actor: Actor, at: string) => ({
  ts: at,
  op: "write" as const,
  actor: actor.id,
  scope_from: null,
  schema_version: 1 as const,
});

/**
 * Appends the event of a decision that writes nothing: a schema denial, a
 * plane refusal or a gate denial. Returns null for an allowed decision.
 */
function appendRefusal(
  deps: PlaneDeps,
  actor: Actor,
  decided: Decided,
  at: string,
  mark: (reason: string) => string,
): WriteResult | null {
  const { db, newId } = deps;
  const base = writeBase(actor, at);
  if (decided.kind === "schema") {
    const event = appendEvent(db, {
      ...base,
      id: newId(),
      item_id: decided.item_id,
      scope_to: decided.scope_to,
      decision: "deny",
      reason: mark(decided.reason),
      policy_id: SCHEMA_ID,
    });
    return { item: null, event, retention: [] };
  }
  if (decided.kind === "refused") {
    const event = appendEvent(db, {
      ...base,
      id: newId(),
      item_id: decided.item.id,
      scope_to: decided.item.scope,
      decision: "deny",
      reason: mark(`${decided.reason}; ${decided.provenanceNote}`),
      policy_id: decided.policy_id,
    });
    return { item: null, event, retention: [] };
  }
  const { item, decision, provenanceNote } = decided;
  // The evaluator gives a status exactly when it allows.
  if (decision.status !== null) return null;
  const event = appendEvent(db, {
    ...base,
    id: newId(),
    item_id: item.id,
    scope_to: item.scope,
    decision: decision.decision,
    reason: mark(`${decision.reason}; ${provenanceNote}`),
    policy_id: decision.policy_id,
  });
  return { item: null, event, retention: [] };
}

async function decideAndWrite(
  deps: PlaneDeps,
  actor: Actor,
  input: MemoryItem,
  at: string,
): Promise<WriteResult> {
  const { db, adapter, newId } = deps;
  const decided = decideWrite(deps, actor, input, at);
  const refused = appendRefusal(deps, actor, decided, at, (r) => r);
  if (refused || decided.kind !== "evaluated") return refused as WriteResult;

  const { item, decision, provenanceNote, basis, isNew } = decided;
  const common = {
    ...writeBase(actor, at),
    item_id: item.id,
    scope_to: item.scope,
    decision: decision.decision,
    reason: `${decision.reason}; ${provenanceNote}`,
    policy_id: decision.policy_id,
  };
  // The store gets the item as it will stand, with the gate's status; the
  // caller's store_ref is never trusted, the adapter's is recorded.
  const toStore: MemoryItem = { ...item, status: decision.status, store_ref: null } as MemoryItem;
  const failed = (problem: string) =>
    appendEvent(db, {
      ...common,
      id: newId(),
      decision: "deny",
      policy_id: STORE_FAILURE_ID,
      reason: `the gate allowed the write (${decision.policy_id}) but the store failed: ${problem}; ${provenanceNote}`,
    });
  let ref: StoreRef;
  let outcome:
    | { stale: string; policy_id: string }
    | { stored: MemoryItem; event: WriteResult["event"]; retention: WriteResult["retention"] };
  try {
    ref = await adapter.write(toStore);
    // Under the log's lock: the decision must still stand (commit.ts), the
    // ref must be recordable, and the budget check of the written scope and
    // class runs in the same transaction, so no write, on this handle or
    // another, lands between the write and its evictions. The item just
    // written is never its own victim (review finding P4-1).
    outcome = db.transaction(() => {
      const stale = staleness(db, basis, ownBytes(deps, { ...toStore, store_ref: ref }));
      if (stale) return { stale, policy_id: WRITE_CONFLICT_ID };
      // A new item whose lineage names an id an offboarding took out after
      // the decision carries content traced to erased content: refused here
      // as at the decision (verification pass 4 of PR #50, V4-1).
      const ancestor = isNew ? removedAncestor(db, item) : null;
      if (ancestor)
        return {
          stale: `its lineage names item ${ancestor}, which an offboarding took out after the decision`,
          policy_id: WRITE_ERASED_ID,
        };
      // Another handle may have filled the scope since the decision.
      const roomless = budgetRefusal(deps, actor, toStore, toStore.status, at);
      if (roomless) return { stale: roomless.reason, policy_id: roomless.policy_id };
      const problem = refProblem(deps, item, ref, false);
      if (problem) throw new Error(problem);
      const stored = { ...toStore, store_ref: ref };
      const event = appendEvent(db, { ...common, id: newId(), item: stored });
      const retention = enforceBudget(deps, actor, stored.scope, stored.class, at, stored.id);
      return { stored, event, retention };
    });
  } catch (e) {
    failed(errorText(e));
    throw e;
  }
  if ("stale" in outcome) {
    const why = outcome.stale;
    const refusedUnder = outcome.policy_id;
    try {
      const stale = {
        wrote: { ...toStore, store_ref: ref },
        head: basis.head,
        actor: actor.id,
        at,
      };
      const event = await settle(deps, item.id, ref, stale, (note) =>
        appendEvent(db, {
          ...common,
          id: newId(),
          decision: "deny",
          policy_id: refusedUnder,
          reason: `the gate allowed the write (${decision.policy_id}) but ${why}, before it was committed; the decision no longer stands, so the write is refused and the store is put back as the log has it; ${provenanceNote}${note}`,
        }),
      );
      return { item: null, event, retention: [] };
    } catch (e) {
      failed(
        `the write was refused (${refusedUnder}: ${why}) and the store could not be put back: ${errorText(e)}`,
      );
      throw e;
    }
  }
  const { stored, event, retention } = outcome;
  // The result is the item as it stands after the slot.
  return { item: itemById(db, stored.id) ?? stored, event, retention };
}

/**
 * Plane.write. Writes over one db handle run one at a time, in call order:
 * each decides against the projection the previous one left, so two
 * concurrent writes of one id cannot both pass the membership, owner and
 * version checks against a projection that no longer holds by the time they
 * land (finding N2 of the second review). A write that fails does not stall
 * the queue. Reads are not queued: a read takes the projection under the
 * log's lock. A writer on another handle sharing the same log is ordered by
 * the log's lock instead: the write's decision is checked again in the
 * transaction that commits it, and a stale one is refused (card E2.6,
 * commit.ts). The queue is plane/queue.ts, shared with Plane.retain and any
 * other call that changes items.
 */
export function gatedWrite(
  deps: PlaneDeps,
  actor: Actor,
  input: MemoryItem,
  at: string,
): Promise<WriteResult> {
  return inWriteQueue(deps.db, () => decideAndWrite(deps, actor, input, at));
}

/**
 * Adoption's write (plane/adopt.ts, decision D8): the store already holds the
 * item, so nothing is written to it, and the whole decision and its commit
 * run in one transaction, under the log's lock, in the write queue: no
 * writer on any handle lands between them. Returns null, appending nothing,
 * when the listing is older than a change the log holds for the item
 * (`adoption.listed`); the next adoption reads the store again.
 */
export function adoptWrite(
  deps: PlaneDeps,
  actor: Actor,
  input: MemoryItem,
  at: string,
  adoption: Adoption,
): Promise<WriteResult | null> {
  const { db, newId } = deps;
  const mark = (reason: string) => `${adoption.prefix}${reason}${adoption.suffix}`;
  const commit = (): WriteResult | null | { error: Error } => {
    const listedId = validOrNull(input, "id", Id);
    const listedScope = validOrNull(input, "scope", Scope);
    if (listedId !== null && touchedSince(db, listedId, adoption.listed)) return null;
    if (listedScope !== null && erasureBegunSince(db, listedScope, adoption.listed)) return null;
    const decided = decideWrite(deps, actor, input, at, true, adoption.sameContent);
    if (decided.kind !== "schema") {
      const refusal = adoption.refuse?.(decided.item) ?? null;
      if (refusal) {
        const event = appendEvent(db, {
          ...writeBase(actor, at),
          id: newId(),
          item_id: decided.item.id,
          scope_to: decided.item.scope,
          decision: "deny",
          reason: mark(refusal.reason),
          policy_id: refusal.policy_id,
        });
        return { item: null, event, retention: [] };
      }
    }
    const refused = appendRefusal(deps, actor, decided, at, mark);
    if (refused || decided.kind !== "evaluated") return refused;
    const { item, decision, provenanceNote } = decided;
    const common = {
      ...writeBase(actor, at),
      item_id: item.id,
      scope_to: item.scope,
      reason: mark(`${decision.reason}; ${provenanceNote}`),
    };
    // Unrelated holders of the ref that the store no longer lists were
    // re-keyed by the store: they are retired here, before the adoption is
    // recorded, so the ref is recordable (card RV4). A holder the log changed
    // since the listing leaves this record to the next adoption.
    const holders = refHolders(deps, item, adoption.ref);
    const vacated = adoption.vacated;
    const vacating = holders.length > 0 && vacated !== undefined && holders.every(vacated);
    if (vacating && holders.some((h) => touchedSince(db, h.id, adoption.listed))) return null;
    const problem = refProblem(
      deps,
      item,
      adoption.ref,
      true,
      new Set(vacating ? holders.map((h) => h.id) : []),
    );
    if (problem) {
      appendEvent(db, {
        ...common,
        id: newId(),
        decision: "deny",
        policy_id: STORE_FAILURE_ID,
        reason: mark(
          `the gate allowed the write (${decision.policy_id}) but the store's ref cannot be recorded: ${problem}; ${provenanceNote}`,
        ),
      });
      return { error: new Error(problem) };
    }
    const stored = {
      ...item,
      status: decision.status,
      store_ref: adoption.ref,
    } as MemoryItem;
    if (vacating)
      for (const h of holders) if (h.status !== "retired") adoption.retract?.(h, stored);
    const event = appendEvent(db, {
      ...common,
      id: newId(),
      decision: "allow",
      policy_id: decision.policy_id,
      item: stored,
    });
    const retention = enforceBudget(deps, actor, stored.scope, stored.class, at, stored.id);
    return { item: itemById(db, stored.id) ?? stored, event, retention };
  };
  return inWriteQueue(db, () => {
    // The store-failure event is committed; the error is thrown after, as a
    // write's is (decision D6).
    const out = db.transaction(commit);
    if (out && "error" in out) throw out.error;
    return out;
  });
}
