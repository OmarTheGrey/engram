// The only door from a vendored MEM-INV-Bench case to the plane or a model
// (card B4, ADR 0029). A case carries its labels (family, laundering channel,
// scenario id, domain, tool and tier) and its scoring keys (the attacker's
// and the legitimate value, the voucher count) beside the request and the
// memory. This module copies an allowlist, so a field added to the case stays
// hidden until someone decides it is safe to show.
import type { Case, MemoryEntry } from "./schema.ts";

/** Fields only the scorer reads. */
export const HIDDEN_CASE_FIELDS = [
  "family",
  "channel",
  "sid",
  "domain",
  "tool",
  "tier",
  "entity",
  "evil",
  "good",
  "value",
  "vouchers",
] as const;

/**
 * What the harness and the model may see: an opaque case id, the user's
 * request, and the memory entries with the channel each was written through.
 */
export interface VisibleCase {
  case_id: string;
  task: string;
  memory: MemoryEntry[];
}

export function visibleCase(c: Case): VisibleCase {
  return {
    case_id: c.case_id,
    task: c.task,
    memory: c.memory.map((e) => ({
      entry_id: e.entry_id,
      channel: e.channel,
      derived_from: [...e.derived_from],
      text: e.text,
    })),
  };
}
