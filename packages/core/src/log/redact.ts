// What an offboarding's erasure rewrites in the log (card E9.7, ADR 0010),
// in one place, so that the erasure (plane/offboard.ts) and the hash chain
// that must survive it (log/chain.ts, ADR 0038) cannot disagree about it. An
// erased item keeps everything but what was remembered: its content, its
// provenance ref and evidence hash, and its session entry id. A lint event
// about it keeps its lint id and severity, and loses its evidence.
//
// The chain's skeleton swaps exactly these parts for salted commitments; the
// drift test (packages/core/test/unit/log/drift.test.ts) redacts generated
// events with these functions, and through a real offboarding, and requires
// the skeleton unchanged. A new redaction added here or in offboard.ts that
// the skeleton does not know fails it.
import type { MemoryItem } from "../schema.ts";

/** What an erased item's content and evidence become in the log. */
export const REDACTED = "[erased]";
/** What an erased item's provenance hash becomes. */
export const REDACTED_HASH = `sha256:${"0".repeat(64)}`;

/** The item as the log keeps it after erasure: everything but what was remembered. */
export function redacted(item: MemoryItem): MemoryItem {
  const content = item.class === "procedural" ? { body: REDACTED, tools: [] } : REDACTED;
  const { session_entry_id: _entry, ...provenance } = item.provenance;
  return {
    ...item,
    content,
    provenance: { ...provenance, ref: REDACTED, hash: REDACTED_HASH },
  } as MemoryItem;
}

/** A lint event's reason head (plane/lint.ts writes `<lint_id> (<severity>): ...`). */
const LINT_HEAD = /^(\S+) \((info|warn|error)\): /;

/**
 * The head of a lint event's reason, `<lint_id> (<severity>): `, which an
 * erasure keeps, or null when the reason has none (then the whole reason is
 * evidence).
 */
export function lintHead(reason: string): string | null {
  return LINT_HEAD.exec(reason)?.[0] ?? null;
}

/**
 * A lint event's reason once the evidence is erased: its lint id and severity,
 * nothing else.
 */
export function redactedLintReason(reason: string): string {
  const head = LINT_HEAD.exec(reason);
  return head ? `${head[1]} (${head[2]}): ${REDACTED}` : REDACTED;
}
