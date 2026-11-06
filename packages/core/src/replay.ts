// Replay from events (card E1.3): the item set as it stood after any seq,
// rebuilt from the event log alone. It never reads the items table, and it
// folds the same rule the projection applies (applyEvent), so for every seq it
// equals what currentItems returned right after that event was appended.
import type { Db } from "./db/db.ts";
import { applyEvent, erases } from "./events.ts";
import type { MemoryEvent, MemoryItem } from "./schema.ts";

/** Items as they stood after event `seq`, ordered by id like currentItems; empty before seq 0. */
export function itemsAt(db: Db, seq: number): MemoryItem[] {
  const state = new Map<string, MemoryItem>();
  const rows = db.prepare("SELECT body FROM events WHERE seq <= ? ORDER BY seq").all(seq);
  for (const row of rows) {
    const event = JSON.parse(String(row.body)) as MemoryEvent;
    if (!event.item_id) continue;
    if (erases(event)) {
      state.delete(event.item_id);
      continue;
    }
    const after = applyEvent(state.get(event.item_id), event);
    if (after) state.set(event.item_id, after);
  }
  return [...state.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => state.get(id) as MemoryItem);
}
