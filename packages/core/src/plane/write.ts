// The write path (card E2.3, docs/architecture.md "Write path"): check the
// call (actor and time), validate the item against the schema, set its
// provenance from the actor's harness-set source, evaluate the write gate
// against the policy and the projected item of the same id, and only on allow
// call the adapter, record the store_ref and append the event carrying the
// stored item. A denial appends one event with its reason and policy_id and
// never reaches the adapter. A store failure after an allow appends one deny
// event naming it and rethrows, so a store write never happens without an
// event (decision D6).
import { z } from "zod";
import { type Actor, ActorShape, InvalidCallError } from "../actor.ts";
import type { StoreRef } from "../adapter.ts";
import { appendEvent } from "../events.ts";
import { itemById, itemsByStoreRef } from "../items.ts";
import type { PlaneDeps, WriteResult } from "../plane.ts";
import { evaluateWrite, SCHEMA_ID, STORE_FAILURE_ID } from "../policy/evaluate.ts";
import { Id, MemoryItem, Scope, Timestamp } from "../schema.ts";

const StoreRefShape = z.object({ adapter: z.string().min(1), key: z.string().min(1) });

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;

/** The valid value of `key` on an unvalidated item, or null. */
const validOrNull = (value: unknown, key: string, schema: typeof Id | typeof Scope) => {
  const parsed = schema.safeParse(field(value, key));
  return parsed.success ? parsed.data : null;
};

/** Refuses a call whose actor or time no event could carry (decision D6). */
export function checkCall(actor: unknown, at: unknown, method: string): void {
  const a = ActorShape.safeParse(actor);
  if (!a.success)
    throw new InvalidCallError(
      `Plane.${method}: invalid actor: ${a.error.issues.map((i) => `${i.path.join(".") || "actor"}: ${i.message}`).join("; ")}`,
    );
  if (!Timestamp.safeParse(at).success)
    throw new InvalidCallError(
      `Plane.${method}: invalid time ${JSON.stringify(at)}; expected a UTC ISO 8601 timestamp with a Z`,
    );
}

/**
 * The item with the provenance the plane sets (decision D4, ADR 0004): with
 * a harness-set source, its kind and the writing actor replace what the
 * caller claimed; without one, the caller's provenance stands.
 */
function withPlaneProvenance(actor: Actor, item: MemoryItem): [MemoryItem, string] {
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
function refProblem(deps: PlaneDeps, item: MemoryItem, ref: StoreRef): string | null {
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
  return other
    ? `the store returned ref ${ref.adapter}/${ref.key}, which item ${other.id} already holds`
    : null;
}

export async function gatedWrite(
  deps: PlaneDeps,
  actor: Actor,
  input: MemoryItem,
  at: string,
): Promise<WriteResult> {
  const { db, adapter, policy, newId } = deps;
  checkCall(actor, at, "write");
  const base = {
    ts: at,
    op: "write" as const,
    actor: actor.id,
    scope_from: null,
    schema_version: 0 as const,
  };

  const parsed = MemoryItem.safeParse(input);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join(".") || "item"}: ${i.message}`)
      .join("; ");
    const event = appendEvent(db, {
      ...base,
      id: newId(),
      item_id: validOrNull(input, "id", Id),
      scope_to: validOrNull(input, "scope", Scope),
      decision: "deny",
      reason: `the item fails the schema: ${problems}`,
      policy_id: SCHEMA_ID,
    });
    return { item: null, event };
  }

  const [item, provenanceNote] = withPlaneProvenance(actor, parsed.data);
  const decision = evaluateWrite(policy, actor, item, itemById(db, item.id));
  const common = {
    ...base,
    item_id: item.id,
    scope_to: item.scope,
    decision: decision.decision,
    reason: `${decision.reason}; ${provenanceNote}`,
    policy_id: decision.policy_id,
  };
  // The evaluator gives a status exactly when it allows.
  if (decision.status === null) {
    return { item: null, event: appendEvent(db, { ...common, id: newId() }) };
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
      reason: `the gate allowed the write (${decision.policy_id}) but the store failed: ${problem}; ${provenanceNote}`,
    });
  try {
    const store_ref = await adapter.write(toStore);
    const problem = refProblem(deps, item, store_ref);
    if (problem) throw new Error(problem);
    const stored: MemoryItem = { ...toStore, store_ref };
    const event = appendEvent(db, { ...common, id: newId(), item: stored });
    return { item: stored, event };
  } catch (e) {
    failed(errorText(e));
    throw e;
  }
}
