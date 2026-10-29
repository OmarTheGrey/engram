// The retention evaluator (card E2.4, ADR 0025): pure, like the write and
// read evaluators in evaluate.ts. Given a policy, one scope, the projected
// items, the time and how each item has been used, it returns the
// retirements a sweep would make, each with a reason and the id of the rule
// that decided. No clock, no randomness, no store. The plane appends them as
// events (plane/retention.ts); retention retires, never deletes (ADR 0010).
//
// Rule ids:
//   <policy id>/retention/<level>/<class>   the policy's retention rule for that level and class
//   engram/retention/item-ttl               the item's own ttl, when tighter than the rule's
//   engram/retention/membership             the sweep's actor is not a member of the scope
import type { Actor } from "../actor.ts";
import type { MemoryItem, Policy, ScopeLevel } from "../schema.ts";
import { addSeconds, compareTimestamps } from "../time.ts";

export const ITEM_TTL_ID = "engram/retention/item-ttl";
export const RETENTION_MEMBERSHIP_ID = "engram/retention/membership";

type MemoryClass = MemoryItem["class"];
type RetentionRule = Policy["retention"][number];

/** Classes in the order a sweep visits them, so its events come in a fixed order. */
const CLASS_ORDER: readonly MemoryClass[] = ["episodic", "semantic", "procedural"];

const levelOf = (scope: string) => (scope === "org" ? "org" : scope.split(":")[0]) as ScopeLevel;

/** How each item has been used, read from the log by the plane. */
export interface RetentionUsage {
  /** The seq of the event that last changed each item (recency). A missing item counts as oldest. */
  lastChanged: ReadonlyMap<string, number>;
  /** How many explanation rows name each item: how often a read returned it (utility). */
  reads: ReadonlyMap<string, number>;
}

/** One retirement a sweep makes, or the one question a manual rule asks. */
export interface Retirement {
  /** `retire` on expiry, `evict` on budget overage. */
  op: "retire" | "evict";
  /** `ask` only for a manual rule's overage, which retires nothing. */
  decision: "allow" | "ask";
  /** The item retired; null for a manual rule's ask. */
  item_id: string | null;
  class: MemoryClass;
  reason: string;
  policy_id: string;
}

export function retentionRuleId(policy: Policy, level: ScopeLevel, cls: MemoryClass): string {
  return `${policy.id}/retention/${level}/${cls}`;
}

/** The policy's retention rule for `scope`'s level and `cls`, if it has one. */
export function retentionRule(
  policy: Policy,
  scope: string,
  cls: MemoryClass,
): RetentionRule | undefined {
  const level = levelOf(scope);
  return policy.retention.find((r) => r.scope === level && r.class === cls);
}

export interface Expiry {
  /** The first instant at which the item is expired. */
  at: string;
  /** The ttl that applies, in seconds. */
  ttl: number;
  /** The rule's id, or ITEM_TTL_ID when the item's own ttl is the tighter. */
  policy_id: string;
}

/**
 * When `item` expires: `valid_from` plus the tighter of its own ttl and its
 * rule's ttl, at full precision, or null when neither sets one or the sum
 * is past any writable instant. Expiry is retention; it never touches
 * `valid_to`, which is truth (ADR 0005).
 */
export function itemExpiry(policy: Policy, item: MemoryItem): Expiry | null {
  const rule = retentionRule(policy, item.scope, item.class);
  const ruleTtl = rule?.ttl ?? null;
  const own = item.ttl;
  if (ruleTtl === null && own === null) return null;
  const useOwn = ruleTtl === null || (own !== null && own < ruleTtl);
  const ttl = (useOwn ? own : ruleTtl) as number;
  const at = addSeconds(item.valid_from, ttl);
  if (at === null) return null;
  return {
    at,
    ttl,
    policy_id: useOwn ? ITEM_TTL_ID : retentionRuleId(policy, levelOf(item.scope), item.class),
  };
}

/** Is `item` past its ttl at `at`: its expiry instant is not after `at`. */
export function isExpired(policy: Policy, item: MemoryItem, at: string): boolean {
  const expiry = itemExpiry(policy, item);
  return expiry !== null && compareTimestamps(expiry.at, at) <= 0;
}

/**
 * May `actor`'s sweep retire items of `scope` by ttl? Ttl retirement reads
 * the caller's clock and nothing reinstates it yet (ADR 0025, decision 6), so
 * one actor with a skewed clock must not retire what others share (review
 * finding P4-6). In the actor's own person scope its own clock decides; in
 * any other scope only a user-sourced actor, a person's explicit act,
 * retires by ttl. Reads exclude expired items whoever sweeps.
 */
export function mayRetireByTtl(actor: Pick<Actor, "id" | "source">, scope: string): boolean {
  return scope === actor.id || actor.source === "user";
}

const byId = (a: MemoryItem, b: MemoryItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export interface RetentionOptions {
  /**
   * Retire expired items first. Default true. Without it (the write path's
   * budget check, and a sweep of a shared scope by an actor who is not
   * user-sourced) expired items are not retired, but they still hold no
   * budget slot: a read already excludes them (review finding P4-2).
   */
  expiry?: boolean;
  /**
   * An item never chosen as a victim: the write that just landed, so a full
   * utility scope does not evict every new write (review finding P4-1). It
   * still counts toward the budget.
   */
  protect?: string;
  /**
   * Reasons name no item id, seq, read count or item count: the actor cannot
   * read the scope (review finding P4-4, as finding N3 for write denials).
   */
  redact?: boolean;
}

/**
 * The retirements a sweep of `scope` makes at `at`, in order, class by class:
 * first every active or candidate item past its ttl (op `retire`), then, if
 * the active items not past their ttl exceed the rule's budget, the overage
 * (op `evict`) in the rule's order. `recency` evicts the items whose last
 * change is oldest; `utility` the items fewest reads returned, ties broken by
 * recency; `manual` evicts nothing and asks once, naming the overage. Ties
 * left fall to the item id. Items outside `scope` are ignored.
 */
export function evaluateRetention(
  policy: Policy,
  scope: string,
  items: readonly MemoryItem[],
  at: string,
  usage: RetentionUsage,
  options: RetentionOptions = {},
): Retirement[] {
  const out: Retirement[] = [];
  const level = levelOf(scope);
  const redact = options.redact === true;
  const changed = (i: MemoryItem) => usage.lastChanged.get(i.id) ?? -1;
  const reads = (i: MemoryItem) => usage.reads.get(i.id) ?? 0;
  for (const cls of CLASS_ORDER) {
    const own = items.filter((i) => i.scope === scope && i.class === cls).sort(byId);
    // Items past their ttl hold no slot, retired here or not (P4-2).
    const active = own.filter((i) => i.status === "active" && !isExpired(policy, i, at));
    if (options.expiry !== false) {
      for (const item of own) {
        if (item.status === "retired") continue;
        const expiry = itemExpiry(policy, item);
        if (expiry === null || compareTimestamps(expiry.at, at) > 0) continue;
        const source =
          expiry.policy_id === ITEM_TTL_ID ? "the item's own ttl" : "the retention rule";
        out.push({
          op: "retire",
          decision: "allow",
          item_id: item.id,
          class: cls,
          reason: redact
            ? `an item in ${scope} passed its ttl (from ${source}); retired, kept in the log and the store`
            : `item ${item.id} expired at ${expiry.at} (valid_from ${item.valid_from} plus ttl ${expiry.ttl}s, from ${source}); retired, kept in the log and the store`,
          policy_id: expiry.policy_id,
        });
      }
    }

    const rule = retentionRule(policy, scope, cls);
    if (!rule || rule.budget === null || active.length <= rule.budget) continue;
    const over = active.length - rule.budget;
    const policy_id = retentionRuleId(policy, level, cls);
    const held = redact
      ? `scope ${scope} is over its ${cls} budget`
      : `scope ${scope} holds ${active.length} active ${cls} items, budget ${rule.budget}`;
    if (rule.eviction === "manual") {
      out.push({
        op: "evict",
        decision: "ask",
        item_id: null,
        class: cls,
        reason: `${held}${redact ? "" : `: ${over} over`}; eviction is manual, so nothing is evicted and a person decides`,
        policy_id,
      });
      continue;
    }
    const byRecency = (a: MemoryItem, b: MemoryItem) => changed(a) - changed(b) || byId(a, b);
    const order =
      rule.eviction === "recency"
        ? byRecency
        : (a: MemoryItem, b: MemoryItem) => reads(a) - reads(b) || byRecency(a, b);
    const candidates = active.filter((i) => i.id !== options.protect);
    for (const victim of candidates.sort(order).slice(0, over)) {
      const why =
        rule.eviction === "recency"
          ? `evicted the oldest by last change (seq ${changed(victim)})`
          : `evicted the least read (${reads(victim)} explanation rows; last change seq ${changed(victim)})`;
      out.push({
        op: "evict",
        decision: "allow",
        item_id: victim.id,
        class: cls,
        reason: redact
          ? `${held}; an item was evicted by ${rule.eviction}; retired, kept in the log and the store`
          : `${held}; ${why}: item ${victim.id}; retired, kept in the log and the store`,
        policy_id,
      });
    }
  }
  return out;
}
