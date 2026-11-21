// What a memory bundle holds (card E9.8, docs/bundle.md): the items an actor
// may take out of the plane, each with the decision events that shaped it. A
// pure rule over the actor, the policy, the projection and the log, decided
// here so no surface picks the rows by hand (AGENTS.md rule 1).
//
// Which items: those in a scope the read matrix lets the actor read
// (`readableScope`: a member of it, at a level its own level may read), and
// either in the actor's own person scope (the scope whose id is the actor's
// id, whoever wrote each item there) or owned by the actor (`item.owner`) in
// another scope it reads. So a person takes out everything in their person
// scope and their own items in the role, team and org scopes they belong to,
// never another member's item in a shared scope. Every status is included: a
// retired version is the history a later version's lineage names, and the
// bundle carries the item's status as data (an import never trusts it,
// docs/bundle.md).
//
// Which events: every event naming the item's id that the actor may see
// (`eventVisibleTo`, visible.ts), in log order, each without its `item`
// state: the row carries the item as it stands, and an earlier state may
// hold content a later version took out.
import type { Actor } from "./actor.ts";
import { readableScope } from "./policy/evaluate.ts";
import type { MemoryEvent, MemoryItem, Policy } from "./schema.ts";
import { eventVisibleTo } from "./visible.ts";

/** The bundle format's name and version (docs/bundle.md); an importer refuses any other. */
export const BUNDLE_FORMAT = "engram-bundle";
export const BUNDLE_VERSION = 1;

/** One row of a bundle: an item and the decision events on it, without their item state. */
export interface BundleRow {
  item: MemoryItem;
  events: Omit<MemoryEvent, "item">[];
}

/** Whether `item` belongs in `actor`'s bundle under `policy` (see the module comment). */
export function exportable(policy: Policy, actor: Actor, item: MemoryItem): boolean {
  if (!readableScope(policy, actor, item.scope)) return false;
  return item.scope === actor.id || item.owner === actor.id;
}

/**
 * The rows of `actor`'s bundle, ordered by item id (creation order, ADR
 * 0003), each with its visible events in the order given (the log's seq
 * order).
 */
export function bundleRows(
  policy: Policy,
  actor: Actor,
  items: readonly MemoryItem[],
  events: readonly MemoryEvent[],
): BundleRow[] {
  const chosen = items
    .filter((item) => exportable(policy, actor, item))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byItem = new Map<string, Omit<MemoryEvent, "item">[]>(chosen.map((i) => [i.id, []]));
  for (const event of events) {
    const list = event.item_id === null ? undefined : byItem.get(event.item_id);
    if (list === undefined || !eventVisibleTo(actor, event, policy)) continue;
    const { item: _state, ...rest } = event;
    list.push(rest);
  }
  return chosen.map((item) => ({ item, events: byItem.get(item.id) ?? [] }));
}
