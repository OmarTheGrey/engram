// The read path (card E2.2, docs/architecture.md "Read path", ADR 0009). The
// plane owns the metadata: candidates are the projected items, narrowed by the
// adapter's search when there is query text (or by term matching in the plane
// when the store has no search). Each candidate goes through the read filter
// (status, scope and matrix or grants, validity window at the query time); the
// admitted ones are ranked by named score components and explained; one read
// event is appended and the explanations are stored under its id, in the same
// transaction, so `explain(readId)` returns exactly what the read returned.
import { appendEvent, currentItems } from "../events.ts";
import type { Actor, PlaneDeps, ReadQuery, ReadResult } from "../plane.ts";
import { evaluateRead, type ReadCheck } from "../policy/evaluate.ts";
import type { Explanation, MemoryItem } from "../schema.ts";

const DAY_MS = 86_400_000;
/** Recency halves after this many days. */
const RECENCY_DAYS = 30;

const contentText = (item: MemoryItem) =>
  (typeof item.content === "string" ? item.content : JSON.stringify(item.content)).toLowerCase();

/**
 * Relevance in (0, 1] for each item the query matches, by id; undefined when
 * the query has no terms. With store search, relevance falls with the store's
 * rank (1 for the first hit); without it, it is the share of query terms the
 * content contains.
 */
async function relevance(
  { adapter }: PlaneDeps,
  projected: MemoryItem[],
  text: string | undefined,
): Promise<Map<string, number> | undefined> {
  const query = text ?? "";
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return undefined;
  const scores = new Map<string, number>();
  if (adapter.search) {
    const scopes = [...new Set(projected.map((i) => i.scope))].sort();
    const hits = [...new Set((await adapter.search(query, scopes)).map((i) => i.id))];
    hits.forEach((hit, rank) => {
      scores.set(hit, 1 - rank / hits.length);
    });
    return scores;
  }
  for (const item of projected) {
    const body = contentText(item);
    const matched = terms.filter((t) => body.includes(t)).length;
    if (matched > 0) scores.set(item.id, matched / terms.length);
  }
  return scores;
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
  const { at } = query;
  const projected = currentItems(db);
  const rel = await relevance(deps, projected, query.text);
  const candidates = rel ? projected.filter((i) => rel.has(i.id)) : projected;

  const counts: Record<ReadCheck, number> = {
    scope: 0,
    grant: 0,
    excluded: 0,
    "not-active": 0,
    "outside-validity": 0,
  };
  const admitted = candidates.flatMap((item) => {
    const decision = evaluateRead(policy, actor, item, at);
    counts[decision.check]++;
    if (!decision.admitted) return [];
    const parts = components(item, at, rel?.get(item.id));
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return [{ item, decision, parts, total }];
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
  // The policy filter's removals; items that are not active are not live memory
  // and are reported apart.
  const filtered = counts.excluded + counts["outside-validity"];
  const live = candidates.length - counts["not-active"];
  const reason =
    `returned ${admitted.length} of ${live} candidates; ${filtered} filtered ` +
    `(${counts.excluded} by scope or grant, ${counts["outside-validity"]} outside the validity window); ` +
    `${counts["not-active"]} not active`;

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
      policy_id: `${policy.id}/read/${actor.level}`,
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

/** The explanations stored for the read event `readId`, in rank order. */
export function storedExplanations(deps: PlaneDeps, readId: string): Explanation[] {
  const { db } = deps;
  const row = db.prepare("SELECT op FROM events WHERE id = ?").get(readId);
  if (row?.op !== "read") throw new Error(`explain: ${readId} names no read event`);
  return db
    .prepare("SELECT body FROM explanations WHERE read_id = ? ORDER BY rank")
    .all(readId)
    .map((r) => JSON.parse(String(r.body)) as Explanation);
}
