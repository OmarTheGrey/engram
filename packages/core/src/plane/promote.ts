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
// A procedural candidate's validation record is derived from the replay the
// caller presents (card D3, distill/validate.ts): the held-out outcomes, from
// which the plane counts k of n itself. A malformed replay is refused before
// the queue; one that is not the item's (another id or content, induction
// tasks other than its distill ref's, or a replayed induction task) is a deny
// event under engram/promote/replay-item or replay-split (D3-3).
//
// On allow, a status-only change rewrites the item in place (same id,
// version plus one); a class or scope change writes a new version under a
// fresh id to the store through the adapter, appends its `promote` event and
// a `retire` event for the source (`<policy>/promotion/superseded`) in one
// transaction, then runs the target's budget check, still in the slot. On
// ask, one `gate` event and no item. On deny, one `promote` event. A store
// failure after an allow appends one deny event naming it and rethrows, as a
// write does (decision D6).
//
// Across db handles (card E2.6, plane/commit.ts): a promotion out of or into
// a person scope an offboarding is erasing is refused at once
// (engram/offboard/erasing), and the allow is appended only if, under the
// log's lock, nothing changed the source and no offboarding began erasing
// either scope since the decision. Otherwise the promotion is refused
// (engram/promote/conflict): the record it wrote is put back as the log has
// it (the new version's record deleted; an in-place rewrite replaced by the
// projected item, or deleted when the item is gone or being erased), and the
// deny event is appended once the store holds that.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import type { StoreRef } from "../adapter.ts";
import { strictContentHash } from "../content-hash.ts";
import {
  bindingProblem,
  type ReplayEvidence,
  replayDigest,
  replayProblem,
  scoreReplay,
  sizeProblem,
  splitProblem,
} from "../distill/validate.ts";
import { allEvents, appendEvent, currentItems } from "../events.ts";
import { itemById, lineage } from "../items.ts";
import type { GateResult, PlaneDeps, PromoteOptions } from "../plane.ts";
import { readableScope, STORE_FAILURE_ID } from "../policy/evaluate.ts";
import {
  type Confirmation,
  evaluatePromotion,
  PROMOTE_MEMBERSHIP_ID,
  PROMOTE_REPLAY_SPLIT_ID,
  promotionRuleId,
} from "../policy/promotion.ts";
import { Id, type MemoryEvent, type MemoryItem, Scope } from "../schema.ts";
import {
  basisNow,
  ERASING_ID,
  erasingReason,
  erasureOpen,
  ownBytes,
  PROMOTE_CONFLICT_ID,
  removedAncestor,
  settle,
  staleness,
} from "./commit.ts";
import { inWriteQueue } from "./queue.ts";
import { enforceBudget } from "./retention.ts";
import { refProblem, retiredContent } from "./write.ts";

export { PROMOTE_CONFLICT_ID };

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
 * What a presented replay gives the evaluator: the record the plane counts
 * from it (a leaked one counts nothing, and is refused for its split), and
 * why it is not the item's replay, if it is not.
 */
function replayEvidence(deps: PlaneDeps, item: MemoryItem, replay: ReplayEvidence) {
  const size = sizeProblem(deps.policy, replay);
  const problem =
    bindingProblem(item, replay, deps.distillTasks) ??
    (size === null ? null : { policy_id: PROMOTE_REPLAY_SPLIT_ID, reason: size });
  const validation =
    splitProblem(replay) === null
      ? scoreReplay(replay).record
      : { k: 0, n: 0, replay_sha256: replayDigest(replay) };
  return { validation, ...(problem === null ? {} : { replayProblem: problem }) };
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
  // A replay the plane cannot judge is a malformed call, like an invalid
  // scope (card D3): a leaked split, a reward outside 0 to 1, uneven seeds.
  if (options.replay !== undefined) {
    const problem = replayProblem(options.replay);
    if (problem) throw new InvalidCallError(`Plane.promote: ${problem}`);
  }
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
  // The head before the projection is read (commit.ts).
  const basis = basisNow(db, [itemId], []);
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
      // The record is derived here from the replay's outcomes, never taken
      // from the caller (card D3, ADR 0045 proposed), and the replay is
      // checked against the item: its id, content and distill ref (D3-3).
      ...(options.replay === undefined ? {} : replayEvidence(deps, item, options.replay)),
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

  // An allowed promotion is shown to someone who may see the source, so the
  // reason may name the scope.
  const erasing = [item.scope, toScope].find((s) => erasureOpen(db, s));
  if (erasing) {
    const event = appendEvent(db, {
      ...common,
      id: newId(),
      op: "promote",
      decision: "deny",
      reason: erasingReason(erasing),
      policy_id: ERASING_ID,
    });
    return { decision: "deny", item: null, event, events: [event] };
  }
  const decided = { ...basis, scopes: [...new Set([item.scope, toScope])] };

  const fresh = d.transition === "new-version";
  const toStore: MemoryItem = {
    ...d.promoted,
    id: fresh ? newId() : item.id,
    store_ref: null,
  } as MemoryItem;
  const failed = (problem: string) =>
    appendEvent(db, {
      ...common,
      id: newId(),
      op: "promote",
      decision: "deny",
      policy_id: STORE_FAILURE_ID,
      reason: `the gate allowed the promotion (${d.policy_id}) but the store failed: ${problem}`,
    });
  let stored: MemoryItem;
  let ref: StoreRef;
  let outcome: { stale: string } | { committed: MemoryEvent[]; retention: MemoryEvent[] };
  try {
    ref = await adapter.write(toStore);
    stored = { ...toStore, store_ref: ref };
    const written = stored;
    outcome = db.transaction(() => {
      const stale = staleness(db, decided, ownBytes(deps, written));
      if (stale) return { stale };
      // A new version whose lineage names an id an offboarding took out after
      // the decision (verification pass 4 of PR #50, V4-1): its source is
      // checked above; the ancestors it carries over are checked here.
      const ancestor = fresh ? removedAncestor(db, written) : null;
      if (ancestor)
        return {
          stale: `its lineage names item ${ancestor}, which an offboarding took out after the decision`,
        };
      // Only the source and its own lineage may share the new version's ref:
      // the confirming items its lineage also names are not versions (P5-10).
      const problem = refProblem(
        deps,
        fresh ? ({ ...toStore, lineage: [item.id] } as MemoryItem) : toStore,
        ref,
        false,
      );
      if (problem) throw new Error(problem);
      const promoted = appendEvent(db, {
        ...common,
        id: newId(),
        op: "promote",
        decision: "allow",
        item_id: written.id,
        item: written,
      });
      const committed = [promoted];
      if (fresh)
        committed.push(
          appendEvent(db, {
            ...base,
            id: newId(),
            op: "retire",
            item_id: item.id,
            scope_from: item.scope,
            scope_to: toScope,
            decision: "allow",
            reason: `superseded by ${written.id}, its promotion to a ${written.class} item in ${toScope}`,
            policy_id: promotionRuleId(policy, "superseded"),
          }),
        );
      // In the same transaction as the promotion: no other change, on this
      // handle or another, lands in between.
      const retention = enforceBudget(deps, actor, written.scope, written.class, at, written.id);
      return { committed, retention };
    });
  } catch (e) {
    failed(e instanceof Error ? e.message : String(e));
    throw e;
  }
  if ("stale" in outcome) {
    const why = outcome.stale;
    try {
      const stale = { wrote: stored, head: basis.head, actor: actor.id, at };
      const event = await settle(deps, stored.id, ref, stale, (note) =>
        appendEvent(db, {
          ...common,
          id: newId(),
          op: "promote",
          decision: "deny",
          policy_id: PROMOTE_CONFLICT_ID,
          reason: `the gate allowed the promotion (${d.policy_id}) but ${why}, before it was committed; the decision no longer stands, so the promotion is refused and the store is put back as the log has it${note}`,
        }),
      );
      return { decision: "deny", item: null, event, events: [event] };
    } catch (e) {
      failed(
        `the promotion was refused (${PROMOTE_CONFLICT_ID}: ${why}) and the store could not be put back: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
  }
  const { committed, retention } = outcome;
  const [event] = committed as [MemoryEvent, ...MemoryEvent[]];
  // The event is the audit record; the item goes back only to a promoter
  // who can read where it landed (P5-7).
  const visibleItem = readableScope(policy, actor, stored.scope) ? stored : null;
  return { decision: "allow", item: visibleItem, event, events: [...committed, ...retention] };
}
