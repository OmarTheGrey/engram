// What a viewer may see of the log (plan docs/tasks/gate-b-plan.md, decision
// 5; ADR 0027, decision 7 and its amendments). A pure rule over the actor,
// the log, the policy and the projection, decided here so no surface filters
// the timeline by hand (AGENTS.md rule 1).
//
// Which events: an event is shown to a member of a scope it names, its source
// scope or its target scope, whose level the read matrix lets the viewer read,
// and to the viewer who made it (`event.actor` is the viewer's id) when it
// names no scope (review finding RV7-R2 of PR #61: the CLI and the server
// build a role context under the person's own id, so a maker's exemption for
// every event would show it the person scope's events). The read matrix
// rule is `readableScope` (card RV7, core review finding RV-CORE-4): a role
// context that is a member of a person scope reads none of it (ADR 0021), so
// it sees none of its events either, whose ids, actors and lint reasons (a
// content hash) would tell it what the read withholds. An event that names no
// scope is shown only to its maker:
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
//
// What of each item (card RD1; lead-decisions item 36, answered (a), and
// card E8.15c's finding on the read route's lineage). Every answer that
// gives an actor an item, a read, a by-id read, a shown event, a promotion,
// a bundle row or a supersede plan's close, gives it through `disclosedItem`,
// so the CLI, the HTTP API, MCP, the pi extension and the inspector agree:
// - Grants. The item's owner (its id is the item's owner and it may read the
//   item's scope, as Plane.changeGrants and whoCanReadItem know it) is shown
//   every grant; anyone else only the grants whose `to` names it
//   (grantMatches), expired or not. A member of the scope who is neither
//   owner nor grantee is shown none. A read's grants_used is numbered by the
//   grants shown (`disclosedGrantsUsed`), so its place never tells a grantee
//   how many grants come before its own (as E2.13-4 keeps it out of
//   who-can-read). A grant change's reason names grantees, so a shown event
//   of the grant-change gate keeps its reason only for its maker and the
//   item's owner (`disclosedReason`).
// - Lineage. An id a lineage names is shown only when ADR 0047's by-id rule
//   would let the actor ask for it (`idShownTo`): the item under it is
//   projected and either in a scope the actor may read (readableScope; the
//   actor already sees that scope's events, which name it) or admitted to the
//   actor by the read filter at the answer's time. Any other id is dropped,
//   with no count and no placeholder, as the inspector's item page leaves it
//   (packages/ui/src/provenance.ts).
// The log is unchanged: only what an answer shows is narrowed.
import type { Actor } from "./actor.ts";
import {
  evaluateRead,
  GRANT_EXPIRED_ID,
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  GRANT_UNCHANGED_ID,
  grantMatches,
  readableScope,
} from "./policy/evaluate.ts";
import { GRANT_CHANGE_ID, GRANT_CONFLICT_ID, GRANT_STATUS_ID } from "./policy/grants.ts";
import type { Grant, MemoryEvent, MemoryItem, Policy } from "./schema.ts";

/** The policy ids of the grant-change gate (policy/grants.ts and evaluate.ts), whose reasons may name grantees. */
const GRANT_GATE_IDS: ReadonlySet<string> = new Set([
  GRANT_CHANGE_ID,
  GRANT_CONFLICT_ID,
  GRANT_EXPIRED_ID,
  GRANT_OWNER_ID,
  GRANT_SOURCE_ID,
  GRANT_STATUS_ID,
  GRANT_UNCHANGED_ID,
]);

/** What the item rule needs: the policy, the time, and the projected item of an id. */
export interface EventView {
  policy: Policy;
  /** The time the read filter is evaluated at (ttl, validity, grant expiry). */
  at: string;
  /** The item as the projection holds it now; undefined when it is unknown. */
  current: (itemId: string) => MemoryItem | undefined;
  /** The time validity windows are judged at, for a read that names one (ReadQuery.valid_at); `at` when absent. */
  validAt?: string;
}

/** Whether `viewer` is `item`'s owner as Plane.changeGrants knows it: its id, and a member who may read the scope. */
export function ownsItem(policy: Policy, viewer: Actor, item: MemoryItem): boolean {
  return viewer.id === item.owner && readableScope(policy, viewer, item.scope);
}

/** The grants on `item` that `viewer` is shown: every one to its owner, those naming it to anyone else. */
export function grantsShownTo(policy: Policy, viewer: Actor, item: MemoryItem): Grant[] {
  if (ownsItem(policy, viewer, item)) return item.grants;
  return item.grants.filter((g) => grantMatches(g.to, viewer.id));
}

/**
 * Whether `viewer` may be shown the id `itemId` where a lineage names it:
 * ADR 0047's by-id rule at `view.at` (see the module comment).
 */
export function idShownTo(viewer: Actor, itemId: string, view: EventView): boolean {
  const named = view.current(itemId);
  if (named === undefined) return false;
  return (
    readableScope(view.policy, viewer, named.scope) ||
    evaluateRead(view.policy, viewer, named, view.at, view.validAt ?? view.at).admitted
  );
}

/**
 * `item` as `viewer` is shown it: its grants and its lineage narrowed (see
 * the module comment), every other field as given. The same object when
 * nothing is narrowed.
 */
export function disclosedItem(viewer: Actor, item: MemoryItem, view: EventView): MemoryItem {
  const grants = grantsShownTo(view.policy, viewer, item);
  const lineage = item.lineage.filter((ancestor) => idShownTo(viewer, ancestor, view));
  if (grants.length === item.grants.length && lineage.length === item.lineage.length) return item;
  return { ...item, grants, lineage };
}

/**
 * A read's grants_used for `item` (`grants[<index>]:<to>`, the index on the
 * item as stored), renumbered by the grants `viewer` is shown of it. A grant
 * that admits a read always names its reader, so it is always shown.
 */
export function disclosedGrantsUsed(
  policy: Policy,
  viewer: Actor,
  item: MemoryItem,
  used: readonly string[],
): string[] {
  if (ownsItem(policy, viewer, item)) return [...used];
  const shown = item.grants.flatMap((g, i) => (grantMatches(g.to, viewer.id) ? [i] : []));
  return used.map((label) => {
    const match = /^grants\[(\d+)\]:(.*)$/s.exec(label);
    const place = match ? shown.indexOf(Number(match[1])) : -1;
    return match && place >= 0 ? `grants[${place}]:${match[2]}` : label;
  });
}

/**
 * The reason of `event` as `viewer` is shown it. A grant-change gate's
 * event names the grants it added, removed or refused, so anyone but its
 * maker and the item's owner is told that the grants changed, not which.
 */
export function disclosedReason(viewer: Actor, event: MemoryEvent, view: EventView): string {
  // A grant change is one `update` event (Plane.changeGrants); a write the
  // grant rule refuses is a write's own event and keeps its reason.
  if (event.op !== "update" || !GRANT_GATE_IDS.has(event.policy_id) || event.item_id === null)
    return event.reason;
  if (event.actor === viewer.id) return event.reason;
  const item = view.current(event.item_id) ?? event.item ?? undefined;
  if (item !== undefined && ownsItem(view.policy, viewer, item)) return event.reason;
  return `${event.actor} ${event.decision === "allow" ? "changed" : "asked to change"} the grants of item ${event.item_id}; which grants is shown only to the item's owner, and each grantee is shown its own on the item`;
}

/** `event` as `viewer` is shown it: its item, if any, through disclosedItem, and its reason through disclosedReason. */
export function disclosedEvent<E extends MemoryEvent | Omit<MemoryEvent, "item">>(
  viewer: Actor,
  event: E,
  view: EventView,
): E {
  const full = event as MemoryEvent;
  const reason = disclosedReason(viewer, full, view);
  const item = full.item ? disclosedItem(viewer, full.item, view) : full.item;
  if (reason === full.reason && item === full.item) return event;
  return { ...event, reason, ...(full.item ? { item } : {}) };
}

/** Whether `viewer` may see `event` at all under `policy` (see the module comment). */
export function eventVisibleTo(viewer: Actor, event: MemoryEvent, policy: Policy) {
  const reads = (scope: string | null) => scope !== null && readableScope(policy, viewer, scope);
  if (reads(event.scope_from) || reads(event.scope_to)) return true;
  // The maker sees its own event only when the event names no scope (a read,
  // a bypass, a schema deny): a role context under the person's own id is the
  // same maker, and must not see the person scope's events (review finding
  // RV7-R2 of PR #61).
  return event.actor === viewer.id && event.scope_from === null && event.scope_to === null;
}

/** Whether the read filter would return `item` to `viewer` at `view.at`, as carried and as it stands now. */
export function itemVisibleTo(viewer: Actor, item: MemoryItem, view: EventView): boolean {
  if (!evaluateRead(view.policy, viewer, item, view.at).admitted) return false;
  const now = view.current(item.id);
  return now === undefined || evaluateRead(view.policy, viewer, now, view.at).admitted;
}

/** A write's answer (WriteResult's shape) as `viewer` is shown it: its item and its events through the rules above. */
export function disclosedWrite<
  W extends { item: MemoryItem | null; event: MemoryEvent; retention: readonly MemoryEvent[] },
>(viewer: Actor, written: W, view: EventView): W {
  return {
    ...written,
    item: written.item && disclosedItem(viewer, written.item, view),
    event: disclosedEvent(viewer, written.event, view),
    retention: written.retention.map((e) => disclosedEvent(viewer, e, view)),
  };
}

/**
 * The events `viewer` may see, in the order given (the log's seq order), each
 * without its `item` unless the read filter would return that item to the
 * viewer now, and each as disclosedEvent shows it (card RD1).
 */
export function visibleEvents(
  viewer: Actor,
  events: readonly MemoryEvent[],
  view: EventView,
): MemoryEvent[] {
  return events
    .filter((event) => eventVisibleTo(viewer, event, view.policy))
    .map((event) => {
      if (!event.item || itemVisibleTo(viewer, event.item, view))
        return disclosedEvent(viewer, event, view);
      const { item: _withheld, ...rest } = event;
      return disclosedEvent(viewer, rest, view);
    });
}
