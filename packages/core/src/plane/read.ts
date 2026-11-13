// The read path (card E2.2, docs/architecture.md "Read path", ADR 0009). The
// plane owns the metadata: candidates are the projected items the reader can
// reach (a readable scope, or a grant whose `to` matches it), narrowed by the
// adapter's search when there is query text (or by term matching in the plane
// when the store has no search). Each candidate goes through the read filter
// (status, ttl, scope and matrix or grants, validity window at the query time); the
// admitted ones are ranked by named score components and explained; one read
// event is appended and the explanations are stored under its id, in the same
// transaction, so `explain(actor, readId)` returns exactly what the read
// returned, to that reader only.
//
// What a read reveals (decision D5): the items, explanations, scores, ranks
// and `filtered` count depend only on what the reader can reach. The store is
// searched only in the scopes the reader is a member of and may read; items
// reached only through a grant are matched by the plane over the projection
// (finding N1 of the second review: a store that caps its hits would let
// hidden items in a granted item's scope crowd it out). Relevance ranks among
// admitted items only, and items out of reach are never candidates. The read
// event, the audit record a harness keeps from the model, also counts them.
//
// A plane built with `retrieval: { pipeline: "core" }` (ADR 0009, proposed
// amendment of 2026-11-02; PR #25 review round 2, R1) does not search the
// store at all: its candidates are the reachable projected items matching
// the query by the core retrieval pipeline (plane/retrieve.ts, any query
// term), the read filter admits some, and the admitted ones are ranked by
// that pipeline and cut to its limit. Without the option the read is as
// above, unchanged.
import { type Actor, ExplainDeniedError, UnknownReadError } from "../actor.ts";
import { appendEvent, currentItems } from "../events.ts";
import type { PlaneDeps, ReadQuery, ReadResult } from "../plane.ts";
import {
  evaluateRead,
  type ReadCheck,
  reachable,
  readableScope,
  readRuleId,
} from "../policy/evaluate.ts";
import { type Explanation, type MemoryItem, SCHEMA_VERSION } from "../schema.ts";
import { formatReadReason } from "./read-reason.ts";
import { matchesQuery, queryTerms, retrieve, scoreComponents } from "./retrieve.ts";
import { checkCall } from "./write.ts";

const contentText = (item: MemoryItem) =>
  (typeof item.content === "string" ? item.content : JSON.stringify(item.content)).toLowerCase();

/** The items containing a query term, each with the share of the terms it contains. */
function termShare(items: MemoryItem[], terms: string[]): Map<string, number> {
  const share = new Map<string, number>();
  for (const item of items) {
    const body = contentText(item);
    const matched = terms.filter((t) => body.includes(t)).length;
    if (matched > 0) share.set(item.id, matched / terms.length);
  }
  return share;
}

/**
 * The candidates matching the query text, in match order, with the share of
 * query terms each contains when the plane matched it itself; undefined when
 * the query has no terms. With store search the store is asked about
 * `scopes` only, the reader's readable member scopes, and orders those hits;
 * an item the reader reaches only through a grant is matched by the plane
 * over the projection, as on a store without search, so items the reader
 * cannot reach never compete with it for a capped hit list (finding N1).
 */
async function matching(
  { adapter }: PlaneDeps,
  reach: MemoryItem[],
  scopes: string[],
  text: string | undefined,
): Promise<{ order: string[]; share: Map<string, number> } | undefined> {
  const query = text ?? "";
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return undefined;
  if (!adapter.search) {
    const share = termShare(reach, terms);
    return { order: [...share.keys()], share };
  }
  const inScope = new Set(reach.filter((i) => scopes.includes(i.scope)).map((i) => i.id));
  const hits = scopes.length === 0 ? [] : await adapter.search(query, scopes);
  const share = termShare(
    reach.filter((i) => !inScope.has(i.id)),
    terms,
  );
  const order = [...new Set(hits.map((i) => i.id).filter((id) => inScope.has(id)))];
  return { order: [...order, ...share.keys()], share };
}

/** Which of `ids` the projection holds now. */
function stillProjected({ db }: PlaneDeps, ids: string[]): Set<string> {
  if (ids.length === 0) return new Set();
  return new Set(
    db
      .prepare(`SELECT id FROM items WHERE id IN (${ids.map(() => "?").join(", ")})`)
      .all(...ids)
      .map((r) => String(r.id)),
  );
}

export async function filteredRead(
  deps: PlaneDeps,
  actor: Actor,
  query: ReadQuery,
): Promise<ReadResult> {
  const { db, policy, newId } = deps;
  checkCall(actor, query?.at, "read");
  const { at } = query;
  const snapshot = currentItems(db);
  const reach = snapshot.filter((i) => reachable(policy, actor, i));
  // The readable scopes the actor belongs to: the store is never asked about
  // any other scope, not even one a grant reaches into (finding N1).
  const scopes = [
    ...new Set(actor.memberships.filter((s) => readableScope(policy, actor, s))),
  ].sort();
  const core = deps.retrieval?.pipeline === "core";
  const terms = queryTerms(query.text);
  const match = core ? undefined : await matching(deps, reach, scopes, query.text);
  const outOfReach = snapshot.length - reach.length;
  const hitRank = new Map(match?.order.map((id, r) => [id, r]));
  const candidates = core
    ? reach.filter((i) => matchesQuery(i, terms))
    : match
      ? reach.filter((i) => hitRank.has(i.id))
      : reach;

  const counts: Record<ReadCheck, number> = {
    scope: 0,
    grant: 0,
    excluded: 0,
    "not-active": 0,
    expired: 0,
    "outside-validity": 0,
  };
  const passed = candidates.flatMap((item) => {
    const decision = evaluateRead(policy, actor, item, at);
    counts[decision.check]++;
    return decision.admitted ? [{ item, decision }] : [];
  });
  // Relevance from the store's order ranks among the admitted store hits only,
  // so hits the reader may not see cannot lower it (finding R5-1); an item the
  // plane matched itself scores its share of the query terms.
  const byHit = passed
    .filter(({ item }) => !match?.share.has(item.id))
    .sort((a, b) => (hitRank.get(a.item.id) ?? 0) - (hitRank.get(b.item.id) ?? 0));
  const relevance = new Map<string, number>(match?.share);
  byHit.forEach(({ item }, r) => {
    relevance.set(item.id, 1 - r / byHit.length);
  });
  const decisionOf = new Map(passed.map(({ item, decision }) => [item.id, decision]));
  const admitted = core
    ? // The core pipeline over what the filter admitted: ranked, then cut.
      retrieve(
        passed.map(({ item }) => item),
        query.text,
        at,
        deps.retrieval?.limit,
      ).map(({ item, components: parts, total }) => ({
        item,
        decision: decisionOf.get(item.id) as ReturnType<typeof evaluateRead>,
        parts,
        total,
      }))
    : passed.map(({ item, decision }) => {
        const parts = scoreComponents(item, at, match ? relevance.get(item.id) : undefined);
        const total = Object.values(parts).reduce((a, b) => a + b, 0);
        return { item, decision, parts, total };
      });
  // Candidates arrive ordered by id and the sort is stable, so ties keep id
  // order; the core pipeline's list is already in its order.
  if (!core) admitted.sort((a, b) => b.total - a.total);

  // Reachable candidates the filter removed: outside the validity window, not
  // active, past their ttl (a lifecycle exclusion before any sweep, ADR
  // 0025), or reached through a grant whose class or expiry fails.
  const filtered =
    counts.excluded + counts["outside-validity"] + counts["not-active"] + counts.expired;
  // Under the core pipeline with a limit, the admitted items ranked below it.
  const limited = core && deps.retrieval?.limit !== undefined;

  // A read does not run in the write queue, and its snapshot of the
  // projection is older than the store search it awaited, so an offboarding,
  // in this process or another sharing the log, may have erased an admitted
  // item since (review of PR #41, cards E2.2 and E9.7). Inside the
  // transaction, which holds the log's write lock (BEGIN IMMEDIATE on SQLite,
  // the advisory lock on Postgres), the admitted ids are selected again and
  // any the projection no longer holds is dropped from the result, the event
  // and the explanation rows, and counted out of the candidates. An erasure
  // commits under the same lock, so none lands between this check and the
  // append: the read never returns or records an item erased before its
  // event. The out-of-reach count stays the snapshot's.
  const { event, kept, explanations } = db.transaction(() => {
    const held = stillProjected(
      deps,
      admitted.map((a) => a.item.id),
    );
    const kept = admitted.filter((a) => held.has(a.item.id));
    const explanations: Explanation[] = kept.map(({ item, decision, parts, total }, i) => ({
      item_id: item.id,
      rank: i + 1,
      score: { total, components: parts },
      policy_id: decision.policy_id,
      grants_used: decision.grants_used,
      validity: { at, valid_from: item.valid_from, valid_to: item.valid_to },
      schema_version: 1 as const,
    }));
    const reason = formatReadReason({
      returned: kept.length,
      candidates: candidates.length - (admitted.length - kept.length),
      filtered,
      outside_validity: counts["outside-validity"],
      not_active: counts["not-active"],
      expired: counts.expired,
      excluded: counts.excluded,
      ...(limited ? { cut: passed.length - admitted.length } : {}),
      out_of_reach: outOfReach,
    });
    const appended = appendEvent(db, {
      id: newId(),
      ts: at,
      op: "read",
      item_id: null,
      actor: actor.id,
      scope_from: null,
      scope_to: null,
      decision: "allow",
      reason,
      policy_id: readRuleId(policy, actor),
      item_ids: kept.map((a) => a.item.id),
      schema_version: SCHEMA_VERSION,
    });
    const insert = db.prepare(
      "INSERT INTO explanations (read_id, rank, item_id, body) VALUES (?, ?, ?, ?)",
    );
    for (const e of explanations) insert.run(appended.id, e.rank, e.item_id, JSON.stringify(e));
    return { event: appended, kept, explanations };
  });
  return { items: kept.map((a) => a.item), explanations, filtered, event };
}

/**
 * The explanations stored for the read event `readId`, in rank order, for
 * the actor who made that read only (decision D5); another actor is refused
 * with ExplainDeniedError.
 */
export function storedExplanations(deps: PlaneDeps, actor: Actor, readId: string): Explanation[] {
  const { db } = deps;
  const row = db.prepare("SELECT op, actor FROM events WHERE id = ?").get(readId);
  if (row?.op !== "read") throw new UnknownReadError(readId);
  if (row.actor !== actor?.id) throw new ExplainDeniedError(readId);
  return db
    .prepare("SELECT body FROM explanations WHERE read_id = ? ORDER BY rank")
    .all(readId)
    .map((r) => JSON.parse(String(r.body)) as Explanation);
}
