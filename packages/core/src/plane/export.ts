// Plane.export (card E9.8, review finding E9.8-3): the actor's memory bundle
// (portable.ts, `bundleRows`) and one audit event. Export applies the read
// matrix and hands out candidate, retired and expired content, so it is a
// policy decision and is logged (AGENTS.md rule 3): one `read` event of
// decision allow, by the exporter, naming no item and no scope, so only its
// maker sees it (visible.ts), as every read event. Its reason counts the
// rows and events and names the policy; it carries no `item_ids`, so an
// export never counts toward an item's utility (ADR 0025) and the read path's
// counts (read-reason.ts) do not apply to it. No schema change: the op, the
// fields and their meaning are a read's.
import { type Actor, checkCall } from "../actor.ts";
import { allEvents, appendEvent, currentItems } from "../events.ts";
import type { PlaneDeps } from "../plane.ts";
import { readRuleId } from "../policy/evaluate.ts";
import { type BundleRow, bundleRows } from "../portable.ts";
import { type MemoryEvent, SCHEMA_VERSION } from "../schema.ts";

/** What Plane.export returns: the bundle's rows and the event that recorded the export. */
export interface ExportResult {
  rows: BundleRow[];
  event: MemoryEvent;
}

/** The reason an export's event carries. */
export function exportReason(rows: readonly BundleRow[], policy: PlaneDeps["policy"]): string {
  const events = rows.reduce((n, r) => n + r.events.length, 0);
  return (
    `exported ${rows.length} item${rows.length === 1 ? "" : "s"} with ${events} event${events === 1 ? "" : "s"} ` +
    `as a bundle under ${policy.id} v${policy.version}: the exporter's own person scope and its own ` +
    "items in the other scopes the read matrix lets it read, of every status"
  );
}

/**
 * The rows and the one event, in one transaction, so the bundle is the log
 * as it stood when the event was appended. Refuses an invalid actor or time
 * with InvalidCallError, before the log is read.
 */
export async function exportBundle(
  deps: PlaneDeps,
  actor: Actor,
  at: string,
): Promise<ExportResult> {
  checkCall(actor, at, "export");
  const { db, policy, newId } = deps;
  return db.transaction(() => {
    const rows = bundleRows(policy, actor, currentItems(db), allEvents(db));
    const event = appendEvent(db, {
      id: newId(),
      ts: at,
      op: "read",
      item_id: null,
      actor: actor.id,
      scope_from: null,
      scope_to: null,
      decision: "allow",
      reason: exportReason(rows, policy),
      policy_id: readRuleId(policy, actor),
      schema_version: SCHEMA_VERSION,
    });
    return { rows, event };
  });
}
