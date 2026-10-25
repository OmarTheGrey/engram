// The write path (card E2.3, docs/architecture.md "Write path"): validate the
// item against the schema, evaluate the write rule for its scope level, and
// only on allow call the adapter, record the store_ref and append the event
// carrying the stored item. A denial appends one event with its reason and
// policy_id and never reaches the adapter.
import { appendEvent } from "../events.ts";
import type { Actor, PlaneDeps, WriteResult } from "../plane.ts";
import { evaluateWrite, SCHEMA_ID } from "../policy/evaluate.ts";
import { Id, MemoryItem, Scope } from "../schema.ts";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;

/** The valid value of `key` on an unvalidated item, or null. */
const validOrNull = (value: unknown, key: string, schema: typeof Id | typeof Scope) => {
  const parsed = schema.safeParse(field(value, key));
  return parsed.success ? parsed.data : null;
};

export async function gatedWrite(
  { db, adapter, policy, newId }: PlaneDeps,
  actor: Actor,
  input: MemoryItem,
  at: string,
): Promise<WriteResult> {
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

  const item = parsed.data;
  const decision = evaluateWrite(policy, item);
  const common = {
    ...base,
    item_id: item.id,
    scope_to: item.scope,
    decision: decision.decision,
    reason: decision.reason,
    policy_id: decision.policy_id,
  };
  // The evaluator gives a status exactly when it allows.
  if (decision.status === null) {
    return { item: null, event: appendEvent(db, { ...common, id: newId() }) };
  }

  // The store gets the item as it will stand, with the gate's status; the
  // caller's store_ref is never trusted, the adapter's is recorded.
  const toStore: MemoryItem = { ...item, status: decision.status, store_ref: null };
  const store_ref = await adapter.write(toStore);
  const stored: MemoryItem = { ...toStore, store_ref };
  const event = appendEvent(db, { ...common, id: newId(), item: stored });
  return { item: stored, event };
}
