// The item metadata store (card E1.2): the plane-owned view of each item,
// read from the projection that events.ts maintains. It is keyed by id and
// indexed by store_ref (migration 2), and versions are linked by lineage: each
// version is a new item id listing the ids of the versions it supersedes,
// nearest first. Several versions may live under one store_ref and a retired
// item keeps its ref, so a ref can have several holders (decision D1 of the
// review fix pass). Rewriting an item id is an in-place update of that
// version; the write gate (card E2.3) requires its version not to decrease.
// Nothing here writes; every change is an event.
import type { StoreRef } from "./adapter.ts";
import type { Db, Row } from "./db/db.ts";
import type { MemoryItem } from "./schema.ts";

const parse = (row: Row | undefined) =>
  row ? (JSON.parse(String(row.body)) as MemoryItem) : undefined;

export function itemById(db: Db, id: string): MemoryItem | undefined {
  return parse(db.prepare("SELECT body FROM items WHERE id = ?").get(id));
}

/**
 * The item holding `ref`: the latest active holder (highest seq among the
 * holders not retired, an item's seq being that of the event that last
 * changed it), else the latest holder whatever its status, else undefined.
 * Rewriting an item id in place makes it the latest holder again.
 */
export function itemByStoreRef(db: Db, ref: StoreRef): MemoryItem | undefined {
  return parse(
    db
      .prepare(
        `SELECT body FROM items WHERE store_adapter = ? AND store_key = ?
         ORDER BY status = 'retired', seq DESC LIMIT 1`,
      )
      .get(ref.adapter, ref.key),
  );
}

export interface LineageWalk {
  /** Every reachable ancestor, nearest first, each once, in its current projected state. */
  ancestors: MemoryItem[];
  /** Ancestor ids named in a lineage but absent from the projection, in the order met. */
  missing: string[];
}

/**
 * Walks an item's lineage breadth first: its own lineage in order, then any
 * ancestor its ancestors name that it does not, so a version that lists only
 * its parent still reaches the root. Cycles end the walk; the item is never
 * its own ancestor.
 */
export function lineage(db: Db, itemId: string): LineageWalk {
  const start = itemById(db, itemId);
  if (!start) throw new Error(`lineage: unknown item ${itemId}`);
  const seen = new Set([itemId]);
  const queue = [...start.lineage];
  const ancestors: MemoryItem[] = [];
  const missing: string[] = [];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    if (seen.has(id)) continue;
    seen.add(id);
    const ancestor = itemById(db, id);
    if (!ancestor) {
      missing.push(id);
      continue;
    }
    ancestors.push(ancestor);
    queue.push(...ancestor.lineage);
  }
  return { ancestors, missing };
}
