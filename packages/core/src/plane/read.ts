// The read path (card E2.2, docs/architecture.md "Read path", ADR 0009). The
// plane owns the metadata: candidates are the projected items the reader can
// reach (a readable scope, or a grant whose `to` matches it), narrowed by the
// adapter's search when there is query text (or by term matching in the plane
// when the store has no search). Each candidate goes through the read filter
// (status, scope and matrix or grants, validity window at the query time); the
// admitted ones are ranked by named score components and explained; one read
// event is appended and the explanations are stored under its id, in the same
// transaction, so `explain(actor, readId)` returns exactly what the read
// returned, to that reader only.
//
// What a read reveals (decision D5): the items, explanations, scores, ranks
// and `filtered` count depend only on what the reader can reach. The store is
// searched in the reachable scopes only, relevance ranks among admitted items
// only, and items out of reach are never candidates. The read event, the
// audit record a harness keeps from the model, also counts them.
import { type Actor, ExplainDeniedError } from "../actor.ts";
import { appendEvent, currentItems } from "../events.ts";
import type { PlaneDeps, ReadQuery, ReadResult } from "../plane.ts";
import {
  evaluateRead,
  type ReadCheck,
  reachable,
  readableScope,
  readRuleId,
} from "../policy/evaluate.ts";
import type { Explanation, MemoryItem } from "../schema.ts";
import { checkCall } from "./write.ts";

const DAY_MS = 86_400_000;
/** Recency halves after this many days. */
const RECENCY_DAYS = 30;

const contentText = (item: MemoryItem) =>
  (typeof item.content === "string" ? item.content : JSON.stringify(item.content)).toLowerCase();

/**
 * The candidates matching the query text, in match order, with the share of
 * query terms each contains when the plane matched them itself; undefined
 * when the query has no terms. With store search the store orders the hits
 * and is asked only about `scopes`; without it, the plane matches terms.
 */
async function matching(
  { adapter }: PlaneDeps,
  reach: MemoryItem[],
  scopes: string[],
  text: string | undefined,
): Promise<{ order: string[]; share?: Map<string, number> } | undefined> {
  const query = text ?? "";
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return undefined;
  if (adapter.search) {
    if (scopes.length === 0) return { order: [] };
    const hits = await adapter.search(query, scopes);
    return { order: [...new Set(hits.map((i) => i.id))] };
  }
  const share = new Map<string, number>();
  for (const item of reach) {
    const body = contentText(item);
    const matched = terms.filter((t) => body.includes(t)).length;
    if (matched > 0) share.set(item.id, matched / terms.length);
  }
  return { order: [...share.keys()], share };
}

function components(item: MemoryItem, at: string, rel: number | undefined) {
  const ageDays = Math.max(0, (Date.parse(at) - Date.parse(item.valid_from)) / DAY_MS);
  const out: Record<string, number> = {};
  if (rel !== undefined) out.relevance = rel;
  out.confidence = item.confidence;
  out.recency = 1 / (1 + ageDays / RECENCY_DAYS);
  return out;
}

export async function filteredRead(
  deps: PlaneDeps,
  actor: Actor,
  query: ReadQuery,
): Promise<ReadResult> {
  const { db, policy, newId } = deps;
  checkCall(actor, query?.at, "read");
  const { at } = query;
  const projected = currentItems(db);
  const reach = projected.filter((i) => reachable(policy, actor, i));
  const outOfReach = projected.length - reach.length;
  // Readable scopes the actor belongs to, and the scopes of items a grant may
  // admit it to; the store is never asked about any other scope.
  const scopes = [
    ...new Set([
      ...actor.memberships.filter((s) => readableScope(policy, actor, s)),
      ...reach.map((i) => i.scope),
    ]),
  ].sort();
  const match = await matching(deps, reach, scopes, query.text);
  const hitRank = new Map(match?.order.map((id, r) => [id, r]));
  const candidates = match ? reach.filter((i) => hitRank.has(i.id)) : reach;

  const counts: Record<ReadCheck, number> = {
    scope: 0,
    grant: 0,
    excluded: 0,
    "not-active": 0,
    "outside-validity": 0,
  };
  const passed = candidates.flatMap((item) => {
    const decision = evaluateRead(policy, actor, item, at);
    counts[decision.check]++;
    return decision.admitted ? [{ item, decision }] : [];
  });
  // Relevance from the store's order ranks among the admitted hits only, so
  // hits the reader may not see cannot lower it (finding R5-1).
  const byHit = [...passed].sort(
    (a, b) => (hitRank.get(a.item.id) ?? 0) - (hitRank.get(b.item.id) ?? 0),
  );
  const relevance = new Map<string, number>();
  byHit.forEach(({ item }, r) => {
    relevance.set(item.id, match?.share?.get(item.id) ?? 1 - r / byHit.length);
  });
  const admitted = passed.map(({ item, decision }) => {
    const parts = components(item, at, match ? relevance.get(item.id) : undefined);
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return { item, decision, parts, total };
  });
  // Candidates arrive ordered by id and the sort is stable, so ties keep id order.
  admitted.sort((a, b) => b.total - a.total);

  const explanations: Explanation[] = admitted.map(({ item, decision, parts, total }, i) => ({
    item_id: item.id,
    rank: i + 1,
    score: { total, components: parts },
    policy_id: decision.policy_id,
    grants_used: decision.grants_used,
    validity: { at, valid_from: item.valid_from, valid_to: item.valid_to },
    schema_version: 0 as const,
  }));
  // Reachable candidates the filter removed: outside the validity window, not
  // active, or reached through a grant whose class or expiry fails.
  const filtered = counts.excluded + counts["outside-validity"] + counts["not-active"];
  const reason =
    `returned ${admitted.length} of ${candidates.length} candidates; ${filtered} filtered ` +
    `(${counts["outside-validity"]} outside the validity window, ${counts["not-active"]} not active, ` +
    `${counts.excluded} by a grant's class or expiry); ` +
    `${outOfReach} projected ${outOfReach === 1 ? "item" : "items"} outside the reader's reach ` +
    "were not candidates";

  const event = db.transaction(() => {
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
      schema_version: 0 as const,
    });
    const insert = db.prepare(
      "INSERT INTO explanations (read_id, rank, item_id, body) VALUES (?, ?, ?, ?)",
    );
    for (const e of explanations) insert.run(appended.id, e.rank, e.item_id, JSON.stringify(e));
    return appended;
  });
  return { items: admitted.map((a) => a.item), explanations, filtered, event };
}

/**
 * The explanations stored for the read event `readId`, in rank order, for
 * the actor who made that read only (decision D5); another actor is refused
 * with ExplainDeniedError.
 */
export function storedExplanations(deps: PlaneDeps, actor: Actor, readId: string): Explanation[] {
  const { db } = deps;
  const row = db.prepare("SELECT op, actor FROM events WHERE id = ?").get(readId);
  if (row?.op !== "read") throw new Error(`explain: ${readId} names no read event`);
  if (row.actor !== actor?.id) throw new ExplainDeniedError(readId);
  return db
    .prepare("SELECT body FROM explanations WHERE read_id = ? ORDER BY rank")
    .all(readId)
    .map((r) => JSON.parse(String(r.body)) as Explanation);
}
