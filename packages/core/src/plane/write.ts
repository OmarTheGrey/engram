// The write path (card E2.3, docs/architecture.md "Write path"): check the
// call (actor and time), validate the item against the schema, set its
// provenance from the actor's harness-set source, evaluate the write gate
// against the policy and the projected item of the same id, and only on allow
// call the adapter, record the store_ref and append the event carrying the
// stored item. A denial appends one event with its reason and policy_id and
// never reaches the adapter. A store failure after an allow appends one deny
// event naming it and rethrows, so a store write never happens without an
// event (decision D6). With `adoption`, an allowed item is recorded at the
// store_ref the store already holds it under instead of being written, and
// every event's reason is marked as an adoption from that store (plane/adopt.ts,
// decision D8); that ref goes through the same checks as one the adapter
// returns, and a ref that cannot be recorded leaves the store-failure event.
//
// After a landing write, in the same queue slot, the budget check of the
// written scope and class runs (card E2.4, ADR 0025): so no write sequence
// leaves a scope over a recency or utility budget, and a manual rule's
// overage is asked about once per write that leaves it over.
import { z } from "zod";
import { type Actor, checkCall } from "../actor.ts";
import type { StoreRef } from "../adapter.ts";
import { contentHash } from "../content-hash.ts";
import type { Db } from "../db/db.ts";
import { appendEvent } from "../events.ts";
import { itemById, itemsByStoreRef } from "../items.ts";
import type { PlaneDeps, WriteCheckResult, WriteResult } from "../plane.ts";
import { evaluateWrite, SCHEMA_ID, STORE_FAILURE_ID } from "../policy/evaluate.ts";
import { ITEM_TTL_ID } from "../policy/retention.ts";
import { Id, MemoryItem, Scope } from "../schema.ts";
import { inWriteQueue } from "./queue.ts";
import { enforceBudget } from "./retention.ts";

export { checkCall };

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
 * caller claimed; without one, the caller's provenance stands.
 */
export function withPlaneProvenance(actor: Actor, item: MemoryItem): [MemoryItem, string] {
  if (!actor.source) return [item, "provenance as claimed by the caller"];
  const provenance = { ...item.provenance, kind: actor.source, actor: actor.id };
  return [
    { ...item, provenance } as MemoryItem,
    `provenance set by the plane: source ${actor.source}, actor ${actor.id}`,
  ];
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Why the ref an adapter returned cannot be recorded for `item`, or null. It
 * must be a well-formed ref of this adapter, and no unrelated item may hold
 * it: only the item itself and the versions its lineage reaches share a ref
 * (decision D1, finding R5-14).
 */
export function refProblem(
  deps: PlaneDeps,
  item: MemoryItem,
  ref: StoreRef,
  adopted: boolean,
): string | null {
  if (!StoreRefShape.safeParse(ref).success)
    return `the store returned a malformed ref ${JSON.stringify(ref)}`;
  if (ref.adapter !== deps.adapter.name)
    return `the store ${deps.adapter.name} returned a ref of adapter ${ref.adapter}`;
  const related = new Set([item.id]);
  const queue = [...item.lineage];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (related.has(id)) continue;
    related.add(id);
    queue.push(...(itemById(deps.db, id)?.lineage ?? []));
  }
  const other = itemsByStoreRef(deps.db, ref).find((h) => !related.has(h.id));
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

/** What adoption (plane/adopt.ts) adds to a gated write. */
export interface Adoption {
  /** The ref the store already holds the item under; it is recorded, never written. */
  ref: StoreRef;
  /** Prefixed to every event's reason, such as `adopted from store files: `. */
  prefix: string;
  /** Appended to every event's reason, such as the item's hash. */
  suffix: string;
}

/** What the gate decides about a write, before anything is committed. */
type Decided =
  | { kind: "schema"; item_id: string | null; scope_to: string | null; reason: string }
  | {
      kind: "evaluated";
      item: MemoryItem;
      decision: ReturnType<typeof evaluateWrite>;
      provenanceNote: string;
    };

/**
 * The gate's decision on a write, pure: the call is checked (throwing
 * InvalidCallError), the item validated, its provenance set and the policy
 * evaluated against the projected item of the same id. Nothing is written
 * and no event appended; `gatedWrite` commits this decision and
 * `checkWrite` only reports it (decision D12).
 */
function decideWrite(deps: PlaneDeps, actor: Actor, input: MemoryItem, at: string): Decided {
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
  const [item, provenanceNote] = withPlaneProvenance(actor, parsed.data);
  const decision = evaluateWrite(
    deps.policy,
    actor,
    item,
    itemById(deps.db, item.id),
    retiredContent(deps.db, item.scope),
  );
  return { kind: "evaluated", item, decision, provenanceNote };
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
  const { decision, provenanceNote } = decided;
  return {
    decision: decision.decision,
    reason: `${decision.reason}; ${provenanceNote}`,
    policy_id: decision.policy_id,
  };
}

async function decideAndWrite(
  deps: PlaneDeps,
  actor: Actor,
  input: MemoryItem,
  at: string,
  adoption?: Adoption,
): Promise<WriteResult> {
  const { db, adapter, newId } = deps;
  const decided = decideWrite(deps, actor, input, at);
  const mark = (reason: string) =>
    adoption ? `${adoption.prefix}${reason}${adoption.suffix}` : reason;
  const base = {
    ts: at,
    op: "write" as const,
    actor: actor.id,
    scope_from: null,
    schema_version: 1 as const,
  };

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

  const { item, decision, provenanceNote } = decided;
  const common = {
    ...base,
    item_id: item.id,
    scope_to: item.scope,
    decision: decision.decision,
    reason: mark(`${decision.reason}; ${provenanceNote}`),
    policy_id: decision.policy_id,
  };
  // The evaluator gives a status exactly when it allows.
  if (decision.status === null) {
    return { item: null, event: appendEvent(db, { ...common, id: newId() }), retention: [] };
  }

  // The store gets the item as it will stand, with the gate's status; the
  // caller's store_ref is never trusted, the adapter's is recorded.
  const toStore: MemoryItem = { ...item, status: decision.status, store_ref: null };
  const failed = (problem: string) =>
    appendEvent(db, {
      ...common,
      id: newId(),
      decision: "deny",
      policy_id: STORE_FAILURE_ID,
      reason: mark(
        `the gate allowed the write (${decision.policy_id}) but ${adoption ? "the store's ref cannot be recorded" : "the store failed"}: ${problem}; ${provenanceNote}`,
      ),
    });
  let stored: MemoryItem;
  let event: WriteResult["event"];
  try {
    const store_ref = adoption ? adoption.ref : await adapter.write(toStore);
    const problem = refProblem(deps, item, store_ref, adoption !== undefined);
    if (problem) throw new Error(problem);
    stored = { ...toStore, store_ref };
    event = appendEvent(db, { ...common, id: newId(), item: stored });
  } catch (e) {
    failed(errorText(e));
    throw e;
  }
  // Still in this write's queue slot: no other write lands in between.
  // The item just written is never its own victim (review finding P4-1);
  // the result is the item as it stands after the slot all the same.
  const retention = enforceBudget(deps, actor, stored.scope, stored.class, at, stored.id);
  return { item: itemById(db, stored.id) ?? stored, event, retention };
}

/**
 * Plane.write. Writes over one db handle run one at a time, in call order:
 * each decides against the projection the previous one left, so two
 * concurrent writes of one id cannot both pass the membership, owner and
 * version checks against a projection that no longer holds by the time they
 * land (finding N2 of the second review). A write that fails does not stall
 * the queue. Reads are not queued: a read takes the projection once,
 * synchronously, and sees each write either wholly or not at all. Writers in
 * another process sharing the same log file are not serialised by this
 * (ADR 0007's amendments). The queue is plane/queue.ts, shared with
 * Plane.retain and any other call that changes items.
 */
export function gatedWrite(...args: Parameters<typeof decideAndWrite>): Promise<WriteResult> {
  return inWriteQueue(args[0].db, () => decideAndWrite(...args));
}
