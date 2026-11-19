// Grant changes on the plane (card E9.4, ADR 0034, proposed). The pure gate
// (policy/grants.ts) decides; this file checks the call, then decides and
// commits in one slot of the write queue, so a change is judged against the
// projection the previous change left.
//
// Every decision is one `update` event with its reason and policy id
// (AGENTS.md rule 3). On allow, the item becomes a new version in place, as
// a promotion's status change or an offboarding's handover does (ADR 0005,
// decision D1): same id, version plus one, the new grants, rewritten to the
// store through the adapter, and the event carries the stored item, so
// replay rebuilds it. Content, provenance, validity and status are untouched.
// A store failure after the gate allowed is one deny event under
// engram/write/store-failure; a transient failure is rethrown, as a write's
// is (decision D6), while a store that refuses for good to rewrite the record
// (NotDeletableError, such as a Claude Code memory file the files adapter
// holds read-only) is a deny decision returned to the caller, since no retry
// would succeed. A grant change runs no budget check: it changes no count.
//
// The write queue orders calls over one db handle only; another handle on
// the same log (another process) may erase or change the item while the store
// write is in flight (review finding C1 of PR #44), and an offboarding may be
// erasing its person scope. So a change into a person scope an offboarding is
// erasing is refused at once (engram/offboard/erasing), and the event is
// committed in one transaction, which holds the log's write lock, after the
// decision is checked there (card E2.6, plane/commit.ts): if anything changed
// the item, or an offboarding began erasing its scope, since the decision,
// the decision is stale. The store is then put back as the log has it (the
// rewritten record deleted when the item is gone or being erased, the
// projected item written back otherwise), and one deny event under
// engram/grant/conflict is appended once it is.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { isNotDeletable } from "../adapter.ts";
import { appendEvent } from "../events.ts";
import { itemById } from "../items.ts";
import type { GrantResult, PlaneDeps } from "../plane.ts";
import { readableScope, STORE_FAILURE_ID } from "../policy/evaluate.ts";
import { evaluateGrantChange, GRANT_CONFLICT_ID, type GrantChange } from "../policy/grants.ts";
import { Grant, Id, type MemoryItem, SCHEMA_VERSION } from "../schema.ts";
import {
  basisNow,
  ERASING_ID,
  erasingReason,
  erasureOpen,
  ownBytes,
  settle,
  staleness,
} from "./commit.ts";
import { inWriteQueue } from "./queue.ts";
import { refProblem } from "./write.ts";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The change, checked: two lists of well-formed grants, not both empty. */
function checkChange(change: unknown): GrantChange {
  const bad = (what: string) => new InvalidCallError(`Plane.changeGrants: ${what}`);
  if (typeof change !== "object" || change === null) throw bad("the change is not an object");
  const out: GrantChange = {};
  for (const key of ["add", "remove"] as const) {
    const list = (change as Record<string, unknown>)[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) throw bad(`${key} is not a list`);
    out[key] = list.map((g, i) => {
      const parsed = Grant.safeParse(g);
      if (!parsed.success)
        throw bad(
          `${key}[${i}] is not a grant: ${parsed.error.issues.map((x) => `${x.path.join(".") || "grant"}: ${x.message}`).join("; ")}`,
        );
      return parsed.data;
    });
  }
  if ((out.add?.length ?? 0) + (out.remove?.length ?? 0) === 0)
    throw bad("the change adds and removes nothing");
  return out;
}

async function decideAndCommit(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  change: GrantChange,
  at: string,
): Promise<GrantResult> {
  const { db, adapter, newId, policy } = deps;
  // The head before the projection is read (commit.ts).
  const basis = basisNow(db, [itemId], []);
  const item = itemById(db, itemId);
  const d = evaluateGrantChange(policy, actor, itemId, item, change, at);
  const scope = d.visible && item ? item.scope : null;
  const common = {
    ts: at,
    op: "update" as const,
    actor: actor.id,
    item_id: itemId,
    scope_from: scope,
    scope_to: scope,
    schema_version: SCHEMA_VERSION as typeof SCHEMA_VERSION,
  };
  const refuse = (reason: string, policy_id: string): GrantResult => ({
    decision: "deny",
    item: null,
    event: appendEvent(db, { ...common, id: newId(), decision: "deny", reason, policy_id }),
  });
  if (d.decision === "deny" || d.grants === null || !item) return refuse(d.reason, d.policy_id);
  // Only a member who may read the item gets here, so the reason may name its scope.
  if (erasureOpen(db, item.scope)) return refuse(erasingReason(item.scope), ERASING_ID);
  const decided = { ...basis, scopes: [item.scope] };

  const next = {
    ...item,
    grants: d.grants,
    version: item.version + 1,
    store_ref: null,
  } as MemoryItem;
  let stored: MemoryItem;
  try {
    const store_ref = await adapter.write(next);
    const problem = refProblem(deps, next, store_ref, false);
    if (problem) throw new Error(problem);
    stored = { ...next, store_ref };
  } catch (e) {
    const failed = refuse(
      `the gate allowed the grant change (${d.policy_id}) but the store ${adapter.name} ${isNotDeletable(e) ? "refuses to rewrite the record" : "failed"}: ${errorText(e)}; the grants are unchanged`,
      STORE_FAILURE_ID,
    );
    if (isNotDeletable(e)) return failed;
    throw e;
  }
  const ref = stored.store_ref as NonNullable<MemoryItem["store_ref"]>;
  const committed = db.transaction(() => {
    const stale = staleness(db, decided, ownBytes(deps, stored));
    if (stale) return { stale };
    return {
      event: appendEvent(db, {
        ...common,
        id: newId(),
        decision: "allow",
        reason: d.reason,
        policy_id: d.policy_id,
        item: stored,
      }),
    };
  });
  if ("stale" in committed) {
    const why = `${committed.stale}, while the grant change was being stored; the decision was made on a version that no longer stands, so the change is refused and the store is put back as the log has it`;
    try {
      const staleWrite = { wrote: stored, head: basis.head, actor: actor.id, at };
      const event = await settle(deps, itemId, ref, staleWrite, () =>
        appendEvent(db, {
          ...common,
          id: newId(),
          decision: "deny",
          reason: why,
          policy_id: GRANT_CONFLICT_ID,
        }),
      );
      return { decision: "deny", item: null, event };
    } catch (e) {
      refuse(
        `after the grant change's conflict (${GRANT_CONFLICT_ID}: ${committed.stale}) the store ${adapter.name} could not be put back: ${errorText(e)}`,
        STORE_FAILURE_ID,
      );
      throw e;
    }
  }
  const { event } = committed;
  // The owner is a member of the scope; the item goes back only if the read
  // matrix also lets its level read the scope, as for a promotion (P5-7).
  return {
    decision: "allow",
    item: readableScope(policy, actor, stored.scope) ? stored : null,
    event,
  };
}

/**
 * Plane.changeGrants. The call is checked (actor, time, item id and the
 * change) before the log is touched; then the decide-and-commit runs in one
 * slot of the write queue.
 */
export function changeGrants(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  change: GrantChange,
  at: string,
): Promise<GrantResult> {
  checkCall(actor, at, "changeGrants");
  if (!Id.safeParse(itemId).success)
    throw new InvalidCallError(
      `Plane.changeGrants: invalid item id ${JSON.stringify(itemId)}; expected a UUIDv7`,
    );
  const checked = checkChange(change);
  return inWriteQueue(deps.db, () => decideAndCommit(deps, actor, itemId, checked, at));
}
