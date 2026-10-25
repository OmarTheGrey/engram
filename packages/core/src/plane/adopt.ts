// Adoption (needed by card E8.2): bringing what a store already holds under the
// plane. The read path takes its candidates from the projection (card E2.2),
// so a memory written into a store before the plane governed it, such as a
// Claude Code memory file, is invisible until the log has a write for it.
// adoptStoreItems lists the adapter's items in one scope and runs each one the
// projection does not already hold, as it stands, through the same write gate
// as Plane.write. An allowed item is recorded at the store_ref it already has
// and its bytes are never rewritten; a denied one leaves its deny event. Every
// decision is one event with its reason and policy_id (AGENTS.md rule 3).
import { currentItems } from "../events.ts";
import type { Actor, PlaneDeps } from "../plane.ts";
import type { MemoryItem } from "../schema.ts";
import { gatedWrite } from "./write.ts";

export interface AdoptReport {
  /** Items the adapter lists in the scope. */
  listed: number;
  allowed: number;
  denied: number;
  /** Items the projection already holds as the store has them. */
  unchanged: number;
  denials: { item_id: string; reason: string; policy_id: string }[];
}

/** JSON with sorted keys, so equal items compare equal whatever their key order. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  );

/** The gate may land an item with another status, so status is not compared. */
const sameItem = (a: MemoryItem, b: MemoryItem) =>
  canonical({ ...a, status: null }) === canonical({ ...b, status: null });

export async function adoptStoreItems(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  at: string,
): Promise<AdoptReport> {
  const listed = await deps.adapter.list(scope);
  const projected = new Map(currentItems(deps.db).map((i) => [i.id, i]));
  const report: AdoptReport = {
    listed: listed.length,
    allowed: 0,
    denied: 0,
    unchanged: 0,
    denials: [],
  };
  for (const item of listed) {
    const known = projected.get(item.id);
    if (known && sameItem(known, item)) {
      report.unchanged++;
      continue;
    }
    if (!item.store_ref) {
      throw new Error(`adopt: ${deps.adapter.name} listed item ${item.id} without a store_ref`);
    }
    const { event } = await gatedWrite(deps, actor, item, at, item.store_ref);
    if (event.decision === "allow") report.allowed++;
    else {
      report.denied++;
      report.denials.push({
        item_id: item.id,
        reason: event.reason,
        policy_id: event.policy_id,
      });
    }
  }
  return report;
}
