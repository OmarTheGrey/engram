// What a viewer may see of the log (plan docs/tasks/gate-b-plan.md, decision
// 5; ADR 0027, decision 7 and its amendments). A pure rule over the actor,
// the log, the policy and the projection, decided here so no surface filters
// the timeline by hand (AGENTS.md rule 1).
//
// Which events: an event is shown to the viewer who made it (`event.actor` is
// the viewer's id), and to a member of a scope it names, its source scope or
// its target scope. An event that names no scope is shown only to its maker:
// every read (scope_from and scope_to are null: a read spans the reader's
// reach, and its reason counts items out of that reach, decision D5), every
// bypass_blocked event, and a write denied by the schema rule before a valid
// scope was known. A promotion refused for an item the promoter cannot access
// withholds its source scope and keeps its target. An event leaving a member
// scope (a promotion out of it, the retire that supersedes the source) is
// shown to that scope's members: it changed an item they could see.
//
// What of each event (review finding R3-4): membership decides which events
// show, but an event's `item`, the full item state an allowed write or
// promotion carries, is shown only when the read filter would return that
// item to the viewer now (Plane.read's evaluateRead, at `at`): in a scope the
// read matrix lets the viewer read, or through a grant naming it; active; not
// past its ttl; inside its validity window. Both the item as the event
// carries it and the item as the projection holds it now must pass, so a
// version since retired, expired or moved out of reach is not shown. An event
// whose item is withheld keeps every other field.
import type { Actor } from "./actor.ts";
import { evaluateRead } from "./policy/evaluate.ts";
import type { MemoryEvent, MemoryItem, Policy } from "./schema.ts";

/** What the item rule needs: the policy, the time, and the projected item of an id. */
export interface EventView {
  policy: Policy;
  /** The time the read filter is evaluated at (ttl, validity, grant expiry). */
  at: string;
  /** The item as the projection holds it now; undefined when it is unknown. */
  current: (itemId: string) => MemoryItem | undefined;
}

/** Whether `viewer` may see `event` at all (see the module comment). */
export function eventVisibleTo(viewer: Pick<Actor, "id" | "memberships">, event: MemoryEvent) {
  if (event.actor === viewer.id) return true;
  const member = (scope: string | null) => scope !== null && viewer.memberships.includes(scope);
  return member(event.scope_from) || member(event.scope_to);
}

/** Whether the read filter would return `item` to `viewer` at `view.at`, as carried and as it stands now. */
export function itemVisibleTo(viewer: Actor, item: MemoryItem, view: EventView): boolean {
  if (!evaluateRead(view.policy, viewer, item, view.at).admitted) return false;
  const now = view.current(item.id);
  return now === undefined || evaluateRead(view.policy, viewer, now, view.at).admitted;
}

/**
 * The events `viewer` may see, in the order given (the log's seq order), each
 * without its `item` unless the read filter would return that item to the
 * viewer now.
 */
export function visibleEvents(
  viewer: Actor,
  events: readonly MemoryEvent[],
  view: EventView,
): MemoryEvent[] {
  return events
    .filter((event) => eventVisibleTo(viewer, event))
    .map((event) => {
      if (!event.item || itemVisibleTo(viewer, event.item, view)) return event;
      const { item: _withheld, ...rest } = event;
      return rest;
    });
}
