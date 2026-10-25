// The item metadata store (card E1.2): the plane-owned view of each item,
// read from the projection that events.ts maintains. It is keyed by id and by
// store_ref (unique per adapter and key, migration 2), and versions are linked
// by lineage: each version lists the ids of the versions it supersedes,
// nearest first. Nothing here writes; every change is an event.
import type { StoreRef } from "./adapter.ts";
import type { Db, Row } from "./db/db.ts";
import type { MemoryItem } from "./schema.ts";

const parse = (row: Row | undefined) =>
  row ? (JSON.parse(String(row.body)) as MemoryItem) : undefined;

export function itemById(db: Db, id: string): MemoryItem | undefined {
  return parse(db.prepare("SELECT body FROM items WHERE id = ?").get(id));
}

/** The item whose bytes live at `ref`, whatever its status. */
export function itemByStoreRef(db: Db, ref: StoreRef): MemoryItem | undefined {
  return parse(
    db
      .prepare("SELECT body FROM items WHERE store_adapter = ? AND store_key = ?")
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
