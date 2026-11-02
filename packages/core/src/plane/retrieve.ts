// The core retrieval pipeline (PR #25 review round 2, R1; ADR 0009, proposed
// amendment of 2026-11-02). One way to turn a query and a set of items into
// the ranked list a reader sees, store-independent and model-free:
//
// 1. terms: the query's whitespace-separated words, lower-cased, each with
//    its leading and trailing punctuation removed (so "disease?" is
//    "disease"); no stopword list. A query with no term asks for every item.
// 2. candidates: the items holding at least one term as a substring of
//    their content (structured content by its JSON text), case-insensitive.
// 3. rank: each item scored on its own by named components, its share of
//    the terms (`relevance`, only when the query has terms), its
//    `confidence` and its `recency` at the read time; highest total first,
//    ties by item id. No item's score depends on another item, so a set and
//    any subset of it are ordered alike.
// 4. cap: the first `limit` items, when a limit is given.
//
// A plane built with `retrieval: { pipeline: "core" }` runs it after its
// admission filter (candidates, then admitted, then ranked, then cut), over
// its own projection: it never searches the store, so ADR 0009's N1 holds
// trivially. The runner's ungoverned conditions run it over what the store
// lists. Without a limit the plane's list is then a subset of theirs in the
// same order; with one it need not be, by design.
import type { MemoryItem } from "../schema.ts";

const DAY_MS = 86_400_000;
/** Recency halves after this many days. */
const RECENCY_DAYS = 30;

const contentText = (item: MemoryItem) =>
  (typeof item.content === "string" ? item.content : JSON.stringify(item.content)).toLowerCase();

const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** The pipeline's terms of a query: words, lower-cased, edge punctuation removed, empty ones dropped. */
export function queryTerms(text: string | undefined): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(EDGE_PUNCTUATION, ""))
    .filter(Boolean);
}

/** The share of `terms` the item's content holds; 0 for no terms. */
export function termShareOf(item: MemoryItem, terms: readonly string[]): number {
  if (terms.length === 0) return 0;
  const body = contentText(item);
  return terms.filter((t) => body.includes(t)).length / terms.length;
}

/** The score components of an item for a read: relevance (when given), confidence, recency at `at`. */
export function scoreComponents(
  item: MemoryItem,
  at: string,
  relevance: number | undefined,
): Record<string, number> {
  const ageDays = Math.max(0, (Date.parse(at) - Date.parse(item.valid_from)) / DAY_MS);
  const out: Record<string, number> = {};
  if (relevance !== undefined) out.relevance = relevance;
  out.confidence = item.confidence;
  out.recency = 1 / (1 + ageDays / RECENCY_DAYS);
  return out;
}

/** One item's score for a read, by named component. */
export interface RankedItem {
  item: MemoryItem;
  components: Record<string, number>;
  total: number;
}

/** Step 3: each item scored on its own; highest total first, ties by item id. */
export function rankForRead(
  items: readonly MemoryItem[],
  text: string | undefined,
  at: string,
): RankedItem[] {
  const terms = queryTerms(text);
  return items
    .map((item) => {
      const components = scoreComponents(
        item,
        at,
        terms.length > 0 ? termShareOf(item, terms) : undefined,
      );
      return { item, components, total: Object.values(components).reduce((a, b) => a + b, 0) };
    })
    .sort(
      (a, b) => b.total - a.total || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0),
    );
}

/** Step 2: whether an item is a candidate for the query's terms (every item when there are none). */
export const matchesQuery = (item: MemoryItem, terms: readonly string[]): boolean =>
  terms.length === 0 || termShareOf(item, terms) > 0;

/** The whole pipeline: candidates, ranked, cut to `limit` when given. */
export function retrieve(
  items: readonly MemoryItem[],
  text: string | undefined,
  at: string,
  limit?: number,
): RankedItem[] {
  const terms = queryTerms(text);
  const ranked = rankForRead(
    items.filter((i) => matchesQuery(i, terms)),
    text,
    at,
  );
  return limit === undefined ? ranked : ranked.slice(0, limit);
}

/** An item of a walk down the ranking, with the verdict it was walked past with. */
export interface WalkedItem extends RankedItem {
  admitted: boolean;
}

/**
 * The pipeline's ranking over every candidate (`retrieve` with no limit),
 * walked from the top until it has passed as many admitted items as the
 * pipeline over the admitted items alone returns (`limit`, or every admitted
 * candidate when fewer): every item walked past, admitted or not, in rank
 * order, each with its verdict. Since each item is scored on its own, the
 * walk's admitted items are exactly `retrieve(admitted, text, at, limit)` in
 * its order, and every item not admitted ranks above the last admitted one.
 * This is the runner's C4 read (PR #25 review round 3, V-2): the list C5
 * returns, with the items C5's filter removed shown beside it. `admitted`
 * is the caller's verdict; for C4 it is core's evaluateRead.
 */
export function walkToAdmitted(
  items: readonly MemoryItem[],
  text: string | undefined,
  at: string,
  limit: number | undefined,
  admitted: (item: MemoryItem) => boolean,
): WalkedItem[] {
  const ranked = retrieve(items, text, at).map((r) => ({ ...r, admitted: admitted(r.item) }));
  const available = ranked.filter((r) => r.admitted).length;
  const wanted = limit === undefined ? available : Math.min(limit, available);
  if (wanted <= 0) return [];
  let passed = 0;
  const last = ranked.findIndex((r) => r.admitted && ++passed === wanted);
  return ranked.slice(0, last + 1);
}
