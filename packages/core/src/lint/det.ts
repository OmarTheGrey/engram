// The deterministic lints (card L1, ADR 0008): pure functions over the
// projection, no store, no clock, no model. Each lint looks at one active
// item of the linted scope and returns at most one finding for it; the plane
// (plane/lint.ts) records every finding as one `lint` event. The definitions,
// each recorded as a decision entry under docs/log/ dated 2026-11-06:
//
//   expired-validity      an active item whose valid_to is not after `at`, or past its ttl
//   source-changed        provenance.ref names an item whose strict content hash differs from provenance.hash
//   scope-class-mismatch  an active item whose class its scope's write rule no longer allows
//   missing-provenance    weak provenance: model or compaction without `model`, compaction
//                         without `session_entry_id`, a blank ref
//   orphan                provenance.ref naming an item that is absent, out of reach or retired, or a
//                         lineage id naming one absent, out of reach, evicted or retired other than by
//                         its own supersession
//   duplicate             same scope, class and strict content hash as an earlier active item (ADR 0018)
//
// An item the linting actor cannot reach counts as absent, so a finding says
// nothing about what the actor could not read (decision D5).
import { strictContentHash } from "../content-hash.ts";
import { DETERMINISTIC_LINT_IDS, type DeterministicLintId } from "../lint.ts";
import { scopeLevel } from "../policy/evaluate.ts";
import { promotionRuleId } from "../policy/promotion.ts";
import { isExpired, itemExpiry } from "../policy/retention.ts";
import { Id, type LintFinding, type MemoryItem, type Policy } from "../schema.ts";
import { compareTimestamps } from "../time.ts";

/** A finding before the plane gives it an id: what one lint says about one item. */
export type DetFinding = Pick<
  LintFinding,
  "lint_id" | "item_id" | "severity" | "message" | "evidence"
>;

/** How serious each deterministic finding is. */
export const DET_LINT_SEVERITY: Record<DeterministicLintId, LintFinding["severity"]> = {
  "expired-validity": "warn",
  "source-changed": "warn",
  "scope-class-mismatch": "error",
  "missing-provenance": "warn",
  orphan: "warn",
  duplicate: "warn",
};

/** What the lints read besides the item itself. */
export interface LintContext {
  policy: Policy;
  /** The time validity and ttl are judged at; injected, never read from a clock. */
  at: string;
  /** Every projected item, in any scope and status, by id. */
  items: ReadonlyMap<string, MemoryItem>;
  /** For each retired item, the op and policy id of the allowed event that retired it last. */
  retiredBy: ReadonlyMap<string, { op: string; policy_id: string }>;
  /**
   * Whether the linting actor could read an item at `at` by scope or a live
   * grant (readableAt); one it cannot counts as absent.
   */
  canReach: (item: MemoryItem) => boolean;
}

const finding = (
  lint_id: DeterministicLintId,
  item: MemoryItem,
  message: string,
  evidence: string[],
): DetFinding => ({
  lint_id,
  item_id: item.id,
  severity: DET_LINT_SEVERITY[lint_id],
  message,
  evidence,
});

/** The item id a provenance ref names: a UUIDv7, bare or as `item:<id>`; else null. */
export function refItemId(ref: string): string | null {
  const id = ref.startsWith("item:") ? ref.slice("item:".length) : ref;
  return Id.safeParse(id).success ? id : null;
}

/** expired-validity: valid_to is not after `at`, or the item is past its ttl. */
export function expiredValidity(item: MemoryItem, ctx: LintContext): DetFinding | null {
  if (item.valid_to !== null && compareTimestamps(item.valid_to, ctx.at) <= 0)
    return finding(
      "expired-validity",
      item,
      `its validity ended at ${item.valid_to}, not after ${ctx.at}, yet it is active`,
      [`valid_to ${item.valid_to}`, `at ${ctx.at}`],
    );
  const expiry = itemExpiry(ctx.policy, item);
  if (expiry !== null && isExpired(ctx.policy, item, ctx.at))
    return finding(
      "expired-validity",
      item,
      `it passed its ttl at ${expiry.at} (valid_from ${item.valid_from} plus ${expiry.ttl}s), yet it is active`,
      [`expired ${expiry.at}`, `ttl ${expiry.ttl}s from ${expiry.policy_id}`],
    );
  return null;
}

/** source-changed: the item its ref names now has content whose strict hash is not the recorded one. */
export function sourceChanged(item: MemoryItem, ctx: LintContext): DetFinding | null {
  const id = refItemId(item.provenance.ref);
  const source = id === null ? undefined : ctx.items.get(id);
  if (source === undefined || !ctx.canReach(source)) return null;
  const now = strictContentHash(source.content);
  if (now === item.provenance.hash) return null;
  return finding(
    "source-changed",
    item,
    `its source ${source.id} no longer hashes to the ${item.provenance.hash} recorded at write`,
    [`source ${source.id}`, `recorded ${item.provenance.hash}`, `current ${now}`],
  );
}

/** scope-class-mismatch: the scope's write rule is gone or now forbids the item's class. */
export function scopeClassMismatch(item: MemoryItem, ctx: LintContext): DetFinding | null {
  const level = scopeLevel(item.scope);
  const rule = ctx.policy.write.find((r) => r.scope === level);
  if (rule === undefined)
    return finding(
      "scope-class-mismatch",
      item,
      `policy ${ctx.policy.id} has no write rule for ${level} scope, so a write of it would be denied`,
      [`${ctx.policy.id}/write/${level} absent`],
    );
  if (rule.forbidden_classes.includes(item.class))
    return finding(
      "scope-class-mismatch",
      item,
      `${item.class} items are forbidden in ${level} scope by policy ${ctx.policy.id}`,
      [`${ctx.policy.id}/write/${level} forbids ${item.class}`],
    );
  return null;
}

/** missing-provenance: the provenance cannot be traced to the model or session entry it came from. */
export function missingProvenance(item: MemoryItem, _ctx?: LintContext): DetFinding | null {
  const p = item.provenance;
  const gaps: string[] = [];
  if ((p.kind === "model" || p.kind === "compaction") && p.model === undefined)
    gaps.push(`kind ${p.kind} names no model`);
  if (p.kind === "compaction" && p.session_entry_id === undefined)
    gaps.push("kind compaction names no session_entry_id");
  if (p.ref.trim() === "") gaps.push("ref is blank");
  if (gaps.length === 0) return null;
  return finding("missing-provenance", item, "its provenance cannot be traced to its origin", gaps);
}

/** orphan: the ref or a lineage id names an item that is gone. */
export function orphan(item: MemoryItem, ctx: LintContext): DetFinding | null {
  const superseded = promotionRuleId(ctx.policy, "superseded");
  const gone = (id: string, lineage: boolean): string | null => {
    const target = ctx.items.get(id);
    if (target === undefined || !ctx.canReach(target)) return "names no item you can reach";
    if (target.status !== "retired") return null;
    const by = ctx.retiredBy.get(id);
    if (lineage && by?.op === "retire" && by.policy_id === superseded) return null;
    return by === undefined ? "names a retired item" : `names an item retired by ${by.policy_id}`;
  };
  const evidence: string[] = [];
  const ref = refItemId(item.provenance.ref);
  if (ref !== null) {
    const why = gone(ref, false);
    if (why) evidence.push(`provenance.ref ${ref} ${why}`);
  }
  for (const id of item.lineage) {
    const why = gone(id, true);
    if (why) evidence.push(`lineage ${id} ${why}`);
  }
  if (evidence.length === 0) return null;
  return finding(
    "orphan",
    item,
    "its provenance ref or lineage names an item that is gone",
    evidence,
  );
}

/**
 * duplicate: every active item of one scope and class with the same strict
 * content hash (ADR 0018) as an earlier one by id; the earliest is kept and
 * not flagged. Takes the scope's active items, in any order.
 */
export function duplicates(items: readonly MemoryItem[]): DetFinding[] {
  const first = new Map<string, MemoryItem>();
  const out: DetFinding[] = [];
  for (const item of [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const hash = strictContentHash(item.content);
    const key = `${item.scope}\u0000${item.class}\u0000${hash}`;
    const kept = first.get(key);
    if (kept === undefined) first.set(key, item);
    else
      out.push(
        finding(
          "duplicate",
          item,
          `it restates ${kept.id}, an earlier active ${item.class} item in ${item.scope}`,
          [`duplicate of ${kept.id}`, `strict content hash ${hash}`],
        ),
      );
  }
  return out;
}

const PER_ITEM = {
  "expired-validity": expiredValidity,
  "source-changed": sourceChanged,
  "scope-class-mismatch": scopeClassMismatch,
  "missing-provenance": missingProvenance,
  orphan,
} as const;

/** Is `id` a deterministic lint id. */
export function isDeterministicLint(id: string): id is DeterministicLintId {
  return (DETERMINISTIC_LINT_IDS as readonly string[]).includes(id);
}

/**
 * Runs the deterministic lints `enabled` names over the active items of
 * `scope`, in the order of DETERMINISTIC_LINT_IDS, then by item id. Ids of
 * other tiers in `enabled` are ignored here.
 */
export function lintScope(
  ctx: LintContext,
  scope: string,
  enabled: readonly string[],
): DetFinding[] {
  const active = [...ctx.items.values()]
    .filter((i) => i.scope === scope && i.status === "active")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: DetFinding[] = [];
  for (const lintId of DETERMINISTIC_LINT_IDS) {
    if (!enabled.includes(lintId)) continue;
    if (lintId === "duplicate") {
      out.push(...duplicates(active));
      continue;
    }
    for (const item of active) {
      const f = PER_ITEM[lintId](item, ctx);
      if (f) out.push(f);
    }
  }
  return out;
}
