// Which events a viewer may see (plan docs/tasks/gate-b-plan.md, decision 5;
// ADR 0027, decision 7). A pure rule over the actor and the log, decided here
// so no surface filters the timeline by hand (AGENTS.md rule 1).
//
// An event is visible to a viewer when the viewer made it (`event.actor` is
// the viewer's id), or when a scope it names, its source scope or its target
// scope, is one the viewer is a member of. An event that names no scope is
// visible only to the actor who made it. Those are the events whose scope the
// plane does not record or deliberately leaves out: every read (scope_from
// and scope_to are null: a read spans the reader's reach, and its reason
// counts items out of that reach, decision D5), every bypass_blocked event, a
// write denied by the schema rule before a valid scope was known, and a
// promotion refused for an item the promoter cannot access, whose source
// scope the plane withholds (it still names the target). An event whose
// source scope is a member scope and whose target is not (a promotion out of
// the viewer's scope, and the retire that supersedes the source) is visible:
// it changed an item the viewer could see. Membership is the rule, not the
// read matrix: the timeline is an audit view of the scopes a viewer belongs
// to, and what it may read of items is still Plane.read's to decide.
import type { Actor } from "./actor.ts";
import type { MemoryEvent } from "./schema.ts";

/** Whether `viewer` may see `event` (see the module comment for the rule). */
export function eventVisibleTo(viewer: Pick<Actor, "id" | "memberships">, event: MemoryEvent) {
  if (event.actor === viewer.id) return true;
  const member = (scope: string | null) => scope !== null && viewer.memberships.includes(scope);
  return member(event.scope_from) || member(event.scope_to);
}

/** The events `viewer` may see, in the order given (the log's seq order). */
export function visibleEvents(
  viewer: Pick<Actor, "id" | "memberships">,
  events: readonly MemoryEvent[],
): MemoryEvent[] {
  return events.filter((event) => eventVisibleTo(viewer, event));
}
