// The inspector's event detail (card E8.5): every field of an event,
// labelled. @engram/view gives the fields but the decision fields
// (eventFields); the inspector draws the policy id and the reason after them
// itself, by name, so no view carries a decision field in a row a name could
// not follow (the TUI's no-policy guard, final-review verification N-1).
import { eventFields } from "@engram/view";
import type { MemoryEvent } from "./api/index.ts";

/** Every field of an event, labelled, for its detail panel: the policy id and the reason last. */
export function eventDetail(e: MemoryEvent): [string, string][] {
  return [...eventFields(e), ["policy id", e.policy_id], ["reason", e.reason]];
}
