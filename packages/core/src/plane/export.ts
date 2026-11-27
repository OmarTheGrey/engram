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
import { disclosedEvent, disclosedItem } from "../visible.ts";
import { accessTime } from "./read.ts";

/** What Plane.export returns: the bundle's rows and the event that recorded the export. */
export interface ExportResult {
  rows: BundleRow[];
  event: MemoryEvent;
}

/** The words an export event's reason starts with; no read path reason does. */
const EXPORT_REASON_PREFIX = "exported ";

/**
 * Whether `event` records an export (Plane.export) rather than a read: a
 * read event naming no item whose reason starts "exported " (a read's reason
 * starts "returned "). The dogfood report counts reads without it (card
 * E9.8, finding E9.8-9).
 */
export function isExportEvent(event: Pick<MemoryEvent, "op" | "item_id" | "reason">): boolean {
  return (
    event.op === "read" && event.item_id === null && event.reason.startsWith(EXPORT_REASON_PREFIX)
  );
}

/** The reason an export's event carries. */
export function exportReason(rows: readonly BundleRow[], policy: PlaneDeps["policy"]): string {
  const events = rows.reduce((n, r) => n + r.events.length, 0);
  return (
    `${EXPORT_REASON_PREFIX}${rows.length} item${rows.length === 1 ? "" : "s"} with ${events} event${events === 1 ? "" : "s"} ` +
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
    const items = currentItems(db);
    // Each row as the exporter is shown it (card RD1, visible.ts): a row it
    // holds but does not own shows only the grants naming it, and no grantee
    // in a grant change's reason; every row only the lineage ids it may ask
    // for by id (ADR 0047).
    const projected = new Map(items.map((i) => [i.id, i]));
    const view = { policy, at: accessTime(db, at), current: (i: string) => projected.get(i) };
    const rows = bundleRows(policy, actor, items, allEvents(db)).map((row) => ({
      ...row,
      item: disclosedItem(actor, row.item, view),
      events: row.events.map((e) => disclosedEvent(actor, e, view)),
    }));
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
