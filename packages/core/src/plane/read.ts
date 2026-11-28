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
//
// A read of one item by its id (Plane.readById, card E8.14) is the same read
// with one candidate at most: the projected item under that id, if the
// reader can reach it. The store is never searched and the core pipeline
// never runs; the read filter, the explanation, the read event and its
// explanation rows are the ones above, and the event's reason names the id
// asked for (`; read by id <id>`). An id out of the reader's reach answers
// exactly as an id the log never held (decision D5). So does an item reached
// only through a grant the read filter does not admit (a grant for another
// class, an expired grant, or an item not active, past its ttl or outside its
// validity window): a by-id read drops it before counting, where a read with
// text would count it as filtered (review finding E8.14-1, the lead's
// decision; ADR 0047, proposed). An item in a scope the reader may read is
// counted as any read counts it, since the reader may read that scope.
import { type Actor, ExplainDeniedError, InvalidCallError, UnknownReadError } from "../actor.ts";
import { strictContentHash } from "../content-hash.ts";
import { appendEvent, currentItems } from "../events.ts";
import type { PlaneDeps, ReadQuery, ReadResult } from "../plane.ts";
import {
  evaluateRead,
  type ReadCheck,
  reachable,
  readableScope,
  readRuleId,
} from "../policy/evaluate.ts";
import { type Explanation, Id, type MemoryItem, SCHEMA_VERSION } from "../schema.ts";
import { compareTimestamps } from "../time.ts";
import { disclosedGrantsUsed, disclosedItem } from "../visible.ts";
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
export async function matching(
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
  // A hit whose store record no longer holds the projected content (an edit
  // adoption denied while the plane kept the version it approved; review fix
  // pass 2 of PR #58, N-1) matched text the plane never admitted: that item
  // is matched by the plane over its own content instead.
  const held = new Map(reach.map((i) => [i.id, strictContentHash(i.content)]));
  const diverged = new Set(
    hits
      .filter((h) => inScope.has(h.id) && held.get(h.id) !== strictContentHash(h.content))
      .map((h) => h.id),
  );
  const share = termShare(
    reach.filter((i) => !inScope.has(i.id) || diverged.has(i.id)),
    terms,
  );
  const order = [
    ...new Set(hits.map((i) => i.id).filter((id) => inScope.has(id) && !diverged.has(id))),
  ];
  return { order: [...order, ...share.keys()], share };
}

/**
 * The match restated against the projection read under the lock: a store
 * hit or a term share computed on the snapshot stands only for an item whose
 * content is unchanged since; an item whose content changed, or that is new,
 * is matched by the plane over its current content. A record erased and
 * adopted again under the same id therefore never matches by its erased text.
 */
function current(
  searched: { order: string[]; share: Map<string, number> } | undefined,
  snapshot: MemoryItem[],
  live: MemoryItem[],
  text: string | undefined,
): { order: string[]; share: Map<string, number> } | undefined {
  if (!searched) return undefined;
  const before = new Map(snapshot.map((i) => [i.id, strictContentHash(i.content)]));
  const changed = live.filter((i) => before.get(i.id) !== strictContentHash(i.content));
  const stale = new Set(changed.map((i) => i.id));
  const terms = (text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const share = new Map([...searched.share].filter(([id]) => !stale.has(id)));
  for (const [id, s] of termShare(changed, terms)) share.set(id, s);
  // The store's hits first, in its order, then every item the plane matched.
  const hits = searched.order.filter((id) => !searched.share.has(id) && !stale.has(id));
  return { order: [...hits, ...share.keys()], share };
}

/**
 * Plane.readById (card E8.14): the read below restricted to the projected
 * item under `itemId`, with no query text. A malformed id is refused with
 * InvalidCallError before the log is touched, as a malformed actor or time is.
 */
export async function readOne(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  query: Omit<ReadQuery, "text">,
): Promise<ReadResult> {
  checkCall(actor, query?.at, "readById");
  if (!Id.safeParse(itemId).success)
    throw new InvalidCallError(
      `Plane.readById: invalid item id ${JSON.stringify(itemId)}; expected a UUIDv7`,
    );
  return filteredRead(deps, actor, { at: query.at, valid_at: query.valid_at }, itemId);
}

/**
 * Whether the item under a by-id read's id is a candidate (E8.14-1): it is in
 * a scope the reader may read, or the read filter admits it through a grant.
 */
function byIdCandidate(
  policy: PlaneDeps["policy"],
  actor: Actor,
  item: MemoryItem,
  at: string,
  validAt: string,
): boolean {
  return (
    readableScope(policy, actor, item.scope) ||
    evaluateRead(policy, actor, item, at, validAt).admitted
  );
}

export async function filteredRead(
  deps: PlaneDeps,
  actor: Actor,
  query: ReadQuery,
  only?: string,
): Promise<ReadResult> {
  const { db, policy, newId } = deps;
  checkCall(actor, query?.at, only === undefined ? "read" : "readById");
  const requested = query.at;
  // The time validity windows are judged at (card RV5, findings RV-SRF-2
  // and RV-CORE-3): the reader's `valid_at` when it names one, else the time
  // it asked to read at. Access (status, ttl, grants), scoring and the
  // event's ts are judged at accessTime below, never before the log's head.
  if (query.valid_at !== undefined)
    checkCall(
      actor,
      query.valid_at,
      only === undefined ? "read (valid_at)" : "readById (valid_at)",
    );
  const validAt = query.valid_at ?? requested;
  const snapshot = currentItems(db);
  const reach = snapshot.filter((i) => reachable(policy, actor, i));
  // The readable scopes the actor belongs to: the store is never asked about
  // any other scope, not even one a grant reaches into (finding N1).
  const scopes = [
    ...new Set(actor.memberships.filter((s) => readableScope(policy, actor, s))),
  ].sort();
  // A by-id read neither searches the store nor runs the core pipeline.
  const core = only === undefined && deps.retrieval?.pipeline === "core";
  const terms = queryTerms(query.text);
  const searched =
    core || only !== undefined ? undefined : await matching(deps, reach, scopes, query.text);
  // Everything from here runs in one synchronous transaction, which holds
  // the log's write lock (BEGIN IMMEDIATE on SQLite, the advisory lock on
  // Postgres). A read is not in the write queue, and its snapshot is older
  // than the store search it awaited, so an offboarding, in this process or
  // another sharing the log, may have erased items since (reviews of PR #41,
  // cards E2.2 and E9.7), and a store that refused the delete may even have
  // had the record adopted again under the same id with new content. Under
  // the lock the projection is read again, whole, and the read filter,
  // scoring, ranking and the read limit run over that projection, never the
  // snapshot: an erasure and an adoption commit under the same lock, so the
  // result, the event and its explanation rows are those of the read run
  // serially after every write committed before the lock was taken, and no
  // erased content is returned, ranked against, counted or recorded. The
  // store search and the plane's term shares ran on the snapshot's content,
  // so a hit or share counts only for an item whose content is unchanged
  // since; an item whose content changed or that is new is matched by the
  // plane over its current content (final recheck of PR #41).
  const { items, explanations, filtered, event } = db.transaction(() => {
    // Under the log's lock: the head cannot move before this read is appended.
    const at = accessTime(db, requested);
    const projected = currentItems(db);
    const live = projected.filter((i) => reachable(policy, actor, i));
    const outOfReach = projected.length - live.length;
    const match = current(searched, snapshot, live, query.text);
    const hitRank = new Map(match?.order.map((id, r) => [id, r]));
    const candidates =
      only !== undefined
        ? live.filter((i) => i.id === only && byIdCandidate(policy, actor, i, at, validAt))
        : core
          ? live.filter((i) => matchesQuery(i, terms))
          : match
            ? live.filter((i) => hitRank.has(i.id))
            : live;

    const counts: Record<ReadCheck, number> = {
      scope: 0,
      grant: 0,
      excluded: 0,
      "not-active": 0,
      expired: 0,
      "outside-validity": 0,
    };
    const passed = candidates.flatMap((item) => {
      const decision = evaluateRead(policy, actor, item, at, validAt);
      counts[decision.check]++;
      return decision.admitted ? [{ item, decision }] : [];
    });
    // Relevance from the store's order ranks among the admitted store hits
    // only, so hits the reader may not see cannot lower it (finding R5-1); an
    // item the plane matched itself scores its share of the query terms.
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

    // What the reader is shown of each item (card RD1, visible.ts): every
    // grant to its owner and only its own to anyone else, the grants used
    // numbered by the grants shown, and only the lineage ids it may ask for
    // by id (ADR 0047) at this read's times. The log keeps the items whole.
    const byId = new Map(projected.map((i) => [i.id, i]));
    const view = { policy, at, validAt, current: (itemId: string) => byId.get(itemId) };
    const explanations: Explanation[] = admitted.map(({ item, decision, parts, total }, i) => ({
      item_id: item.id,
      rank: i + 1,
      score: { total, components: parts },
      policy_id: decision.policy_id,
      grants_used: disclosedGrantsUsed(policy, actor, item, decision.grants_used),
      validity: { at: validAt, valid_from: item.valid_from, valid_to: item.valid_to },
      schema_version: 1 as const,
    }));
    // Reachable candidates the filter removed: outside the validity window,
    // not active, past their ttl (a lifecycle exclusion before any sweep, ADR
    // 0025), or reached through a grant whose class or expiry fails.
    const filtered =
      counts.excluded + counts["outside-validity"] + counts["not-active"] + counts.expired;
    // Under the core pipeline with a limit, the admitted items ranked below it.
    const limited = core && deps.retrieval?.limit !== undefined;
    const reason = formatReadReason(
      {
        returned: admitted.length,
        candidates: candidates.length,
        filtered,
        outside_validity: counts["outside-validity"],
        not_active: counts["not-active"],
        expired: counts.expired,
        excluded: counts.excluded,
        ...(limited ? { cut: passed.length - admitted.length } : {}),
        out_of_reach: outOfReach,
      },
      compareTimestamps(validAt, at) === 0 ? undefined : validAt,
      only,
    );
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
      item_ids: admitted.map((a) => a.item.id),
      schema_version: SCHEMA_VERSION,
    });
    const insert = db.prepare(
      "INSERT INTO explanations (read_id, rank, item_id, body) VALUES (?, ?, ?, ?)",
    );
    for (const e of explanations) insert.run(appended.id, e.rank, e.item_id, JSON.stringify(e));
    return {
      items: admitted.map((a) => disclosedItem(actor, a.item, view)),
      explanations,
      filtered,
      event: appended,
    };
  });
  return { items, explanations, filtered, event };
}

/**
 * The time an access decision is judged at (card RV5, finding RV-CORE-3;
 * ADR 0005 and ADR 0027, amendments proposed by RV5): `at`, unless the log
 * already holds an event with a later ts, in which case the latest ts the
 * log holds (its head). A grant's expiry or a ttl the log has passed cannot
 * be reopened by naming an earlier time, and no read event's ts is earlier
 * than any ts before it. The time a caller names is history at most, which a
 * read takes as its `valid_at`.
 *
 * The head is the highest ts, compared as instants, not the ts of the
 * highest seq (review fix pass of PR #59, RV5-2): an event appended with an
 * earlier ts, a write at a backdated clock say, does not move it back.
 */
export function accessTime(db: PlaneDeps["db"], at: string): string {
  const head = logHead(db);
  return head !== undefined && compareTimestamps(head, at) > 0 ? head : at;
}

/** What a handle has seen of its log: the last event read and the highest ts so far. */
interface HeadMark {
  seq: number;
  id: string;
  max: string | undefined;
}
const heads = new WeakMap<PlaneDeps["db"], HeadMark>();

/**
 * The highest ts in the log, or undefined for an empty log. The events table
 * has no ts column (a schema change, AGENTS.md rule 5), so each handle keeps
 * a high-water mark and reads only the events appended since, on SQLite and
 * Postgres alike. Events are only ever appended and their ts never
 * rewritten (an erasure redacts content, not ts); a mark whose last event is
 * gone (a rolled-back append) is dropped and the log read again from the
 * start, so the mark never holds a ts the log does not.
 */
export function logHead(db: PlaneDeps["db"]): string | undefined {
  let mark = heads.get(db);
  if (mark !== undefined) {
    const last = db.prepare("SELECT id FROM events WHERE seq = ?").get(mark.seq);
    if (last === undefined || String(last.id) !== mark.id) mark = undefined;
  }
  let { seq, id, max } = mark ?? { seq: -1, id: "", max: undefined };
  const rows = db.prepare("SELECT seq, id, body FROM events WHERE seq > ? ORDER BY seq").all(seq);
  for (const row of rows) {
    const ts = (JSON.parse(String(row.body)) as { ts?: unknown }).ts;
    if (typeof ts === "string" && (max === undefined || compareTimestamps(ts, max) > 0)) max = ts;
    seq = Number(row.seq);
    id = String(row.id);
  }
  if (seq >= 0) heads.set(db, { seq, id, max });
  return max;
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
