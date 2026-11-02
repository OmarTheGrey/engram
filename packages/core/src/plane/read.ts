// The read path (card E2.2, docs/architecture.md "Read path", ADR 0009). The
// plane owns the metadata: candidates are the projected items the reader can
// reach (a readable scope, or a grant whose `to` matches it), narrowed by the
// adapter's search when there is query text (or, for items the store is not
// searched for, by the plane's own match: every query term). Each candidate
// goes through the read filter (status, ttl, scope and matrix or grants,
// validity window at the query time); the admitted ones are ranked by named
// score components, each item scored on its own (rankForRead), and explained; one read
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
import type { Explanation, MemoryItem } from "../schema.ts";
import { formatReadReason } from "./read-reason.ts";
import { checkCall } from "./write.ts";

const DAY_MS = 86_400_000;
/** Recency halves after this many days. */
const RECENCY_DAYS = 30;

const contentText = (item: MemoryItem) =>
  (typeof item.content === "string" ? item.content : JSON.stringify(item.content)).toLowerCase();

/** The query's terms: lower-cased, split on whitespace. */
const termsOf = (text: string | undefined) =>
  (text ?? "").toLowerCase().split(/\s+/).filter(Boolean);

/** The share of the query terms an item's content contains. */
const shareOf = (item: MemoryItem, terms: readonly string[]) => {
  const body = contentText(item);
  return terms.filter((t) => body.includes(t)).length / terms.length;
};

/**
 * The ids of the candidates matching the query text; undefined when the query
 * has no terms. With store search the store is asked about `scopes` only, the
 * reader's readable member scopes, and its hits are the matches there; an
 * item the reader reaches only through a grant is matched by the plane over
 * the projection, as on a store without search, so items the reader cannot
 * reach never compete with it for a capped hit list (finding N1). The plane
 * matches an item that holds every query term, the rule a lexical store's
 * search applies (fake, files, Letta), so a grant never makes the plane find
 * an item the store's own search would not (PR #25 review, P3-1).
 */
async function matching(
  { adapter }: PlaneDeps,
  reach: MemoryItem[],
  scopes: string[],
  text: string | undefined,
): Promise<Set<string> | undefined> {
  const terms = termsOf(text);
  if (terms.length === 0) return undefined;
  const holdsEvery = (i: MemoryItem) => shareOf(i, terms) === 1;
  if (!adapter.search) return new Set(reach.filter(holdsEvery).map((i) => i.id));
  const inScope = new Set(reach.filter((i) => scopes.includes(i.scope)).map((i) => i.id));
  const hits = scopes.length === 0 ? [] : await adapter.search(text ?? "", scopes);
  return new Set([
    ...hits.map((i) => i.id).filter((id) => inScope.has(id)),
    ...reach.filter((i) => !inScope.has(i.id) && holdsEvery(i)).map((i) => i.id),
  ]);
}

/** One item's score for a read, by named component. */
export interface RankedItem {
  item: MemoryItem;
  components: Record<string, number>;
  total: number;
}

/**
 * The order of a read: each item scored on its own, by its share of the
 * query terms (`relevance`, only when the query has terms), its confidence
 * and its recency at the read time; highest total first, ties by item id. An
 * item's score depends on no other item, so a set and any subset of it are
 * ordered alike. The plane ranks what it admits with it, and a reader that
 * reaches the store without the plane (the runner's ungoverned conditions)
 * orders what the store returns with it too: one ordering rule (PR #25
 * review, P3-11; ADR 0009).
 */
export function rankForRead(
  items: readonly MemoryItem[],
  text: string | undefined,
  at: string,
): RankedItem[] {
  const terms = termsOf(text);
  return items
    .map((item) => {
      const parts = components(item, at, terms.length > 0 ? shareOf(item, terms) : undefined);
      return { item, components: parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
    })
    .sort(
      (a, b) => b.total - a.total || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0),
    );
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
  // The readable scopes the actor belongs to: the store is never asked about
  // any other scope, not even one a grant reaches into (finding N1).
  const scopes = [
    ...new Set(actor.memberships.filter((s) => readableScope(policy, actor, s))),
  ].sort();
  const match = await matching(deps, reach, scopes, query.text);
  const candidates = match ? reach.filter((i) => match.has(i.id)) : reach;

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
  // Each admitted item is scored on its own (rankForRead): relevance is its
  // share of the query terms, so neither hits the reader may not see (finding
  // R5-1) nor any other item can move it (PR #25 review, P3-11).
  const decisionOf = new Map(passed.map(({ item, decision }) => [item.id, decision]));
  const admitted = rankForRead(
    passed.map(({ item }) => item),
    query.text,
    at,
  ).map(({ item, components: parts, total }) => ({
    item,
    decision: decisionOf.get(item.id) as ReturnType<typeof evaluateRead>,
    parts,
    total,
  }));

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
  // active, past their ttl (a lifecycle exclusion before any sweep, ADR
  // 0025), or reached through a grant whose class or expiry fails.
  const filtered =
    counts.excluded + counts["outside-validity"] + counts["not-active"] + counts.expired;
  const reason = formatReadReason({
    returned: admitted.length,
    candidates: candidates.length,
    filtered,
    outside_validity: counts["outside-validity"],
    not_active: counts["not-active"],
    expired: counts.expired,
    excluded: counts.excluded,
    out_of_reach: outOfReach,
  });

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
  if (row?.op !== "read") throw new UnknownReadError(readId);
  if (row.actor !== actor?.id) throw new ExplainDeniedError(readId);
  return db
    .prepare("SELECT body FROM explanations WHERE read_id = ? ORDER BY rank")
    .all(readId)
    .map((r) => JSON.parse(String(r.body)) as Explanation);
}
