// Trust floors (card E2.11, ADR 0040): pure, like the other evaluators. Two
// opt-in options of the policy's `trust` block, both off when absent:
//
// - `unattested_floor`: a write whose actor attests no source is recorded at
//   the least trusted provenance kind, and as that actor's, whatever the
//   caller claimed (plane/write.ts `withPlaneProvenance`). It applies before
//   anything reads the kind: the write gate, the confirmations a promotion
//   counts and the retired-content rule all see the floored kind.
// - `protect_trusted`: a source less trusted than an active item's kind never
//   rewrites or retires it (`engram/write/downgrade`, policy/evaluate.ts), and
//   a budget eviction never chooses a victim more trusted than the write, or
//   the sweep, that triggered it (policy/retention.ts, plane/retention.ts);
//   a write that would need such a victim is denied instead.
//
// The item's owner acting with source `user` is exempt (ADR 0040, decision
// 4). The trust order is core's one order, `leastTrusted` over TRUST_ORDER
// in policy/promotion.ts (decision 5); this file adds no second one.
//
// Taken as ideas (ADR 0037, mode idea; the sources were not open while this
// was written, so no row in docs/absorbed.md): dent8 (Apache-2.0 or MIT), a
// lower authority never changes or retires a higher authority's record;
// Veracium (MIT), an unattested write lands at the least trusted kind;
// mentisdb and Mnemowall (MIT, Apache-2.0), trust judged at the version an
// operation changes.
import type { Actor } from "../actor.ts";
import type { MemoryItem, Policy } from "../schema.ts";
import { leastTrusted } from "./promotion.ts";

type Kind = MemoryItem["provenance"]["kind"];

/** The rule of a write a trust floor denies (ADR 0040, decision 3). */
export const DOWNGRADE_ID = "engram/write/downgrade";

/** Every provenance kind, in the schema's order; `leastTrusted` ranks them. */
const KINDS: readonly Kind[] = [
  "user",
  "document",
  "tool",
  "model",
  "import",
  "compaction",
  "external",
];

/** The least trusted provenance kind in core's order. */
export const leastTrustedKind = (): Kind => leastTrusted(KINDS);

export const floorOn = (policy: Policy) => policy.trust?.unattested_floor === "on";
export const protectOn = (policy: Policy) => policy.trust?.protect_trusted === "on";

/** Is `a` strictly less trusted than `b` in core's order? */
export const lessTrusted = (a: Kind, b: Kind) => a !== b && leastTrusted([a, b]) === a;

/** The item's owner acting with source `user`, who is always exempt (decision 4). */
const ownerAsUser = (actor: Pick<Actor, "id" | "source">, item: MemoryItem) =>
  actor.id === item.owner && actor.source === "user";

/**
 * The item as the floor records it, with the note for the event's reason, or
 * null when the floor does not apply: it is off, or the actor attests a
 * source (then the plane sets the provenance from it, ADR 0004 decision D4).
 */
export function unattestedFloor(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
): [MemoryItem, string] | null {
  if (actor.source !== undefined || !floorOn(policy)) return null;
  const kind = leastTrustedKind();
  const claimed = item.provenance;
  return [
    { ...item, provenance: { ...claimed, kind, actor: actor.id } } as MemoryItem,
    `provenance floored by the plane (trust.unattested_floor): ${actor.id} attests no source, so the item is recorded at kind ${kind}, the least trusted, and as ${actor.id}'s, not as the claimed ${claimed.kind} by ${claimed.actor}`,
  ];
}

/**
 * Does `protect_trusted` keep `victim` from a change or a removal by `actor`
 * acting at trust `kind`? Yes when the option is on, the victim is active,
 * `kind` is less trusted than the victim's kind, and the actor is not the
 * victim's owner acting as user.
 */
export function shields(
  policy: Policy,
  actor: Pick<Actor, "id" | "source">,
  kind: Kind,
  victim: MemoryItem,
): boolean {
  return (
    protectOn(policy) &&
    victim.status === "active" &&
    lessTrusted(kind, victim.provenance.kind) &&
    !ownerAsUser(actor, victim)
  );
}

/**
 * Why `protect_trusted` denies writing `item` over `existing`, the projected
 * item of its id, or null: the write's kind, as the plane records it (after
 * the floor), is less trusted than an active item it rewrites or retires.
 */
export function downgradeProblem(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  existing: MemoryItem | undefined,
): string | null {
  if (!existing || !shields(policy, actor, item.provenance.kind, existing)) return null;
  const what = item.status === "retired" ? "retires" : "rewrites";
  return `a ${item.provenance.kind} write ${what} item ${item.id}, an active ${existing.provenance.kind} item, more trusted: a less trusted source never changes or removes a more trusted item (trust.protect_trusted); only its owner ${existing.owner}, acting as user, may`;
}

/**
 * The trust a budget eviction is judged at: the kind of the item whose write
 * triggered it, or, for a sweep (no item), the sweeper's attested source, the
 * least trusted kind when it attests none.
 */
export const evictionKind = (actor: Pick<Actor, "source">, written?: MemoryItem): Kind =>
  written?.provenance.kind ?? actor.source ?? leastTrustedKind();

/**
 * Which items a budget eviction by `actor` at trust `kind` may choose, or
 * undefined when `protect_trusted` is off and any may be chosen.
 */
export function evictable(
  policy: Policy,
  actor: Pick<Actor, "id" | "source">,
  kind: Kind,
): ((victim: MemoryItem) => boolean) | undefined {
  if (!protectOn(policy)) return undefined;
  return (victim) => !shields(policy, actor, kind, victim);
}
