// What the model-based lints of card L3 would judge in a fault state, with no
// model called: which pairs the contradiction lint sends and which claims the
// unsupported-claim lint sends. A fault the model tier is expected to find
// must be in one of them, or its recall is zero by construction.
//
// These rules mirror `contradictionPairs` and `unsupportedClaimUnits` of
// packages/core/src/lint/model.ts on branch `l3-model-lints` (card L3, not yet
// on main), so the set can be checked before L3 merges; once it does, this
// file is replaced by those exports (follow-up for card L4). The rules:
//
//   contradiction      active semantic items of one scope, held at the lint
//                      time (begun, not past valid_to or ttl), each paired with
//                      its CONTRADICTION_NEIGHBOURS nearest others by the
//                      Jaccard share of their terms (lower-cased runs of
//                      letters and digits), share above zero, exact duplicates
//                      (strict hash) skipped, ties by id; a pair is (earlier,
//                      later) by id, and a "contradiction" verdict flags the later.
//   unsupported-claim  an active episodic or semantic item whose provenance ref
//                      names another item the actor can reach, active, whose
//                      content still has the strict hash the claim recorded.
import {
  appendEvent,
  compareTimestamps,
  currentItems,
  expiredValidity,
  type MemoryItem,
  migrate,
  openSqlite,
  type Policy,
  readableAt,
  refItemId,
  strictContentHash,
} from "@engram/core";
import type { FaultState } from "./generate.ts";

/** L3's CONTRADICTION_NEIGHBOURS. */
export const CONTRADICTION_NEIGHBOURS = 5;

/** The projected items of a state after its whole log, by id. */
export function stateItems(state: FaultState): Map<string, MemoryItem> {
  const db = openSqlite(":memory:");
  try {
    migrate(db);
    for (const { seq: _seq, ...e } of state.events) appendEvent(db, e);
    return new Map(currentItems(db).map((i) => [i.id, i]));
  } finally {
    db.close();
  }
}

const byId = (a: MemoryItem, b: MemoryItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** L3's terms: the text lower-cased, split into runs of letters and digits. */
export const terms = (item: MemoryItem): Set<string> =>
  new Set(
    (typeof item.content === "string" ? item.content : JSON.stringify(item.content))
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** The model tier's units in one state: pairs as `<earlier id>+<later id>`, and claim ids. */
export interface ModelReach {
  pairs: Set<string>;
  claims: Set<string>;
}

export function modelReach(
  state: FaultState,
  policy: Policy,
  items = stateItems(state),
): ModelReach {
  const ctx = { policy, at: state.at };
  const held = (i: MemoryItem) =>
    compareTimestamps(i.valid_from, state.at) <= 0 &&
    expiredValidity(i, { ...ctx, items, retiredBy: new Map(), canReach: () => true }) === null;
  const pairs = new Set<string>();
  const claims = new Set<string>();
  for (const scope of state.scopes) {
    const pool = [...items.values()]
      .filter(
        (i) => i.scope === scope && i.status === "active" && i.class === "semantic" && held(i),
      )
      .sort(byId);
    const t = new Map(pool.map((i) => [i.id, terms(i)]));
    const h = new Map(pool.map((i) => [i.id, strictContentHash(i.content)]));
    for (const i of pool) {
      const near = pool
        .filter((j) => j.id !== i.id && h.get(j.id) !== h.get(i.id))
        .map((j) => ({ j, share: jaccard(t.get(i.id) as Set<string>, t.get(j.id) as Set<string>) }))
        .filter((x) => x.share > 0)
        .sort((x, y) => y.share - x.share || byId(x.j, y.j))
        .slice(0, CONTRADICTION_NEIGHBOURS);
      for (const { j } of near) pairs.add(i.id < j.id ? `${i.id}+${j.id}` : `${j.id}+${i.id}`);
    }
    for (const claim of items.values()) {
      if (claim.scope !== scope || claim.status !== "active" || claim.class === "procedural")
        continue;
      const id = refItemId(claim.provenance.ref);
      const source = id === null ? undefined : items.get(id);
      if (source === undefined || source.id === claim.id || source.status !== "active") continue;
      if (!readableAt(policy, state.actor, source, state.at)) continue;
      if (strictContentHash(source.content) !== claim.provenance.hash) continue;
      claims.add(claim.id);
    }
  }
  return { pairs, claims };
}
