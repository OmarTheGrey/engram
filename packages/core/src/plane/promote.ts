// Promotion on the plane (card E2.5, ADR 0026). The pure evaluator
// (policy/promotion.ts) decides; this file gathers its evidence from the log
// and commits the decision, all in one slot of the write queue, so a
// promotion decides against the projection the previous change left.
//
// Confirmations are counted from the log, never stored: every allowed write
// event whose item is in the promoted item's scope and has its content in
// the strict normal form (content-hash.ts, review finding P5-12), with the
// actor the event names, the provenance kind the written item carried and
// that item's status now. The evaluator keeps active, trusted ones and
// counts distinct actors. The plane also gathers who wrote the item or any
// version in its lineage (none may approve it, P5-1) and whether an active
// item of the promoted class already holds the content in the target (P5-5).
// A promoter who cannot read the target scope gets the decision's event and
// a null item (P5-7).
//
// On allow, a status-only change rewrites the item in place (same id,
// version plus one); a class or scope change writes a new version under a
// fresh id to the store through the adapter, appends its `promote` event and
// a `retire` event for the source (`<policy>/promotion/superseded`) in one
// transaction, then runs the target's budget check, still in the slot. On
// ask, one `gate` event and no item. On deny, one `promote` event. A store
// failure after an allow appends one deny event naming it and rethrows, as a
// write does (decision D6).
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { strictContentHash } from "../content-hash.ts";
import { allEvents, appendEvent, currentItems } from "../events.ts";
import { itemById, lineage } from "../items.ts";
import type { GateResult, PlaneDeps, PromoteOptions } from "../plane.ts";
import { readableScope, STORE_FAILURE_ID } from "../policy/evaluate.ts";
import {
  type Confirmation,
  evaluatePromotion,
  PROMOTE_MEMBERSHIP_ID,
  promotionRuleId,
} from "../policy/promotion.ts";
import { Id, type MemoryEvent, type MemoryItem, Scope } from "../schema.ts";
import { inWriteQueue } from "./queue.ts";
import { enforceBudget } from "./retention.ts";
import { refProblem, retiredContent } from "./write.ts";

/** Every allowed write of `item`'s content in its scope, in log order (ADR 0026, item 2). */
export function confirmationsOf(deps: PlaneDeps, item: MemoryItem): Confirmation[] {
  const hash = strictContentHash(item.content);
  return allEvents(deps.db).flatMap((e) =>
    e.op === "write" &&
    e.decision === "allow" &&
    e.item &&
    e.item.scope === item.scope &&
    strictContentHash(e.item.content) === hash
      ? [
          {
            item_id: e.item.id,
            actor: e.actor,
            kind: e.item.provenance.kind,
            status: itemById(deps.db, e.item.id)?.status ?? "retired",
          },
        ]
      : [],
  );
}

/** Every actor of an allowed write or update of `item` or any version in its lineage (P5-1). */
export function authorsOf(deps: PlaneDeps, item: MemoryItem): string[] {
  const ids = new Set([item.id, ...lineage(deps.db, item.id).ancestors.map((a) => a.id)]);
  const out = new Set<string>();
  for (const e of allEvents(deps.db))
    if (
      (e.op === "write" || e.op === "update") &&
      e.decision === "allow" &&
      e.item_id !== null &&
      ids.has(e.item_id)
    )
      out.add(e.actor);
  return [...out];
}

/** An active item of `cls` in `scope`, other than `item`, holding its content (strict form), if any. */
function duplicateOf(
  deps: PlaneDeps,
  item: MemoryItem,
  scope: string,
  cls: MemoryItem["class"],
): string | undefined {
  const hash = strictContentHash(item.content);
  return currentItems(deps.db).find(
    (i) =>
      i.id !== item.id &&
      i.scope === scope &&
      i.class === cls &&
      i.status === "active" &&
      strictContentHash(i.content) === hash,
  )?.id;
}

/**
 * Plane.promote. The call is checked (actor, time, item id and target
 * scope) before the log is touched; then the whole decide-and-commit runs in
 * one slot of the write queue.
 */
export function promote(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  toScope: string,
  at: string,
  options: PromoteOptions = {},
): Promise<GateResult> {
  checkCall(actor, at, "promote");
  if (!Id.safeParse(itemId).success)
    throw new InvalidCallError(
      `Plane.promote: invalid item id ${JSON.stringify(itemId)}; expected a UUIDv7`,
    );
  if (!Scope.safeParse(toScope).success)
    throw new InvalidCallError(
      `Plane.promote: invalid scope ${JSON.stringify(toScope)}; expected person:<id>, role:<id>, team:<id> or org`,
    );
  return inWriteQueue(deps.db, () => decideAndCommit(deps, actor, itemId, toScope, at, options));
}

async function decideAndCommit(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  toScope: string,
  at: string,
  options: PromoteOptions,
): Promise<GateResult> {
  const { db, adapter, newId, policy } = deps;
  const base = { ts: at, actor: actor.id, schema_version: 1 as const };
  const item = itemById(db, itemId);

  if (!item) {
    // The same refusal as for an item the actor cannot access: an unknown id
    // and a hidden one look alike (decision D5).
    const event = appendEvent(db, {
      ...base,
      id: newId(),
      op: "promote",
      item_id: itemId,
      scope_from: null,
      scope_to: toScope,
      decision: "deny",
      reason: `item ${itemId} is not one ${actor.id} can access, so it cannot promote it`,
      policy_id: PROMOTE_MEMBERSHIP_ID,
    });
    return { decision: "deny", item: null, event, events: [event] };
  }

  const d = evaluatePromotion(
    policy,
    actor,
    item,
    { scope: toScope, at },
    {
      confirmations: confirmationsOf(deps, item),
      authors: authorsOf(deps, item),
      duplicate: duplicateOf(
        deps,
        item,
        toScope,
        item.class === "episodic" ? "semantic" : item.class,
      ),
      review: options.review === true,
    },
    retiredContent(db, toScope),
  );
  const visible = d.policy_id !== PROMOTE_MEMBERSHIP_ID;
  const common = {
    ...base,
    item_id: item.id,
    scope_from: visible ? item.scope : null,
    scope_to: toScope,
    reason: d.reason,
    policy_id: d.policy_id,
  };

  if (d.decision !== "allow" || d.promoted === null) {
    // `ask` is a gate event: the request waits in the review queue (E8.8).
    const event = appendEvent(db, {
      ...common,
      id: newId(),
      op: d.decision === "ask" ? "gate" : "promote",
      decision: d.decision === "ask" ? "ask" : "deny",
    });
    return { decision: event.decision, item: null, event, events: [event] };
  }

  const fresh = d.transition === "new-version";
  const toStore: MemoryItem = {
    ...d.promoted,
    id: fresh ? newId() : item.id,
    store_ref: null,
  } as MemoryItem;
  let stored: MemoryItem;
  let committed: MemoryEvent[];
  try {
    const store_ref = await adapter.write(toStore);
    // Only the source and its own lineage may share the new version's ref:
    // the confirming items its lineage also names are not versions (P5-10).
    const problem = refProblem(
      deps,
      fresh ? ({ ...toStore, lineage: [item.id] } as MemoryItem) : toStore,
      store_ref,
      false,
    );
    if (problem) throw new Error(problem);
    stored = { ...toStore, store_ref };
    committed = db.transaction(() => {
      const promoted = appendEvent(db, {
        ...common,
        id: newId(),
        op: "promote",
        decision: "allow",
        item_id: stored.id,
        item: stored,
      });
      if (!fresh) return [promoted];
      const retired = appendEvent(db, {
        ...base,
        id: newId(),
        op: "retire",
        item_id: item.id,
        scope_from: item.scope,
        scope_to: toScope,
        decision: "allow",
        reason: `superseded by ${stored.id}, its promotion to a ${stored.class} item in ${toScope}`,
        policy_id: promotionRuleId(policy, "superseded"),
      });
      return [promoted, retired];
    });
  } catch (e) {
    appendEvent(db, {
      ...common,
      id: newId(),
      op: "promote",
      decision: "deny",
      policy_id: STORE_FAILURE_ID,
      reason: `the gate allowed the promotion (${d.policy_id}) but the store failed: ${e instanceof Error ? e.message : String(e)}`,
    });
    throw e;
  }
  // Still in this promotion's queue slot: no other change lands in between.
  const retention = enforceBudget(deps, actor, stored.scope, stored.class, at, stored.id);
  const [event] = committed as [MemoryEvent, ...MemoryEvent[]];
  // The event is the audit record; the item goes back only to a promoter
  // who can read where it landed (P5-7).
  const visibleItem = readableScope(policy, actor, stored.scope) ? stored : null;
  return { decision: "allow", item: visibleItem, event, events: [...committed, ...retention] };
}
