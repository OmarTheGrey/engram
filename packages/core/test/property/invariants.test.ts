// The invariants (docs/conventions/testing.md, "The invariants are always on").
// Owned by the lead: changing this file needs a second reviewer and a
// `decision` log entry. It never has a skip.
//
// All eight run against the real Plane (createPlane), with the read filter of
// card E2.2, the write gate of card E2.3 and retention of card E2.4, under
// random policies. Invariants 6 and 7 (card RV4) judge adoption: it never
// records a kind more trusted, or a grant, that the plane does not hold for
// the item's id (see adoptionCase at the end of this file). Invariant 8
// (card E2.11, ADR 0040) judges the trust floors with both options on: no
// committed item more trusted than its actor attests, and no write or
// eviction by a less trusted source that changes or removes a more trusted
// active item unless its owner acted as user (see trustWalk). Invariants
// 1 and 2 were red by design against a stub that admitted everything until
// those cards landed (issue #1); they are now asserted directly, in `make test`
// and in `make test-invariants` alike. A failure prints the counterexample and
// the seed. Each invariant runs RUNS cases.
//
// Invariant 1 stores its items under ADMIT_ALL, by a writer who is a member of
// every item's scope, and reads them under the random policy. The read filter
// decides item by item, so a store holding every item a random write policy
// would admit, and more, can only find more counterexamples; with the random
// policy on both sides almost no write lands and the reads come back empty.
// For the same reason half the readers are also made members of some of the
// items' scopes. Reads run with and without query text, on a store with and
// without search (finding R5-2), at instants that collide with grant expiries
// (finding R5-11). Guards fail the test unless the run admitted an item by
// scope and one by grant, excluded a stored item by scope and one by a
// grant's class or expiry, and met a grant expiring exactly at the read time,
// so the property cannot pass vacuously.
//
// Invariant 2's oracle also forbids a write by a non-member of the item's
// scope and a write carrying a grant the gate refuses (decision D4 of the
// review fix pass), and model or compaction content outside person scope
// (source isolation, ADR 0004 and 0007; round 2 of the fix pass); writers
// sometimes carry a harness-set source, which the oracle judges instead of
// the item's claimed provenance. Besides random writes, it generates writes
// the policy's rule admits that are forbidden only by a grant without a
// class, a grant without an expiry, or source isolation, and its guard
// requires each, so a gate that drops any of those checks fails it.
// Invariant 1 ignores validity and status on purpose: it is a soundness
// check, and a filter that admits fewer items cannot break it.
//
// Retention (card E2.4, ADR 0025; a `decision` log entry records the change):
// invariant 1's oracle excludes an item past its ttl, and its items carry
// their own ttl in a third of the cases, under policies whose retention rules
// set ttls but no budgets; a guard requires an item readable but for its ttl,
// read exactly when the ttl runs out. Invariant 2's oracle forbids a model,
// compaction or tool write restating content an allowed retire or evict
// event retired in its scope, compared by the oracle's own normal form; the
// generated case retires its item by an event, never by writing it retired
// (review findings P4-3, P4-7). Invariant 5 runs sequences of writes (ids
// reused from a pool), batches of writes and a sweep called together,
// reads, adoptions of store items and sweeps by a user, a session and an
// outsider, some under a tightened policy, under budgeted policies. Every
// write's budget check, adoption's included, follows its write event
// directly and evicts exactly the oracle's victims (budgetVictims, never
// the item just written, items past their ttl holding no slot); every sweep
// does exactly what the oracle says (expiry only by a user or in the actor's
// own person scope, then the budgets; a manual ask once per state; a
// non-member refused); no recency or utility budget is exceeded by items not
// past their ttl at the end; every retire and evict event names a reason
// and a rule; replay reproduces the state. Replay reproduces utility
// evictions as events but could not re-decide them: reads are not in the
// log (P4-5). The guard requires each kind of step and outcome.
//
// Promotion (card E2.5, ADR 0026; a `decision` log entry records the change):
// invariant 2 also runs promotions. Each case writes an item and a sequence
// of restatements of its content (same and different actors, trusted and
// untrusted kinds, in its scope and outside it) and promotes it, sometimes as
// a review, under a random policy. A promotion that lands must be one
// `promotionPermitted` allows from the log (k distinct trusted actors, or a
// reviewer who is user-sourced, a member of the target and not the owner),
// its item one `writeForbidden` lets into the target, with a provenance kind
// no more trusted than its source's; one that does not land changes nothing.
// Guards require landings by confirmation and by review, an ask, refusals
// where only the distinct-actor rule, only the trusted-kind rule, only the
// owner-as-reviewer rule or only the target's write rule stood in the way.
// Invariant 1 also checks the Plane's surface (2606.24535, MemClaw's
// get-by-id bypass): no method other than `read` returns an item, except
// `write` and `promote` returning the caller's own item, and `events`, the
// audit log no surface passes to a model; a promoter who is not the owner
// and cannot read the item learns nothing from promote (review fix pass,
// finding P5-7). Since that pass invariant 2's promotions also exercise
// authors who are not owners, items past their ttl, widenings by actors
// that are not user-sourced, duplicates in the target, confirmers retired
// before the promotion and promoters who cannot read the item, and the
// oracle judges all of it from its own replay of the events. Since the
// verification of that pass, sources also carry live read grants (a grantee
// who is not a member never lands a promotion, P5-15) and sometimes a tag
// character payload (never promoted, P5-14); restatements are sometimes by
// the item's own author; reviewers who confirmed are refused (P5-16); and a
// guard requires a refusal that only retired confirmers caused (P5-17).
// Since card E9.9 (ADR 0049, amending ADR 0026) the owner, user-sourced, at
// the person level, may also accept a semantic candidate in place in their
// own person scope; a second run draws cases around that rule, its oracle
// reading is promotionPermitted's own, and guards require an acceptance that
// lands with the item's provenance and confidence unchanged, and the same
// asked by any other source refused.
//
// Invariant 1 also runs across two handles over one log and one store (card
// E2.6, ADR 0007's amendment of 2026-11-19; a `decision` log entry records
// the change): a walk of two handles' operations, an offboarding among them,
// under every interleaving a scheduler picks at the store's calls, after
// which no erased item is read, projected, rebuilt, stored or adopted again,
// and the store holds what the projection holds. See twoHandleWalk.
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Adapter } from "../../src/adapter.ts";
import { strictContentHash } from "../../src/content-hash.ts";
import type { Db } from "../../src/db/db.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { REPLAY_SEEDS, REPLAY_THRESHOLD } from "../../src/distill/validate.ts";
import { allEvents, appendEvent, currentItems, eventsByItem, rebuild } from "../../src/events.ts";
import { itemById } from "../../src/items.ts";
import { erasureOpen } from "../../src/plane/commit.ts";
import { accessTime } from "../../src/plane/read.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  ExplainDeniedError,
  InvalidCallError,
  NotImplementedYet,
  offboard,
  type Plane,
  type PlaneDeps,
} from "../../src/plane.ts";
import { sameGrant } from "../../src/policy/evaluate.ts";
import { parsePolicy } from "../../src/policy/load.ts";
import { itemsAt } from "../../src/replay.ts";
import type { Grant, MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import { addSeconds, compareTimestamps } from "../../src/time.ts";
import { disclosedEvent } from "../../src/visible.ts";
import {
  arbActor,
  arbGatedGrant,
  arbGatedItem,
  arbGatedItemWithTtl,
  arbGrantedItem,
  arbInstant,
  arbPolicy,
  arbPolicyWithTtls,
  arbTimestamp,
  arbWriter,
  seedFor,
} from "../generators.ts";
import {
  attestedKind,
  budgetVictims,
  floorProblem,
  grantsAlike,
  pastTtl,
  patternCovers,
  promotionPermitted,
  protectionProblem,
  readable,
  replayEvent,
  sameContent,
  sameStrictContent,
  TRUST,
  writeForbidden,
} from "./oracle.ts";

const RUNS = 1000;
/** The two-handle walk opens a log per run and interleaves two operation lists: fewer runs. */
const RUNS_TWO_HANDLES = 300;

function freshPlane(policy: Policy, search = true, distillTasks?: ReadonlyMap<string, string>) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter({ search });
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const plane: Plane = createPlane({
    db,
    adapter,
    policy,
    newId,
    ...(distillTasks === undefined ? {} : { distillTasks }),
  });
  /** A plane over the same log and store that writes under `other`. */
  const under = (other: Policy): Plane => createPlane({ db, adapter, policy: other, newId });
  return { db, adapter, plane, under, newId };
}

/** Every class from every source at every level, no floor, no review. */
const ADMIT_ALL: Policy = {
  id: "admit-all",
  version: 1,
  write: (["person", "role", "team", "org"] as const).map((scope) => ({
    scope,
    allowed_sources: ["user", "document", "tool", "model", "import", "compaction", "external"],
    confidence_floor: 0,
    forbidden_classes: [],
    requires_review: false,
  })),
  read: { matrix: [], honour_grants: false },
  retention: [],
  promotion: {
    episodic_to_semantic: { confirmations: 1, or_review: true },
    procedural: { replay_k: 1, replay_n: 1 },
  },
  lints: { enabled: [], thresholds: {} },
  schema_version: 1,
};

const uniqueItems = fc.uniqueArray(arbGrantedItem, { selector: (i) => i.id, maxLength: 6 });
const uniqueGatedItems = fc.uniqueArray(arbGatedItemWithTtl, {
  selector: (i) => i.id,
  maxLength: 6,
});

/** `actor`, made a member of a subset of `scopes` as well. */
const joining = (actor: fc.Arbitrary<Actor>, scopes: string[]) =>
  fc.tuple(actor, fc.subarray(scopes)).map(([a, extra]) => ({
    ...a,
    memberships: [...new Set([...a.memberships, ...extra])],
  }));

/**
 * Items and an actor who is, in half the cases, also a member of some of the
 * items' scopes, so that reads by scope (and writes by members) are exercised.
 */
const itemsAnd = (items: fc.Arbitrary<MemoryItem[]>, actor: fc.Arbitrary<Actor>) =>
  items.chain((list) => {
    const scopes = [...new Set(list.map((i) => i.scope))];
    return fc.tuple(fc.constant(list), fc.oneof(actor, joining(actor, scopes)));
  });

/** Query text: none, a word of one of the items, or a word none of them has. */
const arbText = (items: MemoryItem[]) => {
  const words = items.flatMap((i) =>
    (typeof i.content === "string" ? i.content : JSON.stringify(i.content))
      .split(/\s+/)
      .filter(Boolean),
  );
  // No text in half the cases, so every stored item is a candidate.
  const options = [
    { arbitrary: fc.constant<string | undefined>(undefined), weight: 3 },
    { arbitrary: fc.constant<string | undefined>("no-item-has-this-word"), weight: 1 },
  ];
  if (words.length > 0)
    options.push({ arbitrary: fc.constantFrom<string | undefined>(...words), weight: 2 });
  return fc.oneof(...options);
};

/** The reader as generated, or, as often, renamed to a principal some grant names exactly. */
const namedByAGrant = (items: MemoryItem[], reader: Actor) => {
  const named = items.flatMap((i) => i.grants.map((g) => g.to)).filter((to) => !to.includes("*"));
  return named.length === 0
    ? fc.constant(reader)
    : fc.oneof(
        fc.constant(reader),
        fc.constantFrom(...named).map((id) => ({ ...reader, id })),
      );
};

/**
 * A read time from the colliding pool, or, as often, exactly a grant's
 * expiry, a validity start, or the instant an item's own ttl runs out.
 */
const atABoundary = (items: MemoryItem[]) => {
  const edges = items.flatMap((i) => [
    i.valid_from,
    ...i.grants.flatMap((g) => g.expires ?? []),
    ...(i.ttl === null ? [] : [addSeconds(i.valid_from, i.ttl)].flatMap((t) => t ?? [])),
  ]);
  return edges.length === 0 ? arbInstant : fc.oneof(arbInstant, fc.constantFrom(...edges));
};

/** Before every generated expiry. */
const EARLY = "2026-01-01T00:00:00Z";

/**
 * One grant made the case: its item active, of the grant's class, valid from
 * the read time; the reader, when the grant names a principal, that
 * principal; the read exactly at the grant's expiry, where the grant must not
 * admit and a `>=` expiry check would (finding R5-11), or before every
 * expiry, where it admits.
 */
const onAGrant = (items: MemoryItem[], reader: Actor) => {
  const pairs = items.flatMap((item, i) => item.grants.map((_, k) => [i, k] as const));
  if (pairs.length === 0) return fc.tuple(fc.constant(items), fc.constant(reader), arbInstant);
  return fc.tuple(fc.constantFrom(...pairs), fc.boolean()).map(([[i, k], onExpiry]) => {
    const target = items[i] as MemoryItem;
    const g = target.grants[k] as MemoryItem["grants"][number];
    const at = onExpiry ? (g.expires ?? EARLY) : EARLY;
    const focused = {
      ...target,
      status: "active",
      valid_from: at,
      grants: target.grants.map((x, j) => (j === k ? { ...x, class: target.class } : x)),
    } as MemoryItem;
    const list = items.map((it, j) => (j === i ? focused : it));
    const named = g.to.includes("*") ? reader : { ...reader, id: g.to };
    return [list, named, at] as const;
  });
};

const levelOf = (scope: string) =>
  (scope === "org" ? "org" : scope.split(":")[0]) as Policy["write"][number]["scope"];

/** The policy's write rule for the item's level admits its class, effective source and confidence. */
function admittedByRule(policy: Policy, actor: Actor, item: MemoryItem) {
  const rule = policy.write.find((r) => r.scope === levelOf(item.scope));
  const kind = actor.source ?? item.provenance.kind;
  return (
    rule !== undefined &&
    !rule.forbidden_classes.includes(item.class) &&
    rule.allowed_sources.includes(kind) &&
    item.confidence >= rule.confidence_floor
  );
}

/** `policy` with its rule for `scope`'s level replaced by one admitting `kinds` at any confidence. */
const admitting = (policy: Policy, scope: string, kinds: MemoryItem["provenance"]["kind"][]) => {
  const level = levelOf(scope);
  const rule = {
    scope: level,
    allowed_sources: kinds,
    confidence_floor: 0,
    forbidden_classes: [],
    requires_review: false,
  };
  return { ...policy, write: [...policy.write.filter((r) => r.scope !== level), rule] };
};

/**
 * An item put in the written scope before the write, and how it ended up
 * retired: by an allowed retire event (it blocks restating writes), or
 * planted, written with status retired or retired by its own ttl, which
 * blocks nothing (review findings P4-3 and P4-13).
 */
interface Prior {
  item: MemoryItem;
  how: "retire-event" | "written-retired" | "own-ttl";
}

/**
 * A policy, the item and its writer, and items already retired in the
 * written scope before the write (the retired-content rule, ADR 0025).
 */
type WriteCase = readonly [Policy, readonly [MemoryItem[], Actor], readonly Prior[]];

/**
 * A write forbidden only by a grant without a class or without an expiry
 * (follow-up I-3 of the second review): a member writes a trusted source the
 * policy's rule admits, carrying one otherwise acceptable grant with one term
 * dropped. A gate that stopped requiring either term would let it land.
 */
const grantTermsOnly: fc.Arbitrary<WriteCase> = fc
  .tuple(
    arbPolicy,
    arbGrantedItem,
    arbWriter,
    arbGatedGrant,
    fc.constantFrom("class", "expires"),
    fc.constantFrom<MemoryItem["provenance"]["kind"]>("user", "document", "tool", "import"),
  )
  .map(([policy, item, writer, grant, drop, kind]) => {
    const faulty =
      drop === "class"
        ? { to: grant.to, mode: grant.mode, expires: grant.expires }
        : { to: grant.to, mode: grant.mode, class: grant.class };
    const written = {
      ...item,
      provenance: { ...item.provenance, kind },
      grants: [faulty],
    } as MemoryItem;
    const actor = {
      ...writer,
      source: kind,
      memberships: [...new Set([...writer.memberships, item.scope])],
    };
    return [admitting(policy, item.scope, [kind]), [[written], actor], []] as const;
  });

/**
 * A write forbidden only by the grant cap or the first-write rule (card E2.21,
 * ADR 0034, decisions 3 and 6), under a policy that turns grants.expiry_cap
 * on: a member's first write of a trusted source the rule admits, carrying
 * one grant the gate's grant rule accepts that expires after 2029 (past the
 * cap for every write time arbTimestamp draws, which ends in 2027), expired
 * before 2026 (by every write time), or names another class than the item's.
 * A gate that dropped the cap or the first-write rule would let it land.
 */
const capOnly: fc.Arbitrary<WriteCase> = fc
  .tuple(
    arbPolicy,
    arbGrantedItem,
    arbWriter,
    arbGatedGrant,
    fc.constantFrom("past-cap", "expired", "other-class"),
    fc.integer({ min: 0, max: 86_400 * 3650 }),
    fc.constantFrom<MemoryItem["provenance"]["kind"]>("user", "document", "tool", "import"),
  )
  .map(([policy, item, writer, grant, how, offset, kind]) => {
    const year = (y: number) => new Date(Date.UTC(y, 0, 1) + offset * 1000).toISOString();
    const other = (["episodic", "semantic", "procedural"] as const).find((c) => c !== item.class);
    const capped: Grant =
      how === "past-cap"
        ? { ...grant, class: item.class, expires: year(2030) }
        : how === "expired"
          ? { ...grant, class: item.class, expires: year(2010) }
          : { ...grant, class: other, expires: year(2030) };
    const written = { ...item, provenance: { ...item.provenance, kind }, grants: [capped] };
    const actor = {
      ...writer,
      source: kind,
      memberships: [...new Set([...writer.memberships, item.scope])],
    };
    const on: Policy = {
      ...admitting(policy, item.scope, [kind]),
      grants: { expiry_cap: "on" },
    };
    return [on, [[written as MemoryItem], actor], []] as const;
  });

/**
 * A write forbidden only by source isolation (follow-up I-1): a member's
 * model or compaction content, without grants, into a role, team or org
 * scope whose rule admits that source.
 */
const isolationOnly: fc.Arbitrary<WriteCase> = fc
  .tuple(
    arbPolicy,
    arbGrantedItem,
    arbWriter,
    fc.constantFrom<MemoryItem["provenance"]["kind"]>("model", "compaction", "external"),
    fc.constantFrom("role:a", "team:b", "org"),
  )
  .map(([policy, item, writer, kind, scope]) => {
    const written = { ...item, scope, grants: [] } as MemoryItem;
    const actor = {
      ...writer,
      source: kind,
      memberships: [...new Set([...writer.memberships, scope])],
    };
    return [admitting(policy, scope, [kind]), [[written], actor], []] as const;
  });

/** Upper-cases the ASCII letters of every string in `content` and pads text with whitespace. */
const restated = (content: MemoryItem["content"]): MemoryItem["content"] => {
  // Upper case, doubled spaces and a zero-width space (finding P4-7).
  const loud = (s: string) => `\u200B${s.replace(/[a-z]/g, (c) => c.toUpperCase())}`;
  if (typeof content === "string") return `  ${loud(content).replace(/ /g, "  ")}\n`;
  return Object.fromEntries(
    Object.entries(content).map(([k, v]) => [k, typeof v === "string" ? loud(v) : v]),
  ) as MemoryItem["content"];
};

/** An id no generated item has (generated ids carry a random version-7 body). */
const RETIRED_ID = "01900000-0000-7000-8000-000000000000";
/** The retire event's id; freshPlane's event ids count up from ...0001. */
const RETIRE_EVENT_ID = "01900000-0000-7000-8000-0000000000ff";

/**
 * The projected items whose last allowed changing event retired them: what
 * an allowed retire or evict event retired, read from the log, not from the
 * plane's own helper. Two retirements are not retired content (review
 * finding P5-6): a source a promotion superseded, whose content lives on in
 * its new version, and content an active item in the same scope still holds.
 */
function retiredByEvent(db: Parameters<typeof allEvents>[0]): MemoryItem[] {
  const last = new Map<string, MemoryEvent>();
  for (const e of allEvents(db))
    if (e.decision === "allow" && e.item_id !== null && CHANGING.includes(e.op))
      last.set(e.item_id, e);
  const items = currentItems(db);
  return items.filter((i) => {
    const e = last.get(i.id);
    if (!e || !["retire", "evict"].includes(e.op)) return false;
    // Expiry by the item's own ttl was its writer's choice: no evidence (P4-13).
    if (e.policy_id === "engram/retention/item-ttl") return false;
    if (e.policy_id.endsWith("/promotion/superseded")) return false;
    return !items.some(
      (a) => a.status === "active" && a.scope === i.scope && sameContent(a.content, i.content),
    );
  });
}

const CHANGING: readonly string[] = ["write", "update", "promote", "retire", "evict"];

/**
 * A write forbidden only by retired content (ADR 0025): a member's model,
 * compaction or tool write, without grants, into a scope whose rule admits
 * that source (person scope for model and compaction, which source isolation
 * keeps there), restating, in other case and spacing and with a zero-width
 * space, an item an allowed retire event retired in that scope. A gate that
 * dropped the rule, or a source from its list, would let it land. The item is
 * written active and then retired by an event: an item written with status
 * retired was retired by nobody and blocks nothing (review finding P4-3).
 */
const restatingCase = (hows: readonly Prior["how"][]): fc.Arbitrary<WriteCase> =>
  fc
    .tuple(
      arbPolicy,
      arbGrantedItem,
      arbWriter,
      fc.constantFrom<MemoryItem["provenance"]["kind"]>("model", "compaction", "tool", "external"),
      fc.constantFrom("person:a", "role:a", "team:b", "org"),
      fc.constantFrom(...hows),
    )
    .map(([policy, item, writer, kind, wide, how]) => {
      const scope = kind === "tool" ? wide : "person:a";
      const written = { ...item, scope, grants: [] } as MemoryItem;
      const retired = {
        ...item,
        id: RETIRED_ID,
        scope,
        grants: [],
        status: "active",
        provenance: { ...item.provenance, kind: "user" },
        content: restated(item.content),
      } as MemoryItem;
      const actor = {
        ...writer,
        source: kind,
        memberships: [...new Set([...writer.memberships, scope])],
      };
      return [
        admitting(policy, scope, [kind]),
        [[written], actor],
        [{ item: { ...retired, status: how === "written-retired" ? "retired" : "active" }, how }],
      ] as const;
    });

const retiredContentOnly = restatingCase(["retire-event"]);

/**
 * The same restating write, after an item planted as retired: written with
 * status retired, or retired only by its own ttl. Nothing forbids it, and it
 * must land (P4-3 and P4-13): a gate that counted either as retired content
 * would deny it.
 */
const plantedOnly = restatingCase(["written-retired", "own-ttl"]);

/**
 * One item made readable but for its own ttl: active, admitted by a live
 * grant of its class naming the reader (when the policy honours grants), with
 * a ttl of one second, read exactly when the ttl runs out (where a `<`
 * expiry check would admit it) or a nanosecond before (where it is live).
 */
const onATtl = (items: MemoryItem[], reader: Actor) => {
  const pairs = items.flatMap((item, i) => item.grants.map((_, k) => [i, k] as const));
  if (pairs.length === 0) return fc.tuple(fc.constant(items), fc.constant(reader), arbInstant);
  return fc.tuple(fc.constantFrom(...pairs), fc.boolean()).map(([[i, k], onEnd]) => {
    const target = items[i] as MemoryItem;
    const g = target.grants[k] as MemoryItem["grants"][number];
    const focused = {
      ...target,
      status: "active",
      ttl: 1,
      grants: target.grants.map((x, j) =>
        j === k ? { ...x, class: target.class, expires: "2099-01-01T00:00:00Z" } : x,
      ),
    } as MemoryItem;
    const end = addSeconds(focused.valid_from, 1) as string;
    const list = items.map((it, j) => (j === i ? focused : it));
    const named = g.to.includes("*") ? reader : { ...reader, id: g.to };
    return [list, named, onEnd ? end : justBefore(end)] as const;
  });
};

/** The instant a nanosecond before `ts` (fractions of at most nine digits). */
function justBefore(ts: string): string {
  const [whole, frac = ""] = ts.replace(/Z$/, "").split(".");
  const ns = BigInt(frac.padEnd(9, "0").slice(0, 9));
  if (ns > 0n) return `${whole}.${String(ns - 1n).padStart(9, "0")}Z`;
  const prev = addSeconds(`${whole}Z`, -1) as string;
  return `${prev.replace(/Z$/, "")}.999999999Z`;
}

const contentOf = (i: MemoryItem) =>
  (typeof i.content === "string" ? i.content : JSON.stringify(i.content)).toLowerCase();

describe("invariants", () => {
  const I1 = "invariant 1: no read returns an item the actor's scope and grants exclude";
  test(I1, async () => {
    await planeSurfaceLeaksNothing();
    const seen = {
      byScope: 0,
      byGrant: 0,
      exclScope: 0,
      exclGrant: 0,
      expiryAtRead: 0,
      pastTtl: 0,
      ttlAtRead: 0,
    };
    await fc.assert(
      fc.asyncProperty(
        arbPolicyWithTtls,
        arbActor,
        itemsAnd(uniqueGatedItems, arbActor)
          .chain(([items, reader]) =>
            fc.oneof(
              fc.tuple(fc.constant(items), namedByAGrant(items, reader), atABoundary(items)),
              onAGrant(items, reader),
              onATtl(items, reader),
            ),
          )
          .chain(([items, reader, at]) =>
            fc.tuple(fc.constant([items, reader, at] as const), arbText(items), fc.boolean()),
          ),
        async (policy, writer, [[items, reader, at], text, search]) => {
          const { plane, under } = freshPlane(policy, search);
          const store = under(ADMIT_ALL);
          const scopes = items.map((i) => i.scope);
          const member = { ...writer, memberships: [...new Set(scopes)] };
          for (const item of items) await store.write(member, item, at);
          const { items: read, explanations } = await plane.read(reader, { text, at });
          for (const e of explanations) seen[e.grants_used.length > 0 ? "byGrant" : "byScope"]++;
          for (const item of read) {
            expect(
              readable(policy, reader, item, at),
              `read returned ${item.id} (scope ${item.scope}) to ${reader.id} reading as ${reader.level}, member of [${reader.memberships.join(", ")}], with no admitting grant, query ${JSON.stringify(text)}`,
            ).toBe(true);
          }
          const returned = new Set(read.map((i) => i.id));
          const terms = (text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
          for (const item of items) {
            const matches = terms.every((t) => contentOf(item).includes(t));
            const active = item.status === "active" && compareTimestamps(item.valid_from, at) <= 0;
            // An item the reader could see but for its ttl (ADR 0025): the
            // read must leave it out, which the assertion above checks.
            if (
              active &&
              pastTtl(policy, item, at) &&
              readable({ ...policy, retention: [] }, reader, { ...item, ttl: null }, at)
            ) {
              seen.pastTtl++;
              // Expired exactly at the read time: a `<` where `<=` belongs would admit it.
              const rule = policy.retention.find(
                (r) => r.scope === levelOf(item.scope) && r.class === item.class,
              );
              const ttls = [item.ttl, rule?.ttl ?? null].filter((t): t is number => t !== null);
              const end = addSeconds(item.valid_from, Math.min(...ttls));
              if (end !== null && compareTimestamps(end, at) === 0) seen.ttlAtRead++;
            }
            const live = active && !pastTtl(policy, item, at);
            // The boundary a `>=` expiry check gets wrong: an excluded live item whose
            // grant names the reader, for its class, and expires exactly at the read time.
            if (live && policy.read.honour_grants && !readable(policy, reader, item, at))
              for (const g of item.grants)
                if (
                  patternCovers(g.to, reader.id) &&
                  (g.class === undefined || g.class === item.class) &&
                  g.expires !== undefined &&
                  compareTimestamps(g.expires, at) === 0
                )
                  seen.expiryAtRead++;
            if (!live || !matches || returned.has(item.id) || readable(policy, reader, item, at))
              continue;
            const covered =
              policy.read.honour_grants && item.grants.some((g) => patternCovers(g.to, reader.id));
            seen[covered ? "exclGrant" : "exclScope"]++;
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I1) },
    );
    expect(
      Object.values(seen).every((n) => n > 0),
      `the run must admit by scope and by grant, exclude by scope and by a grant's terms, meet a grant expiring at the read time, and meet an item readable but for its ttl; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  }, 120_000);

  const I1H =
    "invariant 1 across two handles: no reader gets an erased item back, and the store holds the projection, whatever the interleaving";
  test(I1H, async () => {
    const seen: WalkSeen = {
      erased: 0,
      grantedReads: 0,
      refusedStale: 0,
      crashes: 0,
      offboardCrashes: 0,
      removalsKept: 0,
      recoveries: 0,
      derivedChecked: 0,
      purged: 0,
      erasedLeft: 0,
    };
    await fc.assert(
      fc.asyncProperty(fc.scheduler(), arbWalk, (s, walk) => twoHandleWalk(s, walk, seen)),
      { numRuns: RUNS_TWO_HANDLES, seed: seedFor(I1H) },
    );
    expect(
      Object.values(seen).every((n) => n > 0),
      `the two-handle walk needs erasures, reads a grant admitted, stale decisions refused under the lock, crashed writers, and records an adoption deleted; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  }, 240_000);

  const I2 = "invariant 2: no write lands in a scope whose policy forbids its class or source";
  test(I2, async () => {
    const seen = {
      landed: 0,
      forbidden: 0,
      noClass: 0,
      noExpiry: 0,
      isolation: 0,
      retired: 0,
      planted: 0,
      capped: 0,
    };
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          {
            arbitrary: fc.tuple(
              arbPolicy,
              itemsAnd(
                arbGrantedItem.map((i) => [i]),
                arbWriter,
              ),
              fc.constant([] as readonly Prior[]),
            ),
            weight: 3,
          },
          { arbitrary: grantTermsOnly, weight: 1 },
          { arbitrary: capOnly, weight: 1 },
          { arbitrary: isolationOnly, weight: 1 },
          { arbitrary: retiredContentOnly, weight: 1 },
          { arbitrary: plantedOnly, weight: 1 },
        ),
        arbTimestamp,
        async ([policy, [[item], actor], retired], at) => {
          if (!item) return;
          const { db, adapter, plane, under } = freshPlane(policy);
          // Items retired before the write: written by a member, then
          // retired by an allowed retire event (ADR 0010: retired by event).
          for (const { item: r, how } of retired) {
            const owner = { id: r.owner, level: "person" as const, memberships: [r.scope] };
            const { event } = await under(ADMIT_ALL).write(owner, r, at);
            expect(event.decision, "the item to retire lands").toBe("allow");
            if (how === "written-retired") continue;
            appendEvent(db, {
              id: RETIRE_EVENT_ID,
              ts: at,
              op: "retire",
              item_id: r.id,
              actor: owner.id,
              scope_from: null,
              scope_to: r.scope,
              decision: "allow",
              reason: "retired before the write under test",
              policy_id: how === "own-ttl" ? "engram/retention/item-ttl" : "test/retire",
              schema_version: 1,
            });
          }
          const projected = retiredByEvent(db);
          // The version of the item's id before the write, for the grant cap
          // (card E2.21): what the write adds is judged, not what it keeps.
          const before = currentItems(db).find((x) => x.id === item.id);
          const { item: stored } = await plane.write(actor, item, at);
          if (stored) seen.landed++;
          // A restating write after a planted retirement is forbidden by nothing: it lands.
          if (retired.some((r) => r.how !== "retire-event")) {
            expect(
              writeForbidden(policy, actor, item, projected),
              "a planted retirement is no retired content",
            ).toBe(false);
            expect(
              stored,
              `a restating write after a ${retired[0]?.how} plant must land`,
            ).not.toBeNull();
            seen.planted++;
          }
          // Writes forbidden by exactly one condition a mutant could drop: a
          // grant's missing class or expiry, or source isolation; each would
          // land if the policy's rule were all the gate checked.
          const repaired = {
            ...item,
            grants: item.grants.map((g) => ({
              ...g,
              class: g.class ?? item.class,
              expires: g.expires ?? "2099-01-01T00:00:00Z",
            })),
          };
          const otherwiseLands = admittedByRule(policy, actor, item);
          const forbidden = writeForbidden(policy, actor, item, projected, { at, before });
          // Forbidden only by the grant cap or the first-write rule (card E2.21).
          if (otherwiseLands && forbidden && !writeForbidden(policy, actor, item, projected))
            if (policy.grants?.expiry_cap === "on") seen.capped++;
          // Forbidden only because it restates retired content.
          if (
            otherwiseLands &&
            writeForbidden(policy, actor, item, projected) &&
            !writeForbidden(policy, actor, item)
          )
            seen.retired++;
          if (otherwiseLands && writeForbidden(policy, actor, item)) {
            if (!writeForbidden(policy, actor, repaired)) {
              if (item.grants.some((g) => g.class === undefined)) seen.noClass++;
              if (item.grants.some((g) => g.expires === undefined)) seen.noExpiry++;
            }
            if (
              item.grants.length === 0 &&
              ["model", "compaction", "external"].includes(actor.source ?? item.provenance.kind) &&
              actor.memberships.includes(item.scope)
            )
              seen.isolation++;
          }
          if (forbidden) {
            seen.forbidden++;
            const inStore = (await adapter.list(item.scope)).map((i) => i.id);
            const projected = currentItems(db).map((i) => i.id);
            expect(
              [...inStore, ...projected],
              `${item.class === "episodic" ? "an" : "a"} ${item.class} item from source ${actor.source ?? item.provenance.kind}, with grants ${JSON.stringify(item.grants)}, written by ${actor.id} (member of [${actor.memberships.join(", ")}]), landed in ${item.scope}, which policy ${policy.id} forbids`,
            ).not.toContain(item.id);
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I2) },
    );
    expect(
      seen.landed > 0 &&
        seen.forbidden > 0 &&
        seen.noClass > RUNS / 50 &&
        seen.noExpiry > RUNS / 50 &&
        seen.isolation > RUNS / 50 &&
        seen.retired > RUNS / 50 &&
        seen.planted > RUNS / 50 &&
        seen.capped > RUNS / 50,
      `invariant 2 needs writes that land, writes it forbids, and writes the policy's rule admits that are forbidden only by a grant without a class, a grant without an expiry, source isolation, retired content, or the grant cap and first-write rule; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
    await promotionsLandOnlyWherePermitted(`${I2}, promotions`);
  }, 240_000);

  const I3 =
    "invariant 3: every read or write appends exactly one event, and a denial carries a reason and a policy id";
  test(I3, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        itemsAnd(uniqueItems, arbWriter),
        arbTimestamp,
        async (policy, [items, actor], at) => {
          const { plane } = freshPlane(policy);
          const calls = [
            ...items.map((item) => () => plane.write(actor, item, at)),
            () => plane.read(actor, { at }),
          ];
          for (const call of calls) {
            const before = plane.events().length;
            const result = await call();
            const added = plane.events().slice(before);
            expect(added, "each call appends exactly one event").toHaveLength(1);
            expect(added[0]?.id).toBe(result.event.id);
            if (result.event.decision === "deny") {
              expect(added[0]?.reason).not.toBe("");
              expect(added[0]?.policy_id).not.toBe("");
            }
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I3) },
    );
  }, 120_000);

  const I4 =
    "invariant 4: replaying the events of any write sequence gives the same state, store and reads";
  test(I4, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        itemsAnd(uniqueItems, arbWriter),
        arbTimestamp,
        async (policy, [items, actor], at) => {
          const { db, adapter, plane } = freshPlane(policy);
          for (const item of items) await plane.write(actor, item, at);
          const state = currentItems(db);
          const reads = (await plane.read(actor, { at })).items.map((i) => i.id);
          rebuild(db);
          expect(currentItems(db)).toEqual(state);
          expect((await plane.read(actor, { at })).items.map((i) => i.id)).toEqual(reads);
          for (const item of state) {
            expect(
              item.store_ref,
              `${item.id} is in the projection but not in the store`,
            ).not.toBeNull();
            if (item.store_ref) expect(await adapter.read(item.store_ref)).toEqual(item);
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I4) },
    );
  }, 120_000);

  const I5 =
    "invariant 5: after any write sequence no scope holds more active items of a class than its budget, every retire or evict event carries a reason and a policy id, and replay reproduces them";
  test(I5, async () => {
    /** What a walk saw: each walk counts its own (verification finding V-6 of PR #44). */
    const counters = () => ({
      recency: 0,
      utility: 0,
      utilityByReads: 0,
      manual: 0,
      swept: 0,
      sweepEvicted: 0,
      reused: 0,
      concurrent: 0,
      adopted: 0,
      memberDenied: 0,
      ttlLeftToUser: 0,
      grantChanged: 0,
      grantAdmitted: 0,
      refusedAfterRemoval: 0,
      refusedForClass: 0,
      refusedForExpiry: 0,
      reclassed: 0,
      ownerRewroteGranted: 0,
      coholderRewriteRefused: 0,
      ownerMoved: 0,
      coholderMoveRefused: 0,
      coholderPromotedGranted: 0,
    });
    const first = counters();
    const second = counters();
    const walk = (seen: ReturnType<typeof counters>) => async (policy: Policy, steps: Step[]) => {
      const { db, adapter, plane, under, newId } = freshPlane(policy);
      /** How many times a read returned each item: the oracle's own count. */
      const reads = new Map<string, number>();
      const ruleFor = (p: Policy, scope: string, cls: MemoryItem["class"]) =>
        p.retention.find((r) => r.scope === levelOf(scope) && r.class === cls);
      const shown = (events: MemoryEvent[]) =>
        events.map((e) => `${e.op}/${e.decision} ${e.item_id}: ${e.reason}`).join("; ");

      /** Checks one write's budget check, `slot`, against the oracle at its write event. */
      const checkWrite = (w: MemoryEvent, slot: MemoryEvent[]) => {
        const it = w.item as MemoryItem;
        const after = itemsAt(db, w.seq);
        const active = after.filter(
          (x) =>
            x.scope === it.scope &&
            x.class === it.class &&
            x.status === "active" &&
            !pastTtl(policy, x, w.ts),
        );
        const rule = ruleFor(policy, it.scope, it.class);
        const changed = lastChanged(allEvents(db), w.seq);
        const expected =
          rule && rule.budget !== null
            ? budgetVictims(rule.eviction, rule.budget, active, changed, reads, it.id)
            : [];
        const got = slot.map((e) => [e.op, e.decision, e.item_id]);
        const why = `${shown(slot)} after writing ${it.id} (${it.class} in ${it.scope}) under ${JSON.stringify(rule)}`;
        if (expected === "ask") {
          seen.manual++;
          expect(got, `a manual overage asks once: ${why}`).toEqual([["evict", "ask", null]]);
          return;
        }
        expect(got, `the budget check evicts exactly the oracle's victims: ${why}`).toEqual(
          expected.map((v) => ["evict", "allow", v]),
        );
        if (expected.length > 0 && rule) {
          seen[rule.eviction === "recency" ? "recency" : "utility"]++;
          if (rule.eviction === "utility") {
            const byAge = budgetVictims("recency", rule.budget ?? 0, active, changed, reads, it.id);
            if (JSON.stringify(byAge) !== JSON.stringify(expected)) seen.utilityByReads++;
          }
        }
      };

      /** Checks one sweep's events against the oracle, given the log before it. */
      const checkSweep = (
        p: Policy,
        actor: Actor,
        scope: string,
        at: string,
        before: number,
        events: MemoryEvent[],
      ) => {
        const got = events.map((e) => [e.op, e.decision, e.item_id]);
        if (!actor.memberships.includes(scope)) {
          seen.memberDenied++;
          expect(got, "a non-member's sweep is one deny").toEqual([["retire", "deny", null]]);
          return;
        }
        const log = allEvents(db).filter((e) => e.seq <= before);
        const state = before < 0 ? [] : itemsAt(db, before);
        const changed = lastChanged(log, before);
        const byTtl =
          (scope.split(":")[0] === "person" && scope === actor.id) || actor.source === "user";
        const expected: (string | null)[][] = [];
        for (const cls of ["episodic", "semantic", "procedural"] as const) {
          const own = state.filter((x) => x.scope === scope && x.class === cls);
          const expired = own.filter((x) => x.status !== "retired" && pastTtl(p, x, at));
          if (byTtl) for (const x of expired) expected.push(["retire", "allow", x.id]);
          else if (expired.length > 0) seen.ttlLeftToUser++;
          const active = own.filter((x) => x.status === "active" && !pastTtl(p, x, at));
          const rule = ruleFor(p, scope, cls);
          if (!rule || rule.budget === null) continue;
          const victims = budgetVictims(rule.eviction, rule.budget, active, changed, reads);
          if (victims === "ask") {
            // Asked once per state: not again while nothing in the class changed.
            const policyId = `${p.id}/retention/${levelOf(scope)}/${cls}`;
            const asked = log
              .filter(
                (e) =>
                  e.op === "evict" &&
                  e.decision === "ask" &&
                  e.scope_to === scope &&
                  e.policy_id === policyId,
              )
              .at(-1)?.seq;
            const latest = Math.max(-1, ...own.map((x) => changed.get(x.id) ?? -1));
            if (asked === undefined || latest > asked) expected.push(["evict", "ask", null]);
            continue;
          }
          for (const v of victims) expected.push(["evict", "allow", v]);
        }
        expect(
          got,
          `the sweep of ${scope} by ${actor.id} (${actor.source}) at ${at}: ${shown(events)}`,
        ).toEqual(expected);
        seen.swept += events.filter((e) => e.op === "retire").length;
        seen.sweepEvicted += events.filter(
          (e) => e.op === "evict" && e.decision === "allow",
        ).length;
      };

      /**
       * Grant changes (card E9.4, review finding I2 of PR #44): the items an
       * allowed removal left with no grant naming the grantee, so a later
       * read by the grantee should not return them.
       */
      const removedFrom = new Set<string>();
      /** The oracle's own replay of the allowed events: each item as the last one left it. */
      const replayed = () => {
        const state = new Map<string, MemoryItem>();
        for (const e of allEvents(db)) {
          if (e.decision !== "allow" || e.item_id === null) continue;
          if (e.item) state.set(e.item_id, e.item);
          else if (e.op === "retire" || e.op === "evict") {
            const was = state.get(e.item_id);
            if (was) state.set(e.item_id, { ...was, status: "retired" });
          }
        }
        return state;
      };
      const coversGrantee = (gs: readonly Grant[]) =>
        gs.some((g) => patternCovers(g.to, GRANTEE5.id));

      for (const [i, step] of steps.entries()) {
        const at = stepTime(i);
        const start = allEvents(db).length;
        if (step.kind === "read") {
          const reader = step.as === "grantee" ? GRANTEE5 : WRITER5;
          const { items, explanations } = await plane.read(reader, { text: step.text, at });
          for (const e of explanations) reads.set(e.item_id, (reads.get(e.item_id) ?? 0) + 1);
          const state = replayed();
          const log = allEvents(db);
          for (const it of items) {
            const was = state.get(it.id);
            expect(was, `read returned ${it.id}, which no allowed event left`).toBeDefined();
            expect(was?.status, `read returned ${it.id}, not active in the replay`).toBe("active");
            expect(
              readable(policy, reader, was as MemoryItem, at),
              `${reader.id} read ${it.id}, which the oracle's replay does not let it read at ${at}`,
            ).toBe(true);
            // The item's grants are those of the latest allowed event for it in the
            // oracle's replay, so no grant comes back once removed (V-7), and every
            // change of its grants, or of its class while it carried grants, was its
            // owner's write or grant change (I1, V-4). The reader is shown them all
            // when it owns the item and reads its scope, else only those naming it
            // (card RD1, lead-decisions item 36).
            const latest = was as MemoryItem;
            const owns =
              reader.id === latest.owner &&
              readable(policy, reader, { ...latest, grants: [] } as MemoryItem, at);
            expect(
              it.grants,
              `${it.id} returned with grants its latest event does not carry, as ${reader.id} is shown them`,
            ).toEqual(
              owns ? latest.grants : latest.grants.filter((g) => patternCovers(g.to, reader.id)),
            );
            let before: MemoryItem | undefined;
            for (const e of log) {
              if (e.decision !== "allow" || e.item?.id !== it.id) continue;
              const prev = before?.grants ?? [];
              const changed =
                prev.length !== e.item.grants.length ||
                !e.item.grants.every((g) => prev.some((h) => grantsAlike(g, h))) ||
                (before !== undefined && before.class !== e.item.class && prev.length > 0);
              if (changed)
                expect(
                  e.actor === e.item.owner &&
                    (e.op === "write" ||
                      (e.op === "update" && e.policy_id === "engram/grant/change")),
                  `event ${e.seq} changed what the grants of ${it.id} admit, by ${e.actor} (${e.op}, ${e.policy_id}), not its owner's write or grant change`,
                ).toBe(true);
              // What a grantee reads, its owner wrote or consented to by a grant
              // given after (card RV7, RV-CORE-1): every allowed change of an item
              // that carried grants was its owner's.
              if (before !== undefined && prev.length > 0)
                expect(
                  e.actor,
                  `event ${e.seq} rewrote ${it.id}, which carried grants, by ${e.actor} (${e.op}, ${e.policy_id}), not its owner`,
                ).toBe(e.item.owner);
              before = e.item;
            }
          }
          if (reader === GRANTEE5) {
            if (explanations.some((e) => e.policy_id.endsWith("/read/grants")))
              seen.grantAdmitted++;
            const returned = new Set(items.map((x) => x.id));
            for (const id of removedFrom)
              if (state.get(id)?.status === "active" && !returned.has(id))
                seen.refusedAfterRemoval++;
            // Items the read matched, active and in their window, that a grant names
            // the grantee on, refused for the grant's class or its expiry (V-5).
            for (const x of state.values()) {
              if (returned.has(x.id) || x.status !== "active" || wordOf(x) !== step.text) continue;
              if (pastTtl(policy, x, at) || compareTimestamps(x.valid_from, at) > 0) continue;
              if (readable(policy, GRANTEE5, x, at)) continue;
              const naming = x.grants.filter((g) => patternCovers(g.to, GRANTEE5.id));
              const live = (g: Grant) =>
                g.expires === undefined || compareTimestamps(at, g.expires) < 0;
              if (naming.some((g) => live(g) && g.class !== undefined && g.class !== x.class))
                seen.refusedForClass++;
              if (naming.some((g) => !live(g) && (g.class === undefined || g.class === x.class)))
                seen.refusedForExpiry++;
            }
          }
          continue;
        }
        if (step.kind === "reclass") {
          // A rewrite that changes an item's class, its grants as they are (V-4).
          const actor = GRANTERS[step.who];
          const live = currentItems(db).filter((x) => x.status !== "retired");
          const target = live[step.pick % Math.max(1, live.length)];
          if (!target || target.class === step.to) continue;
          const word = wordOf(target);
          const rewritten = {
            ...target,
            class: step.to,
            content: step.to === "procedural" ? { body: word, tools: [] } : word,
            version: target.version + 1,
            store_ref: null,
          } as MemoryItem;
          const result = await plane.write(actor, rewritten, at);
          if (result.event.decision !== "allow") continue;
          if (target.grants.length > 0) {
            expect(actor, "only the owner changes the class of an item carrying grants").toBe(
              WRITER5,
            );
            seen.reclassed++;
          }
          checkWrite(result.event, result.retention);
          continue;
        }
        if (step.kind === "rewrite") {
          // A rewrite of a held item's text, moving it to the walk's other scope
          // or not, by its owner or a co-holder (card RV7, RV-CORE-1 and 2).
          const actor = GRANTERS[step.who];
          const live = currentItems(db).filter((x) => x.status !== "retired");
          const target = live[step.pick % Math.max(1, live.length)];
          if (!target) continue;
          const word = WORDS[(WORDS.indexOf(wordOf(target) as (typeof WORDS)[number]) + 1) % 3];
          const scope = step.move
            ? (I5_SCOPES.find((x) => x !== target.scope) as string)
            : target.scope;
          const rewritten = {
            ...target,
            scope,
            content: target.class === "procedural" ? { body: word, tools: [] } : word,
            version: target.version + 1,
            store_ref: null,
          } as MemoryItem;
          const result = await plane.write(actor, rewritten, at);
          if (result.event.decision !== "allow") {
            if (step.who === "coholder" && target.grants.length > 0) seen.coholderRewriteRefused++;
            if (step.who === "coholder" && step.move) seen.coholderMoveRefused++;
            continue;
          }
          if (target.grants.length > 0 || step.move)
            expect(actor, "only the owner rewrites an item carrying grants, or moves an item").toBe(
              WRITER5,
            );
          if (target.grants.length > 0) seen.ownerRewroteGranted++;
          if (step.move) seen.ownerMoved++;
          checkWrite(result.event, result.retention);
          continue;
        }
        if (step.kind === "promote") {
          // A promotion into the walk's team scope, reviewed, by the owner or a
          // co-holder (review finding RV7-R1 of PR #61): a new version a
          // non-owner makes carries none of the owner's grants.
          const actor = GRANTERS[step.who];
          const live = currentItems(db).filter((x) => x.status === "active");
          const target = live[step.pick % Math.max(1, live.length)];
          if (!target) continue;
          const result = await plane.promote(actor, target.id, "team:b", at, { review: true });
          if (result.event.decision !== "allow" || !result.item) continue;
          if (result.item.id !== target.id && actor !== WRITER5) {
            expect(result.item.grants, "a co-holder's new version carries no grant").toEqual([]);
            if (target.grants.length > 0) seen.coholderPromotedGranted++;
          }
          continue;
        }
        if (step.kind === "grant") {
          const actor = GRANTERS[step.who];
          // The item: one the walk holds, chosen by the step's pick, or a pool id it does not hold.
          // A removal prefers an item that carries a grant, so removals that land are common.
          const live = currentItems(db).filter((x) => x.status !== "retired");
          const granted = live.filter((x) => x.grants.length > 0);
          const held = step.remove && granted.length > 0 ? granted : live;
          const target = held.length > 0 ? held[step.pick % held.length] : undefined;
          const targetId = target?.id ?? (POOL[step.pick % POOL.length] as string);
          const cls = target?.class ?? "semantic";
          const other = cls === "semantic" ? "episodic" : "semantic";
          const add = step.add.map(
            (g): Grant => ({
              to: g.to,
              class: g.ownClass ? cls : other,
              mode: "read",
              expires: stepTime(i + g.lasts),
            }),
          );
          const remove = step.remove && target?.grants[0] ? [target.grants[0]] : [];
          if (add.length + remove.length === 0) continue;
          const result = await plane.changeGrants(actor, targetId, { add, remove }, at);
          expect(allEvents(db).slice(start), "a grant change is one event").toEqual([result.event]);
          if (result.decision !== "allow") continue;
          expect(actor, "only the owner, user-sourced, changes grants").toBe(WRITER5);
          seen.grantChanged++;
          const now = currentItems(db).find((x) => x.id === targetId);
          if (now && coversGrantee(now.grants)) removedFrom.delete(targetId);
          else if (now && remove.length > 0 && coversGrantee(remove)) removedFrom.add(targetId);
          continue;
        }
        if (step.kind === "retain") {
          const p = step.tight ? tightened(policy) : policy;
          const actor = SWEEPERS[step.who];
          const report = await under(p).retain(actor, step.scope, at);
          checkSweep(p, actor, step.scope, at, start - 1, report.events);
          continue;
        }
        if (step.kind === "adopt") {
          // An item already in the store, never written through the plane.
          const stored = { ...step.item, valid_from: at, store_ref: null } as MemoryItem;
          await adapter.write(stored);
          const owner: Actor = { id: WRITER5.id, level: "person", memberships: [stored.scope] };
          const deps = { db, adapter, policy, newId };
          const report = await adoptStoreItems(deps, owner, stored.scope, at);
          const added = allEvents(db).slice(start);
          for (const [k, w] of added.entries()) {
            if (w.op !== "write" || w.decision !== "allow") continue;
            if (w.item_id === stored.id) seen.adopted++;
            const slot: MemoryEvent[] = [];
            for (const e of added.slice(k + 1)) {
              if (e.op !== "evict") break;
              slot.push(e);
            }
            checkWrite(w, slot);
          }
          expect(report.evictions.map((e) => e.id)).toEqual(
            added.filter((e) => e.op === "evict").map((e) => e.id),
          );
          continue;
        }
        // One write, or a batch of writes and a sweep called together.
        const writes = step.kind === "write" ? [step.item] : step.items;
        if (writes.length > 1) seen.concurrent++;
        const held = new Set(currentItems(db).map((x) => x.id));
        const calls = writes.map((w) => plane.write(WRITER5, { ...w, valid_from: at }, at));
        const sweep =
          step.kind === "batch" && step.sweep ? plane.retain(WRITER5, step.sweep, at) : undefined;
        const results = await Promise.all(calls);
        const report = await sweep;
        const log = allEvents(db);
        for (const result of results) {
          if (result.event.decision !== "allow") {
            expect(result.retention, "a denied write runs no budget check").toEqual([]);
            continue;
          }
          if (held.has(result.event.item_id ?? "")) seen.reused++;
          // The slot's events follow its write event directly: nothing interleaved.
          const at0 = log.findIndex((e) => e.id === result.event.id);
          expect(
            log.slice(at0 + 1, at0 + 1 + result.retention.length).map((e) => e.id),
            "a write's budget check runs in its own queue slot",
          ).toEqual(result.retention.map((e) => e.id));
          checkWrite(result.event, result.retention);
        }
        if (report && step.kind === "batch" && step.sweep) {
          // The sweep was queued last: it ran after every write's slot.
          const first = report.events[0]?.seq ?? log.length;
          checkSweep(policy, WRITER5, step.sweep, at, first - 1, report.events);
        }
      }

      const state = currentItems(db);
      const lastAt = stepTime(steps.length - 1);
      for (const rule of policy.retention) {
        if (rule.budget === null || rule.eviction === "manual") continue;
        for (const scope of I5_SCOPES.filter((s) => levelOf(s) === rule.scope)) {
          const live = state.filter(
            (x) =>
              x.scope === scope &&
              x.class === rule.class &&
              x.status === "active" &&
              !pastTtl(policy, x, lastAt),
          ).length;
          expect(
            live,
            `${scope} holds ${live} active ${rule.class} items not past their ttl, budget ${rule.budget}`,
          ).toBeLessThanOrEqual(rule.budget);
        }
      }
      const log = allEvents(db);
      for (const e of log.filter((x) => x.op === "retire" || x.op === "evict")) {
        expect(e.reason, `event ${e.seq} has a reason`).not.toBe("");
        // The retire that supersedes a promotion's source (the grant walk's
        // promotions, RV7-R1) names the promotion rule, and only for an item an
        // allowed promotion just took a new version of.
        const superseded =
          e.op === "retire" &&
          /^budgeted\/promotion\/superseded$/.test(e.policy_id) &&
          log.some(
            (x) =>
              x.op === "promote" &&
              x.decision === "allow" &&
              x.seq === e.seq - 1 &&
              x.item?.lineage[0] === e.item_id,
          );
        if (superseded) continue;
        expect(e.policy_id, `event ${e.seq} names a retention or adoption rule`).toMatch(
          /^(budgeted(-tight)?\/retention\/(person|team)\/(episodic|semantic|procedural)|engram\/retention\/(item-ttl|membership)|engram\/adopt\/retract)$/,
        );
        if (e.decision === "allow") expect(e.item_id).not.toBeNull();
      }
      rebuild(db);
      expect(currentItems(db), "replay reproduces every retirement").toEqual(state);
      if (log.length > 0) expect(itemsAt(db, log.length - 1)).toEqual(state);
    };
    await fc.assert(fc.asyncProperty(arbBudgetPolicy, arbSteps, walk(first)), {
      numRuns: RUNS,
      seed: seedFor(I5),
    });
    const {
      grantChanged,
      grantAdmitted,
      refusedAfterRemoval,
      refusedForClass,
      refusedForExpiry,
      reclassed,
      ownerRewroteGranted,
      coholderRewriteRefused,
      ownerMoved,
      coholderMoveRefused,
      coholderPromotedGranted,
      ...budgets
    } = first;
    expect(
      Object.values(budgets).every((n) => n > 0),
      `invariant 5 needs evictions by recency and by utility (some where reads, not age, chose the victim), a manual ask, a sweep that retired an expired item and one that evicted, a rewrite of a held id, a concurrent batch, an adopted item, a refused non-member sweep, and expired shared items a session left to a user; it saw ${JSON.stringify(first)}`,
    ).toBe(true);
    // The same walk with grant changes, writes carrying grants (of another class
    // than their item's too), class-changing rewrites and reads by a grantee,
    // under a policy that honours grants (card E9.4, review finding I2 and
    // verification finding V-5 of PR #44). Its own steps, seed and counters, so
    // the walk above draws exactly as it always has and is judged by its own.
    await fc.assert(fc.asyncProperty(arbBudgetPolicy.map(honouring), arbGrantSteps, walk(second)), {
      numRuns: RUNS,
      seed: seedFor(`${I5}, grant changes`),
    });
    const grants = {
      grantChanged: second.grantChanged,
      grantAdmitted: second.grantAdmitted,
      refusedAfterRemoval: second.refusedAfterRemoval,
      refusedForClass: second.refusedForClass,
      refusedForExpiry: second.refusedForExpiry,
      reclassed: second.reclassed,
      ownerRewroteGranted: second.ownerRewroteGranted,
      coholderRewriteRefused: second.coholderRewriteRefused,
      ownerMoved: second.ownerMoved,
      coholderMoveRefused: second.coholderMoveRefused,
      coholderPromotedGranted: second.coholderPromotedGranted,
    };
    expect(
      Object.values(grants).every((n) => n > 0),
      `invariant 5's grant walk needs allowed grant changes, reads a changed grant admitted, reads refused after a removal, for a grant's class and for its expiry, class changes of items carrying grants, owner rewrites of items carrying grants and owner moves, co-holder rewrites and moves refused, and co-holder promotions of items carrying grants; it saw ${JSON.stringify(second)}`,
    ).toBe(true);
  }, 240_000);

  const I6 =
    "invariant 6: adoption never records a provenance kind more trusted than the plane holds for the item's id";
  test(I6, async () => {
    const seen = adoptionCounters();
    await fc.assert(
      fc.asyncProperty(arbAdoptionCase, (c) =>
        adoptionCase(c, seen, (adopted, before, why, origin) => {
          // A re-filed copy is judged against the item it copies (review fix
          // pass 2, N-2), in the same adoption or a later one.
          const held = before?.provenance.kind ?? origin;
          const ceiling = Math.max(
            TRUST.indexOf(held ?? "import"),
            before ? 0 : TRUST.indexOf("import"),
          );
          expect(
            TRUST.indexOf(adopted.provenance.kind),
            `${why}: adoption recorded kind ${adopted.provenance.kind} for ${adopted.id}, more trusted than ${before ? `the plane's ${held}` : origin ? `the ${origin} item it re-files, and import` : "import, for an id the plane never held"}`,
          ).toBeGreaterThanOrEqual(ceiling);
        }),
      ),
      { numRuns: RUNS, seed: seedFor(I6) },
    );
    expect(
      seen.adoptedHeld > 0 &&
        seen.adoptedNew > 0 &&
        seen.claimRaised > 0 &&
        seen.refiled > 0 &&
        seen.refiledLater > 0,
      `invariant 6 needs adoptions of ids the plane held and of new ids, records claiming a kind more trusted than the plane held, and records re-filed under a new id, in the same adoption and in a later one; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  }, 240_000);

  const I7 =
    "invariant 7: adoption never records a grant the plane does not hold for the item's id";
  test(I7, async () => {
    const seen = adoptionCounters();
    await fc.assert(
      fc.asyncProperty(arbAdoptionCase, (c) =>
        adoptionCase(c, seen, (adopted, before, why) => {
          for (const g of adopted.grants)
            expect(
              before?.grants.some((h) => sameGrant(g, h)) ?? false,
              `${why}: adoption recorded a grant to ${g.to} on ${adopted.id}, which the plane ${before ? "does not hold for it" : "never held an item of"}`,
            ).toBe(true);
        }),
      ),
      { numRuns: RUNS, seed: seedFor(I7) },
    );
    expect(
      seen.adoptedHeld > 0 && seen.grantDropped > 0 && seen.grantKept > 0,
      `invariant 7 needs adoptions of ids the plane held, a grant the record carried that adoption dropped, and a grant the plane held that adoption kept; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  }, 240_000);

  const I8 =
    "invariant 8: with the trust options on, no committed item is more trusted than its actor's attested source, and no allowed write or eviction by a less trusted source changes or removes a more trusted active item unless its owner acted as user";
  test(I8, async () => {
    const seen = trustCounters();
    await fc.assert(
      fc.asyncProperty(arbTrustCase, (c) => trustWalk(c, seen)),
      { numRuns: RUNS, seed: seedFor(I8) },
    );
    expect(
      Object.values(seen).every((n) => n > 0),
      `invariant 8 needs floored writes, rewrites and retires denied for trust, writes and promotions denied rather than evict a more trusted item, refusals at the commit, races on two handles, promotions, evictions that passed over a more trusted item, sweeps held back, a repeated sweep that records its shortfall once, adoptions denied for trust, and allowed rewrites; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  }, 240_000);
});

/** Invariant 5's scopes: one person, one team. */
const I5_SCOPES = ["person:a", "team:b"] as const;
const WORDS = ["alpha", "beta", "gamma"] as const;
/** Invariant 5's writer and reader: a member of both scopes, writing user content. */
const WRITER5: Actor = {
  id: "person:a",
  level: "person",
  memberships: [...I5_SCOPES],
  source: "user",
} as Actor;
/**
 * Who sweeps: the user; a session (no harness source, as the pi extension
 * sweeps), whose ttl retirement is limited to its own person scope (P4-6);
 * and an outsider, refused.
 */
const SWEEPERS = {
  user: WRITER5,
  session: { id: "person:a", level: "person", memberships: [...I5_SCOPES] } as Actor,
  outsider: { id: "person:z", level: "person", memberships: ["person:z"] } as Actor,
} as const;
/** A reader with no scope of the walk's: it reads only what a grant admits (card E9.4). */
const GRANTEE5: Actor = { id: "person:g", level: "person", memberships: ["person:g"] } as Actor;
/**
 * Who asks for a grant change: the owner of every walk item, user-sourced; a
 * co-holder, a user-sourced member of both scopes who owns none of them; and
 * the owner's agent, model-sourced. Only the first may change a grant.
 */
const GRANTERS = {
  owner: WRITER5,
  coholder: {
    id: "person:c",
    level: "person",
    memberships: [...I5_SCOPES],
    source: "user",
  } as Actor,
  agent: { ...WRITER5, source: "model" } as Actor,
} as const;
/** Step i runs i seconds after a fixed start, so a ttl of a few seconds runs out mid-sequence. */
const stepTime = (i: number) => addSeconds("2026-10-25T12:00:00Z", i) as string;
/** A few ids steps reuse, so writes rewrite held and evicted items. */
const POOL = [1, 2, 3, 4].map((n) => `01910000-0000-7000-8000-00000000000${n}`);

/** The policy with every budget one lower (at least 1): a sweep under it has something to evict. */
function tightened(policy: Policy): Policy {
  return {
    ...policy,
    id: "budgeted-tight",
    retention: policy.retention.map((r) => ({
      ...r,
      budget: r.budget === null ? null : Math.max(1, r.budget - 1),
    })),
  };
}

/** Every write admitted, reads by person of person and team, and retention rules with budgets. */
const arbBudgetPolicy: fc.Arbitrary<Policy> = fc
  .uniqueArray(
    fc.record({
      scope: fc.constantFrom<"person" | "team">("person", "team"),
      class: fc.constantFrom<MemoryItem["class"]>("episodic", "semantic", "procedural"),
      ttl: fc.option(fc.constantFrom(2, 5), { nil: null, freq: 3 }),
      budget: fc.option(fc.integer({ min: 1, max: 3 }), { nil: null, freq: 6 }),
      eviction: fc.constantFrom<"recency" | "utility" | "manual">("recency", "utility", "manual"),
    }),
    { selector: (r) => `${r.scope}/${r.class}`, minLength: 1, maxLength: 6 },
  )
  .map((retention) => ({
    ...ADMIT_ALL,
    id: "budgeted",
    read: { matrix: [{ reader: "person", may_read: ["person", "team"] }], honour_grants: false },
    retention,
  }));

type Step =
  | { kind: "write"; item: MemoryItem }
  | { kind: "batch"; items: MemoryItem[]; sweep: string | null }
  | { kind: "read"; text: string; as?: "writer" | "grantee" }
  | {
      /** A rewrite changing the class of a held item (verification finding V-4 of PR #44). */
      kind: "reclass";
      who: "owner" | "coholder";
      pick: number;
      to: MemoryItem["class"];
    }
  | {
      kind: "grant";
      who: keyof typeof GRANTERS;
      /** Which held item, modulo how many the walk holds when the step runs. */
      pick: number;
      /** To the grantee or a pattern covering it; of the item's class or not; lasting `lasts` steps (expired when not positive). */
      add: { to: string; ownClass: boolean; lasts: number }[];
      /** Remove the item's first grant, when it has one. */
      remove: boolean;
    }
  | {
      /** A rewrite of a held item's text, moving it to the other scope or not (card RV7). */
      kind: "rewrite";
      who: "owner" | "coholder";
      pick: number;
      move: boolean;
    }
  | {
      /** A reviewed promotion into the team scope (review finding RV7-R1 of PR #61). */
      kind: "promote";
      who: "owner" | "coholder";
      pick: number;
    }
  | { kind: "retain"; scope: string; who: keyof typeof SWEEPERS; tight: boolean }
  | { kind: "adopt"; item: MemoryItem };

/** An item for invariant 5: owned by its writer, version 1, an id from the pool half the time. */
const arbI5Item: fc.Arbitrary<MemoryItem> = fc
  .tuple(
    arbGrantedItem,
    fc.oneof(
      fc.constantFrom(...POOL),
      arbGrantedItem.map((x) => x.id),
    ),
    fc.constantFrom(...I5_SCOPES),
    fc.constantFrom(...WORDS),
    fc.constantFrom<MemoryItem["status"]>("active", "active", "active", "candidate"),
  )
  .map(([item, id, scope, word, status]) => {
    const content = item.class === "procedural" ? { body: word, tools: [] } : word;
    return {
      ...item,
      id,
      owner: WRITER5.id,
      version: 1,
      scope,
      status,
      content,
      grants: [],
      ttl: null,
    } as MemoryItem;
  });

const arbStep: fc.Arbitrary<Step> = fc.oneof(
  { arbitrary: arbI5Item.map((item): Step => ({ kind: "write", item })), weight: 6 },
  {
    arbitrary: fc
      .tuple(
        fc.uniqueArray(arbI5Item, { selector: (x) => x.id, minLength: 2, maxLength: 3 }),
        fc.option(fc.constantFrom(...I5_SCOPES), { nil: null }),
      )
      .map(([items, sweep]): Step => ({ kind: "batch", items, sweep })),
    weight: 2,
  },
  { arbitrary: fc.constantFrom(...WORDS).map((text): Step => ({ kind: "read", text })), weight: 3 },
  {
    arbitrary: fc
      .tuple(
        fc.constantFrom(...I5_SCOPES),
        fc.constantFrom<keyof typeof SWEEPERS>("user", "user", "session", "outsider"),
        fc.boolean(),
      )
      .map(([scope, who, tight]): Step => ({ kind: "retain", scope, who, tight })),
    weight: 2,
  },
  {
    arbitrary: arbI5Item
      .filter((x) => !POOL.includes(x.id))
      .map((item): Step => ({ kind: "adopt", item: { ...item, status: "active" } })),
    weight: 1,
  },
);
const arbSteps = fc.array(arbStep, { minLength: 1, maxLength: 14 });

/** The budget policy honouring grants, for the walk with grant changes. */
const honouring = (p: Policy): Policy => ({ ...p, read: { ...p.read, honour_grants: true } });

/**
 * Invariant 5's steps with grant changes and reads by the grantee (card E9.4,
 * review finding I2 of PR #44): a grant change asked by the owner, a
 * co-holder or the owner's agent, on an item the walk holds, adding a grant
 * to the grantee (or a pattern covering it) of the item's class or not,
 * expired or lasting a few steps, and removing a grant the item carries.
 */
const arbGrantStep: fc.Arbitrary<Step> = fc
  .record({
    who: fc.constantFrom<keyof typeof GRANTERS>("owner", "owner", "owner", "coholder", "agent"),
    pick: fc.nat({ max: 15 }),
    add: fc.array(
      fc.record({
        to: fc.constantFrom(GRANTEE5.id, "person:g*"),
        ownClass: fc.constantFrom(true, true, true, false),
        lasts: fc.constantFrom(0, 3, 30),
      }),
      { maxLength: 1 },
    ),
    remove: fc.boolean(),
  })
  .map((g): Step => ({ kind: "grant", ...g }));
/** An item's word: its text, or a procedure's body. */
const wordOf = (x: MemoryItem) =>
  typeof x.content === "string"
    ? x.content
    : String((x.content as { body?: unknown }).body ?? JSON.stringify(x.content));

/**
 * A write carrying grants to the grantee or another principal, of any class
 * (another class than the item's included, which a first write may carry),
 * expiring at a step of the walk (verification finding V-5 of PR #44).
 */
const arbGrantedWrite: fc.Arbitrary<Step> = fc
  .tuple(
    arbI5Item,
    fc.array(
      fc.record({
        to: fc.constantFrom(GRANTEE5.id, "person:g*", "person:z"),
        class: fc.constantFrom<MemoryItem["class"]>("episodic", "semantic", "procedural"),
        mode: fc.constant("read" as const),
        at: fc.nat({ max: 16 }),
      }),
      { minLength: 1, maxLength: 2 },
    ),
  )
  .map(
    ([item, gs]): Step => ({
      kind: "write",
      item: {
        ...item,
        grants: gs.map(({ at, ...g }) => ({ ...g, expires: stepTime(at) as string })),
      } as MemoryItem,
    }),
  );
const arbReclass: fc.Arbitrary<Step> = fc
  .record({
    who: fc.constantFrom<"owner" | "coholder">("owner", "owner", "coholder"),
    pick: fc.nat({ max: 15 }),
    to: fc.constantFrom<MemoryItem["class"]>("episodic", "semantic", "procedural"),
  })
  .map((r): Step => ({ kind: "reclass", ...r }));
/** A rewrite by the owner or a co-holder, moving the item or not (card RV7, RV-CORE-1 and 2). */
const arbRewrite: fc.Arbitrary<Step> = fc
  .record({
    who: fc.constantFrom<"owner" | "coholder">("owner", "coholder", "coholder"),
    pick: fc.nat({ max: 15 }),
    move: fc.boolean(),
  })
  .map((r): Step => ({ kind: "rewrite", ...r }));
/** A reviewed promotion by the owner or a co-holder (review finding RV7-R1 of PR #61). */
const arbPromote: fc.Arbitrary<Step> = fc
  .record({
    who: fc.constantFrom<"owner" | "coholder">("owner", "coholder", "coholder"),
    pick: fc.nat({ max: 15 }),
  })
  .map((r): Step => ({ kind: "promote", ...r }));
const arbGrantSteps = fc.array(
  fc.oneof(
    { arbitrary: arbStep, weight: 6 },
    { arbitrary: arbGrantStep, weight: 2 },
    { arbitrary: arbGrantedWrite, weight: 2 },
    { arbitrary: arbReclass, weight: 1 },
    { arbitrary: arbRewrite, weight: 1 },
    { arbitrary: arbPromote, weight: 1 },
    {
      arbitrary: fc
        .constantFrom(...WORDS)
        .map((text): Step => ({ kind: "read", text, as: "grantee" })),
      weight: 2,
    },
  ),
  { minLength: 1, maxLength: 14 },
);

/** The seq of the last allowed event that changed each item, up to and including `seq`. */
function lastChanged(events: MemoryEvent[], seq: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of events) {
    if (e.seq > seq || e.decision !== "allow" || e.item_id === null) continue;
    if (["write", "update", "promote", "retire", "evict"].includes(e.op)) out.set(e.item_id, e.seq);
  }
  return out;
}

/** The scopes promotions start in, and the targets they aim at. */
const P_SOURCES = ["person:a", "team:b"] as const;
const P_TARGETS = ["person:a", "role:a", "team:b", "org"] as const;
const P_ACTORS = ["person:a", "person:b", "person:c", "agent:pi"] as const;
const KINDS = ["user", "document", "tool", "model", "import", "compaction", "external"] as const;
type Kind = (typeof KINDS)[number];
const TRUSTED: readonly Kind[] = ["user", "document", "tool"];
const P_SOURCE_ID = "01950000-0000-7000-8000-000000000000";
const pId = (n: number) => `01950000-0000-7000-8000-${String(n + 1).padStart(12, "0")}`;

/** A restatement of content made after the item: by whom, as what, and whether it matches. */
interface Restatement {
  actor: (typeof P_ACTORS)[number];
  kind: Kind;
  /** Also in another case: the same only in the merging form, never a confirmation. */
  loud: boolean;
  same: boolean;
  inScope: boolean;
  retired: boolean;
  byAuthor: boolean;
  inTarget: boolean;
}

const arbRestatement: fc.Arbitrary<Restatement> = fc.record({
  actor: fc.constantFrom(...P_ACTORS),
  kind: fc.oneof(
    { arbitrary: fc.constantFrom<Kind>("user", "document", "tool"), weight: 3 },
    { arbitrary: fc.constantFrom<Kind>("model", "compaction", "import", "external"), weight: 2 },
  ),
  loud: fc.constantFrom(false, false, true),
  same: fc.oneof(
    { arbitrary: fc.constant(true), weight: 4 },
    { arbitrary: fc.constant(false), weight: 1 },
  ),
  inScope: fc.oneof(
    { arbitrary: fc.constant(true), weight: 5 },
    { arbitrary: fc.constant(false), weight: 1 },
  ),
  // Retired by an event after it was written: it no longer confirms (P5-5).
  retired: fc.constantFrom(false, false, true),
  // Written by the item's own author again: the same actor twice (the distinct-actor rule).
  byAuthor: fc.constantFrom(false, false, true),
  // Written into the target instead, as the class the promotion would make:
  // an active one there is a duplicate (P5-5).
  inTarget: fc.constantFrom(false, false, false, false, false, true),
});

/**
 * Card D3 review, D3-5: the session index invariant 2's plane is given (s9
 * is a session it does not hold), and a replay case. One case in five the
 * source is a procedural candidate whose provenance ref is a distill ref (or
 * none), and the promoter presents a replay: for the source or another item,
 * of its content or other content, naming the ref's induction tasks or none
 * or only t1, sometimes replaying t1, with a pass count around replay_k.
 */
const P_SESSIONS: ReadonlyMap<string, string> = new Map([
  ["s1", "t1"],
  ["s2", "t2"],
]);
const arbReplayCase = fc.record({
  use: fc.constantFrom(false, false, false, false, true),
  ref: fc.constantFrom("r", "distill:awm:s1", "distill:awm:s1,s2", "distill:rule:s1,s9"),
  ownItem: fc.constantFrom(true, true, true, true, true, false),
  ownContent: fc.constantFrom(true, true, true, true, true, false),
  induced: fc.constantFrom("ref", "ref", "ref", "none", "t1"),
  leak: fc.constantFrom(false, false, false, false, true),
  n: fc.constantFrom(5, 5, 5, 5, 4, 6),
  passes: fc.constantFrom(2, 3, 3, 4, 5, 5),
  // Tasks passing without the candidate, and whether the candidate's tasks
  // miss their third seed (2/3: at the threshold, below a baseline of 1).
  baseWins: fc.constantFrom(0, 0, 0, 2, 5, 5),
  dip: fc.constantFrom(false, true),
  agent: fc.constantFrom(false, false, false, true),
  // Not the registered seeds 1, 2, 3 one time in four: refused before the log (D3-13).
  seeds: fc.constantFrom([1], [1, 2, 3], [1, 2, 3], [1, 2, 3]),
  sameScope: fc.constantFrom(true, true, false),
});

/** True three times in four: most cases reach the evidence rules rather than stopping earlier. */
const oftenTrue = fc.constantFrom(true, true, true, false);

/**
 * A promotion case: a policy (its target rule opened three times in four,
 * so evidence rather than the rule decides), the item, its restatements and
 * the promoter, who reviews half the time and three times in four belongs
 * to both the source and the target scope.
 */
const arbPromotionCase = fc.record({
  policy: fc
    .tuple(
      arbPolicy,
      fc.integer({ min: 1, max: 3 }),
      fc.boolean(),
      oftenTrue,
      fc.boolean(),
      fc.constantFrom(...P_TARGETS),
    )
    .map(([policy, k, orReview, open, review, target]) => {
      const rule = {
        scope: levelOf(target),
        allowed_sources: ["user", "document", "tool", "import"] as Kind[],
        confidence_floor: 0,
        forbidden_classes: [],
        requires_review: review,
      };
      const write = open
        ? [...policy.write.filter((r) => r.scope !== levelOf(target)), rule]
        : policy.write;
      // An opened case also lets a person context read every level and a
      // team context the shared ones, so reach rarely stops it; an org
      // context still has no row, and reads nothing but through a grant.
      const read: Policy["read"] = open
        ? {
            matrix: [
              { reader: "person", may_read: ["person", "role", "team", "org"] },
              { reader: "team", may_read: ["role", "team", "org"] },
            ],
            honour_grants: true,
          }
        : policy.read;
      return {
        target,
        policy: {
          ...policy,
          write,
          read,
          promotion: {
            episodic_to_semantic: { confirmations: k, or_review: orReview },
            procedural: { replay_k: 4, replay_n: 5 },
          },
        } as Policy,
      };
    }),
  source: fc
    .record({
      class: fc.constantFrom<MemoryItem["class"]>(
        "episodic",
        "episodic",
        "episodic",
        "semantic",
        "procedural",
      ),
      status: fc.constantFrom<MemoryItem["status"]>(
        "active",
        "active",
        "active",
        "candidate",
        "retired",
      ),
      scope: fc.constantFrom(...P_SOURCES),
      owner: fc.constantFrom(...P_ACTORS),
      // Who wrote it: the owner half the time, someone else otherwise (P5-1).
      author: fc.option(fc.constantFrom(...P_ACTORS), { nil: undefined }),
      kind: fc.constantFrom(...KINDS),
      confidence: fc.constantFrom(0.2, 0.7, 1),
      // Its own ttl, and how long after writing it is promoted (P5-4).
      ttl: fc.constantFrom(null, null, null, 3),
      // A live read grant on it, to someone who may then try to promote it (P5-15).
      grantTo: fc.option(fc.constantFrom(...P_ACTORS), { nil: undefined }),
      // A tag character in its content: a payload no reader sees (P5-14).
      hidden: fc.constantFrom(false, false, false, false, false, false, false, true),
    })
    // Model, compaction and external content lands only in person scope (ADR 0004, 0007).
    .map((s) =>
      s.kind === "model" || s.kind === "compaction" || s.kind === "external"
        ? { ...s, scope: "person:a" as const }
        : s,
    ),
  restatements: fc.array(arbRestatement, { maxLength: 6 }),
  promoter: fc.record({
    id: fc.constantFrom(...P_ACTORS),
    // A team or org context reads person scope only through a grant (P5-7).
    level: fc.constantFrom<Actor["level"]>(
      "person",
      "person",
      "person",
      "person",
      "person",
      "team",
      "org",
    ),
    source: fc.constantFrom<Kind | undefined>(
      "user",
      "user",
      "user",
      "user",
      "user",
      "user",
      "model",
      "document",
      undefined,
    ),
    extra: fc.subarray([...P_TARGETS]),
    joins: oftenTrue,
    review: fc.boolean(),
  }),
  at: arbTimestamp,
  after: fc.constantFrom(0, 0, 0, 5),
  replay: arbReplayCase,
});

/** One drawn promotion case. */
type PromotionCase = typeof arbPromotionCase extends fc.Arbitrary<infer T> ? T : never;

/**
 * Card E9.9 (ADR 0049, amending ADR 0026; a `decision` log entry records the
 * change): promotion cases drawn around an owner's acceptance. The source is
 * in person:a, one time in four in person:b instead (a person scope that is
 * not the promoter's, review E99-1); half the time owned by person:a, and
 * otherwise written by person:a three times in four (an author who is not the
 * owner, E99-1); three times in four a candidate and semantic. The promoter
 * asks to review, three times in four as person:a, three times in four in
 * the source's own scope; person scope's rule admits every source and class
 * and requires review half the time. The promoter's level, source and
 * memberships, the restatements and the rest stay drawn, so refusals by
 * source, level, class, status, scope, owner and target come with the
 * landings.
 */
const arbOwnerCase: fc.Arbitrary<PromotionCase> = fc
  .tuple(
    arbPromotionCase,
    fc.record({
      owner: fc.boolean(),
      authorA: oftenTrue,
      otherScope: fc.constantFrom(false, false, false, true),
      candidate: oftenTrue,
      semantic: oftenTrue,
      own: oftenTrue,
      promoter: oftenTrue,
      review: fc.boolean(),
    }),
  )
  .map(([c, o]) => {
    const person = {
      scope: "person" as const,
      allowed_sources: [...KINDS] as Kind[],
      confidence_floor: 0,
      forbidden_classes: [],
      requires_review: o.review,
    };
    const scope = (o.otherScope ? "person:b" : "person:a") as PromotionCase["source"]["scope"];
    const owner = o.owner ? ("person:a" as const) : c.source.owner;
    return {
      ...c,
      policy: {
        target: o.own ? (scope as PromotionCase["policy"]["target"]) : c.policy.target,
        policy: {
          ...c.policy.policy,
          write: [...c.policy.policy.write.filter((r) => r.scope !== "person"), person],
        } as Policy,
      },
      source: {
        ...c.source,
        scope,
        owner,
        author: owner !== "person:a" && o.authorA ? ("person:a" as const) : c.source.author,
        class: o.semantic ? ("semantic" as const) : c.source.class,
        status: o.candidate ? ("candidate" as const) : c.source.status,
      },
      promoter: {
        ...c.promoter,
        id: o.promoter ? ("person:a" as const) : c.promoter.id,
        review: true,
      },
      replay: { ...c.replay, use: false },
    };
  });

/** Invariant 2 over promotions (ADR 0026); runs inside invariant 2's test. */
async function promotionsLandOnlyWherePermitted(name: string) {
  const counters = () => ({
    byConfirmation: 0,
    byReview: 0,
    asked: 0,
    sameActorOnly: 0,
    untrustedOnly: 0,
    ownerReview: 0,
    authorReview: 0,
    grantee: 0,
    hiddenText: 0,
    confirmerReview: 0,
    retiredOnly: 0,
    writeRule: 0,
    expired: 0,
    wideningSource: 0,
    duplicate: 0,
    unreachable: 0,
    // Card E9.9 (ADR 0049): an owner's acceptance, and the owner's agent refused.
    ownerAccepted: 0,
    ownerAgentRefused: 0,
  });
  // The run's counters: the original run's, then the owner run's apart (review E99-3).
  let seen = counters();
  // Card D3 review, D3-5: replay admissions and each replay refusal.
  const replaySeen = {
    landed: 0,
    source: 0,
    item: 0,
    split: 0,
    refOnly: 0,
    short: 0,
    noWorseOnly: 0,
    seeds: 0,
  };
  const check = async ({
    policy: { policy: drawnPolicy, target: drawn },
    source: drawnSource,
    restatements: drawnRestatements,
    promoter: drawnPromoter,
    at,
    after,
    replay: rc,
  }: PromotionCase) => {
    // A replay case's source is a procedural candidate, under its ref,
    // with no hidden text and no ttl, so the replay decides most of them.
    const source = rc.use
      ? {
          ...drawnSource,
          class: "procedural" as const,
          status: "candidate" as const,
          hidden: false,
          ttl: null,
        }
      : drawnSource;
    const target = rc.use && rc.sameScope ? source.scope : drawn;
    // Nor restatements (a restatement in the target is a duplicate) or a
    // review (the owner never reviews its own item).
    const restatements = rc.use ? [] : drawnRestatements;
    const promoter = rc.use ? { ...drawnPromoter, review: false } : drawnPromoter;
    // A replay case opens the rules of the source's and the target's
    // levels to every source and class, and reads as an opened case
    // does, so the replay rather than the rule decides most of them.
    const opened = (level: string) => ({
      scope: level as Policy["write"][number]["scope"],
      allowed_sources: [...KINDS] as Kind[],
      confidence_floor: 0,
      forbidden_classes: [],
      requires_review: false,
    });
    const levels = new Set([levelOf(source.scope), levelOf(target)]);
    const policy: Policy = rc.use
      ? {
          ...drawnPolicy,
          write: [
            ...drawnPolicy.write.filter((r) => !levels.has(r.scope)),
            ...[...levels].map(opened),
          ],
          read: {
            matrix: [
              { reader: "person", may_read: ["person", "role", "team", "org"] },
              { reader: "team", may_read: ["role", "team", "org"] },
            ],
            honour_grants: true,
          },
        }
      : drawnPolicy;
    const { db, adapter, plane, under } = freshPlane(policy, true, P_SESSIONS);
    const store = under(ADMIT_ALL);
    // The source's text, with a tag-character payload when it is hidden.
    const word = source.hidden ? `alpha${String.fromCodePoint(0xe0041)}` : "alpha";
    // The same content in spacing only (strictly the same), or also in
    // case (the same only in the merging form, P5-12).
    const content = (r: Restatement) =>
      !r.same ? "beta" : r.loud ? restated(word) : ` ${word} \n`;
    const make = (n: number, scope: string, owner: string, text: MemoryItem["content"]) =>
      ({
        id: n < 0 ? P_SOURCE_ID : pId(n),
        class: source.class,
        scope,
        owner,
        content: source.class === "procedural" ? { body: String(text), tools: [] } : text,
        provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: owner },
        confidence: source.confidence,
        valid_from: at,
        valid_to: null,
        ttl: null,
        grants: [],
        version: 1,
        lineage: [],
        status: "active",
        store_ref: null,
        schema_version: 1,
      }) as MemoryItem;
    const writer = (id: string, scope: string, kind: Kind): Actor => ({
      id,
      level: "person",
      memberships: [scope],
      source: kind,
    });
    // A retired source is written active and retired by an event, never
    // written retired (review finding P4-7).
    const item = {
      ...make(-1, source.scope, source.owner, word),
      class: source.class,
      status: source.status === "retired" ? "active" : source.status,
      content: source.class === "procedural" ? { body: word, tools: [] } : word,
      ...(rc.use
        ? {
            provenance: {
              ...make(-1, source.scope, source.owner, word).provenance,
              ref: rc.ref,
            },
          }
        : {}),
      ttl: source.ttl,
      // Model, compaction and external content carries no grants (decision D4).
      grants:
        source.grantTo && !["model", "compaction", "external"].includes(source.kind)
          ? [
              {
                to: source.grantTo,
                class: source.class,
                mode: "read",
                expires: "2099-01-01T00:00:00Z",
              },
            ]
          : [],
    } as MemoryItem;
    const author = source.author ?? source.owner;
    expect(
      (await store.write(writer(author, source.scope, source.kind), item, at)).item,
    ).not.toBeNull();
    if (source.status === "retired")
      appendEvent(db, {
        id: "01950000-0000-7000-8000-0000000000ff",
        ts: at,
        op: "retire",
        item_id: P_SOURCE_ID,
        actor: source.owner,
        scope_from: null,
        scope_to: source.scope,
        decision: "allow",
        reason: "retired before the promotion under test",
        policy_id: "test/retire",
        schema_version: 1,
      });
    for (const [n, r] of restatements.entries()) {
      const scope = r.inTarget ? target : r.inScope ? source.scope : "role:z";
      const by = r.byAuthor ? author : r.actor;
      const restatement = make(n, scope, by, content(r));
      const { item: landed } = await store.write(
        writer(by, scope, r.kind),
        r.inTarget && source.class === "episodic"
          ? ({ ...restatement, class: "semantic" } as MemoryItem)
          : restatement,
        at,
      );
      if (landed && r.retired)
        appendEvent(db, {
          id: `01950000-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`,
          ts: at,
          op: "retire",
          item_id: landed.id,
          actor: by,
          scope_from: null,
          scope_to: scope,
          decision: "allow",
          reason: "a confirmer retired before the promotion",
          policy_id: "test/retire",
          schema_version: 1,
        });
    }
    const when = addSeconds(at, after) as string;
    // A replay case's promoter is the owner, a member of both scopes,
    // user-sourced or, one time in four, model-sourced.
    const actor: Actor = rc.use
      ? {
          id: source.owner,
          level: "person",
          memberships: [...new Set([source.scope, target])],
          source: rc.agent ? "model" : "user",
        }
      : {
          id: promoter.id,
          level: promoter.level,
          memberships: [
            ...new Set([...promoter.extra, ...(promoter.joins ? [source.scope, target] : [])]),
          ],
          ...(promoter.source ? { source: promoter.source } : {}),
        };
    const before = currentItems(db);
    const retired = retiredByEvent(db);
    const projected = before.find((i) => i.id === P_SOURCE_ID) as MemoryItem;
    const log = allEvents(db);
    const writes = log.flatMap((e) =>
      e.op === "write" && e.decision === "allow" && e.item
        ? [
            {
              item_id: e.item.id,
              actor: e.actor,
              kind: e.item.provenance.kind,
              scope: e.item.scope,
              content: e.item.content,
            },
          ]
        : [],
    );
    // The replay the promoter presents in a replay case.
    const refTasks = rc.ref.startsWith("distill:")
      ? [
          ...new Set(
            rc.ref
              .split(":")[2]
              ?.split(",")
              .map((x) => P_SESSIONS.get(x) ?? x),
          ),
        ]
      : [];
    const heldOut = Array.from({ length: rc.n }, (_, i) => `h${i}`);
    const presented = rc.use
      ? {
          item_id: rc.ownItem ? P_SOURCE_ID : pId(99),
          content_hash: strictContentHash(
            rc.ownContent ? { body: word, tools: [] } : { body: "other", tools: [] },
          ),
          induced_from: rc.induced === "ref" ? refTasks : rc.induced === "t1" ? ["t1"] : [],
          threshold: 2 / 3,
          outcomes: (rc.leak ? ["t1", ...heldOut.slice(1)] : heldOut).flatMap((task, i) =>
            rc.seeds.map((seed) => ({
              task,
              seed,
              without: i < rc.baseWins ? 1 : 0,
              with: i < rc.passes && !(rc.dip && seed === 3) ? 1 : 0,
            })),
          ),
        }
      : undefined;
    const logLength = plane.events().length;
    // A replay not on the registered seeds 1, 2, 3 is an invalid call:
    // refused before the log is touched, and nothing changes (D3-13).
    if (presented && rc.seeds.join() !== "1,2,3") {
      await expect(
        plane.promote(actor, P_SOURCE_ID, target, when, { replay: presented }),
      ).rejects.toThrow(InvalidCallError);
      expect(plane.events().length).toBe(logLength);
      expect(currentItems(db)).toEqual(before);
      replaySeen.seeds++;
      return;
    }
    const result = await plane.promote(actor, P_SOURCE_ID, target, when, {
      review: promoter.review,
      ...(presented ? { replay: presented } : {}),
    });
    if (presented) {
      const id = result.event.policy_id;
      if (id === "engram/promote/validation-source") replaySeen.source++;
      if (id === "engram/promote/replay-item") replaySeen.item++;
      if (id === "engram/promote/replay-split") replaySeen.split++;
      // Only the source's own distill ref stood in the way: the replay's
      // own list does not leak, the ref is mappable, and its tasks are
      // not the ones the replay names (the ref check alone refuses it).
      const ownList = new Set(presented.induced_from);
      if (
        id === "engram/promote/replay-split" &&
        !presented.outcomes.some((o) => ownList.has(o.task)) &&
        !rc.ref.includes("s9") &&
        rc.induced !== "ref"
      )
        replaySeen.refOnly++;
      if (id === "engram/promote/no-evidence") replaySeen.short++;
      // Only the no-worse rule stood in the way: by the threshold alone,
      // replay_k tasks of replay_n would pass (the lead's D3-1 answer).
      const byTask = new Map<string, { w: number; runs: number }>();
      for (const o of presented.outcomes) {
        const t = byTask.get(o.task) ?? { w: 0, runs: 0 };
        byTask.set(o.task, { w: t.w + o.with, runs: t.runs + 1 });
      }
      const thresholdOnly = [...byTask.values()].filter((t) => 3 * t.w >= 2 * t.runs).length;
      if (
        id === "engram/promote/no-evidence" &&
        byTask.size === policy.promotion.procedural.replay_n &&
        thresholdOnly >= policy.promotion.procedural.replay_k
      )
        replaySeen.noWorseOnly++;
      if (result.decision === "allow") replaySeen.landed++;
    }
    const added = plane.events().slice(logLength);
    // The promoter is answered with the events as it is shown them (card
    // RD1): a promoter who is neither the owner nor a grantee sees no grant
    // naming anyone else, so the log's events are compared through the same
    // disclosure, over the projection and access time the promotion used.
    const projectedNow = new Map(currentItems(db).map((i) => [i.id, i]));
    const shownView = {
      policy,
      at: accessTime(db, when),
      current: (i: string) => projectedNow.get(i),
    };
    const asShown = (e: MemoryEvent) => disclosedEvent(actor, e, shownView);
    expect(
      asShown(added[0] as MemoryEvent),
      "the decision is the first event the promotion appends",
    ).toEqual(result.event);
    expect(result.events).toEqual(added.slice(0, result.events.length).map(asShown));
    for (const e of added) {
      expect(e.reason).not.toBe("");
      expect(e.policy_id).not.toBe("");
    }
    const shown = `${projected.class} ${projected.status} item of ${projected.owner} (${projected.provenance.kind}) in ${projected.scope}, promoted to ${target} by ${actor.id} (source ${actor.source ?? "none"}, member of [${actor.memberships.join(", ")}], review ${promoter.review}) after writes ${JSON.stringify(writes.map((w) => [w.actor, w.kind, w.scope, w.content]))} under ${JSON.stringify({ write: policy.write, promotion: policy.promotion })}: ${result.event.decision} ${result.event.policy_id} ${result.event.reason}`;

    // The evidence counts the oracle reads, for the guards.
    const sameText = writes.filter(
      (w) => w.scope === projected.scope && sameStrictContent(w.content, projected.content),
    );
    const isActive = (id: string) =>
      id === P_SOURCE_ID || before.find((i) => i.id === id)?.status === "active";
    const activeTrustedActors = new Set(
      sameText.filter((w) => TRUSTED.includes(w.kind) && isActive(w.item_id)).map((w) => w.actor),
    ).size;
    const k = policy.promotion.episodic_to_semantic.confirmations;
    const trustedItems = new Set(
      sameText.filter((w) => TRUSTED.includes(w.kind)).map((w) => w.item_id),
    ).size;
    const trustedActors = new Set(
      sameText.filter((w) => TRUSTED.includes(w.kind)).map((w) => w.actor),
    ).size;
    // Distinct actors of the active same-content writes, whatever their kind:
    // a refusal counts as the trusted-kind rule's alone only when these reach
    // k (card X16: retired confirmers never confirm, so counting them let
    // the guard be met by refusals the rule does not decide).
    const activeAnyActors = new Set(sameText.filter((w) => isActive(w.item_id)).map((w) => w.actor))
      .size;

    if (result.decision === "deny" && result.event.policy_id === "engram/promote/expired")
      seen.expired++;
    if (result.event.policy_id === "engram/promote/widening-source") seen.wideningSource++;
    if (result.event.policy_id === "engram/promote/duplicate") seen.duplicate++;
    if (result.event.policy_id === "engram/promote/hidden-text") seen.hiddenText++;
    // A grantee who reads it but is not a member: the named refusal (P5-15).
    if (result.event.reason.includes("a grant lets others read an item")) seen.grantee++;
    if (result.event.reason.includes("confirmed item")) seen.confirmerReview++;
    if (
      result.event.policy_id === "engram/promote/membership" &&
      actor.memberships.includes(projected.scope)
    )
      seen.unreachable++;
    if (
      result.event.policy_id === "engram/promote/reviewer" &&
      actor.id !== projected.owner &&
      actor.id === author &&
      actor.source === "user" &&
      actor.memberships.includes(target)
    )
      seen.authorReview++;
    // A promoter who cannot read the target gets a null item even when it
    // lands (P5-7); what landed is the decision event's item.
    if (result.decision !== "allow") {
      expect(result.item).toBeNull();
      expect(currentItems(db), `a promotion that did not land changed nothing: ${shown}`).toEqual(
        before,
      );
      if (result.decision === "ask") seen.asked++;
      const evidenceOnly =
        result.event.policy_id === "engram/promote/no-evidence" &&
        projected.class === "episodic" &&
        !promoter.review;
      if (evidenceOnly && trustedItems >= k && trustedActors < k) seen.sameActorOnly++;
      if (evidenceOnly && activeAnyActors >= k && activeTrustedActors < k) seen.untrustedOnly++;
      // Only confirmers retired since stood in the way (P5-17).
      if (evidenceOnly && trustedActors >= k && activeTrustedActors < k) seen.retiredOnly++;
      if (
        result.event.policy_id === "engram/promote/reviewer" &&
        actor.id === projected.owner &&
        actor.source === "user" &&
        actor.memberships.includes(target)
      )
        seen.ownerReview++;
      if (
        result.event.policy_id === "engram/promote/reviewer" &&
        result.event.reason.includes("only the owner acting as user may accept")
      )
        seen.ownerAgentRefused++;
      if (/\/write\//.test(result.event.policy_id) && trustedActors >= k) seen.writeRule++;
      return;
    }
    const landed = result.event.item as MemoryItem;
    expect(result.item === null || result.item.id === landed.id).toBe(true);
    expect(
      promotionPermitted(
        policy,
        actor,
        P_SOURCE_ID,
        target,
        log,
        promoter.review,
        when,
        presented ? { replay: presented, sessions: P_SESSIONS } : undefined,
      ),
      `a promotion landed without the evidence ADR 0026 asks for: ${shown}${presented ? `; replay ${JSON.stringify(presented)} under ref ${rc.ref}` : ""}`,
    ).toBe(true);
    const { source: _source, ...judged } = actor;
    expect(
      writeForbidden(policy, judged, landed, retired),
      `a promotion landed an item a write could not: ${JSON.stringify(landed)}; ${shown}`,
    ).toBe(false);
    expect(
      TRUST.indexOf(landed.provenance.kind),
      `the promoted item is more trusted than its source: ${shown}`,
    ).toBeGreaterThanOrEqual(TRUST.indexOf(projected.provenance.kind));
    expect((await adapter.list(landed.scope)).map((i) => i.id)).toContain(landed.id);
    // An owner's acceptance is in place: the provenance and confidence
    // the plane held stand (card E9.9, ADR 0049: never raises trust).
    if (result.event.policy_id === "engram/promote/owner-person") {
      expect(landed, `an owner's acceptance changed more than the status: ${shown}`).toEqual({
        ...projected,
        status: "active",
        version: projected.version + 1,
        store_ref: landed.store_ref,
      });
      seen.ownerAccepted++;
    } else if (!presented) seen[promoter.review ? "byReview" : "byConfirmation"]++;
  };
  await fc.assert(fc.asyncProperty(arbPromotionCase, check), {
    numRuns: RUNS,
    seed: seedFor(name),
  });
  // The trusted-kind rule where nothing else decides (card X16, mutant
  // I2-untrusted-confirms): an episodic item written as user in person:a,
  // k = 2, and one active restatement by another actor with source import,
  // which the target's rule admits with no review. Only the user write
  // confirms, so the promotion must be refused for want of evidence; a
  // count that let the import restatement confirm would land an item the
  // oracle forbids. The walk meets this case too rarely to rely on it.
  const fixed = fc.sample(arbPromotionCase, {
    seed: seedFor(`${name}, import restatement`),
    numRuns: 1,
  })[0] as PromotionCase;
  const before = seen.untrustedOnly;
  await check({
    ...fixed,
    policy: {
      target: "person:a",
      policy: {
        ...fixed.policy.policy,
        write: [
          ...fixed.policy.policy.write.filter((r) => r.scope !== "person"),
          {
            scope: "person",
            allowed_sources: ["user", "document", "tool", "import"],
            confidence_floor: 0,
            forbidden_classes: [],
            requires_review: false,
          },
        ],
        read: {
          matrix: [{ reader: "person", may_read: ["person", "role", "team", "org"] }],
          honour_grants: true,
        },
        promotion: {
          episodic_to_semantic: { confirmations: 2, or_review: false },
          procedural: { replay_k: 4, replay_n: 5 },
        },
      } as Policy,
    },
    source: {
      class: "episodic",
      status: "active",
      scope: "person:a",
      owner: "person:a",
      author: undefined,
      kind: "user",
      confidence: 1,
      ttl: null,
      grantTo: undefined,
      hidden: false,
    },
    restatements: [
      {
        actor: "person:b",
        kind: "import",
        loud: false,
        same: true,
        inScope: true,
        retired: false,
        byAuthor: false,
        inTarget: false,
      },
    ],
    promoter: {
      id: "person:a",
      level: "person",
      source: "user",
      extra: [],
      joins: true,
      review: false,
    },
    after: 0,
    replay: { ...fixed.replay, use: false },
  });
  expect(
    seen.untrustedOnly,
    "an import restatement beside one user write is refused under engram/promote/no-evidence",
  ).toBe(before + 1);
  expect(
    Object.values(replaySeen).every((n) => n > 0),
    `invariant 2 over promotions needs replay admissions and refusals by the presenter's source, another item's replay, a split that is not the ref's, one only the ref's tasks refuse, too few passes, one only the no-worse rule refuses, and a replay off the registered seeds; it saw ${JSON.stringify(replaySeen)}`,
  ).toBe(true);
  // The original run alone meets its guards (review E99-3); the owner
  // acceptance counters are the owner run's.
  const { ownerAccepted: _accepted, ownerAgentRefused: _refused, ...original } = seen;
  expect(
    Object.values(original).every((n) => n > 0),
    `invariant 2 over promotions needs landings by confirmation and by review, an ask, refusals where only the distinct-actor rule, only the trusted-kind rule, only retired confirmers, only the owner-as-reviewer rule or only the target's write rule stood in the way, and refusals by authorship, confirmation, expiry, hidden text, a widening's source, a duplicate, reach and a read grant; it saw ${JSON.stringify(seen)}`,
  ).toBe(true);
  // Card E9.9: the cases drawn around an owner's acceptance, under their own
  // seed and their own counters.
  seen = counters();
  await fc.assert(fc.asyncProperty(arbOwnerCase, check), {
    numRuns: RUNS / 4,
    seed: seedFor(`${name}, owner acceptance`),
  });
  expect(
    seen.ownerAccepted > 0 &&
      seen.ownerAgentRefused > 0 &&
      seen.ownerReview > 0 &&
      seen.authorReview > 0,
    `invariant 2's owner acceptance run needs acceptances that land, the owner's agent refused, and the owner and an author refused as reviewers (card E9.9); it saw ${JSON.stringify(seen)}`,
  ).toBe(true);
}

/**
 * The Plane's surface (2606.24535): every method is accounted for, and none
 * hands an item to an actor who cannot read it. An item is held in a scope
 * the outsider is not in; each method is called by the outsider with what it
 * takes (the item's id where one is taken) and its result must not carry the
 * item's content. `read` filters; `write` and `promote` return only the
 * caller's own item; `events` is the audit log, which surfaces mirror to the
 * session record and never pass to a model; `simulate` replays only the
 * workload it is given, on scratch logs and stores (card E8.9);
 * `changeGrants` refuses an outsider in the same words for a hidden and an
 * unknown item, naming no scope, and returns no item (card E9.4, ADR 0034);
 * `export` returns only the exporter's own person scope and its own items in
 * scopes it may read (card E9.8);
 * `readById` answers for the hidden item's id exactly as for an id the log
 * never held, and `listScopes` lists no scope the outsider cannot read
 * (card E8.14);
 * `whoCanReadItem` and `whoCanRead` refuse an outsider as for an unknown id
 * and append no event (card E2.13, decision item 53);
 * `approvals` lists only requests in scopes the caller may read, `refuse`
 * refuses an outsider as for an unknown id with no item and no scope, and
 * `expireRequests` sweeps only a scope the caller is a member of (card E2.19).
 */
async function planeSurfaceLeaksNothing() {
  const SECRET = "the vault code is 4711";
  const policy: Policy = {
    ...ADMIT_ALL,
    read: {
      matrix: [{ reader: "person", may_read: ["person", "role", "team", "org"] }],
      honour_grants: true,
    },
  };
  const { plane } = freshPlane(policy);
  expect(Object.keys(plane).sort(), "a new Plane method must be classified here").toEqual([
    "approvals",
    "changeGrants",
    "checkWrite",
    "distill",
    "events",
    "expireRequests",
    "explain",
    "export",
    "lint",
    "listScopes",
    "promote",
    "read",
    "readById",
    "recordBypass",
    "refuse",
    "retain",
    "revalidate",
    "simulate",
    "whoCanRead",
    "whoCanReadItem",
    "write",
  ]);
  const at = "2026-10-25T12:00:00Z";
  const owner: Actor = {
    id: "person:s",
    level: "person",
    memberships: ["person:s"],
    source: "user",
  };
  const outsider: Actor = {
    id: "person:o",
    level: "person",
    memberships: ["person:o", "team:b"],
    source: "user",
  };
  const secret = {
    id: "01960000-0000-7000-8000-000000000001",
    class: "episodic",
    scope: "person:s",
    owner: "person:s",
    content: SECRET,
    provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:s" },
    confidence: 1,
    valid_from: at,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
  expect((await plane.write(owner, secret, at)).item).not.toBeNull();
  const { event: ownRead } = await plane.read(owner, { text: "vault", at });
  const leaks = (label: string, value: unknown) =>
    expect(
      JSON.stringify(value) ?? "",
      `${label} carries an item the caller cannot read`,
    ).not.toContain("vault");
  const rejection = (p: Promise<unknown>) =>
    p.then(
      () => undefined,
      (e: unknown) => e,
    );

  const claim = { ...secret, scope: "person:o", owner: "person:o", content: "mine" } as MemoryItem;
  const written = await plane.write(outsider, claim, at);
  leaks("write", written);
  expect(written.item).toBeNull();
  leaks("checkWrite", await plane.checkWrite(outsider, claim, at));
  const read = await plane.read(outsider, { text: "vault", at });
  leaks("read", read);
  // A read of the hidden item by its id (card E8.14): nothing returned, and
  // the same answer as for an id that names nothing.
  // A second hidden item carries a grant to the outsider for another class,
  // which admits nothing (review findings E8.14-1 and E8.14-5): both answer,
  // reason and all, as an unknown id once the ids and the event's id are neutral.
  const wrongClass = {
    ...secret,
    id: "01960000-0000-7000-8000-000000000003",
    grants: [{ to: outsider.id, mode: "read", class: "semantic", expires: "2027-01-01T00:00:00Z" }],
  } as MemoryItem;
  expect((await plane.write(owner, wrongClass, at)).item).not.toBeNull();
  const neutral = (r: Awaited<ReturnType<typeof plane.readById>>, asked: string) => {
    const { id: _id, seq: _seq, ...event } = r.event;
    return JSON.parse(JSON.stringify({ ...r, event }).replaceAll(asked, "<id>"));
  };
  const unknownId = "01960000-0000-7000-8000-00000000000a";
  const noId = await plane.readById(outsider, unknownId, { at });
  for (const hidden of [secret, wrongClass]) {
    const byId = await plane.readById(outsider, hidden.id, { at });
    leaks("readById", byId);
    expect(neutral(byId, hidden.id), `readById of ${hidden.id}`).toEqual(neutral(noId, unknownId));
  }
  const listed = await plane.listScopes(outsider, at);
  leaks("listScopes", listed);
  expect(listed.scopes.map((s) => s.scope)).not.toContain("person:s");
  const promoted = await plane.promote(outsider, secret.id, "team:b", at, { review: true });
  leaks("promote", promoted);
  expect(promoted.item).toBeNull();
  // A member of the item's scope and the target, not its owner, whose level
  // has no read matrix row: it cannot read the item, so it learns nothing
  // (review finding P5-7).
  const blind: Actor = {
    id: "person:b",
    level: "org",
    memberships: ["person:s", "team:b"],
    source: "user",
  };
  const blindly = await plane.promote(blind, secret.id, "team:b", at, { review: true });
  leaks("promote by a member who cannot read", blindly);
  expect(blindly.item).toBeNull();
  leaks("retain", await plane.retain(outsider, "person:s", at));
  // Card D4: a re-validation of the hidden item by the outsider is refused
  // as for an id the log never held, its event naming no scope and no item.
  const replayOf = (itemId: string) => ({
    item_id: itemId,
    content_hash: `sha256:${"0".repeat(64)}`,
    induced_from: [],
    threshold: REPLAY_THRESHOLD,
    outcomes: REPLAY_SEEDS.map((seed) => ({ task: "t", seed, without: 0, with: 0 })),
  });
  const revalidated = await plane.revalidate(outsider, secret.id, at, {
    replay: replayOf(secret.id),
  });
  leaks("revalidate", revalidated);
  const unknownRevalidated = await plane.revalidate(outsider, unknownId, at, {
    replay: replayOf(unknownId),
  });
  const neutralEvent = (e: MemoryEvent, asked: string) => {
    const { id: _id, seq: _seq, ...rest } = e;
    return JSON.parse(JSON.stringify(rest).replaceAll(asked, "<id>"));
  };
  expect(revalidated.event.scope_from).toBeNull();
  expect(neutralEvent(revalidated.event, secret.id)).toEqual(
    neutralEvent(unknownRevalidated.event, unknownId),
  );
  leaks(
    "recordBypass",
    await plane.recordBypass(outsider, { command: "cat x", store: "files" }, at),
  );
  expect(await rejection(plane.explain(outsider, ownRead.id))).toBeInstanceOf(ExplainDeniedError);
  leaks("lint", await plane.lint(outsider, at, "person:s"));
  // export hands out only the exporter's own person scope and its own items
  // in scopes it may read (card E9.8): nothing of person:s (review finding E9.8-3).
  const exported = await plane.export(outsider, at);
  leaks("export", exported);
  expect(exported.rows).toEqual([]);
  // A grant the outsider asks for on the secret: refused, no item, no scope,
  // and the same words as for an id that names nothing (card E9.4).
  const grant = {
    to: outsider.id,
    class: "episodic" as const,
    mode: "read" as const,
    expires: "2027-01-01T00:00:00Z",
  };
  const granted = await plane.changeGrants(outsider, secret.id, { add: [grant] }, at);
  leaks("changeGrants", granted);
  expect(granted.item).toBeNull();
  expect([granted.event.scope_from, granted.event.scope_to]).toEqual([null, null]);
  const unknown = "01960000-0000-7000-8000-000000000009";
  const nothing = await plane.changeGrants(outsider, unknown, { add: [grant] }, at);
  expect(granted.event.reason).toBe(nothing.event.reason.replace(unknown, secret.id));
  // Who can read the secret, asked by the outsider (card E2.13): the answer
  // an unknown id gets, word for word but the id, naming no scope, owner or
  // reader; a query appends no event.
  const asked = plane.events().length;
  const readers = await plane.whoCanReadItem(outsider, secret.id, at);
  leaks("whoCanReadItem", readers);
  const noReaders = await plane.whoCanReadItem(outsider, unknown, at);
  expect(readers).toEqual({
    ...noReaders,
    target: secret.id,
    reason: noReaders.reason.replace(unknown, secret.id),
  });
  // No trace of the secret's scope or owner at all (review finding E2.13-5).
  expect(JSON.stringify(readers)).not.toContain("person:s");
  const scoped = await plane.whoCanRead(outsider, "person:s", at);
  leaks("whoCanRead", scoped);
  expect(scoped.answered).toBe(false);
  // The scope refusal is the one a scope holding nothing gets, but its name (E2.13-5).
  const empty = await plane.whoCanRead(outsider, "person:z", at);
  expect(scoped).toEqual({
    ...empty,
    target: "person:s",
    reason: empty.reason.replace("person:z", "person:s"),
  });
  expect(plane.events().length, "a who-can-read query appends no event").toBe(asked);
  // The approval queue (card E2.19): the outsider's view lists nothing of
  // the secret's scope; a refusal of the secret answers as for an unknown id,
  // naming no scope, and returns no item; a sweep of its scope names nothing of it.
  const queued = await plane.approvals(outsider, at);
  leaks("approvals", queued);
  expect(JSON.stringify(queued)).not.toContain("person:s");
  const refused = await plane.refuse(outsider, secret.id, "no", at);
  leaks("refuse", refused);
  expect(refused.item).toBeNull();
  expect([refused.event.scope_from, refused.event.scope_to]).toEqual([null, null]);
  const refusedNothing = await plane.refuse(outsider, unknown, "no", at);
  expect(refused.event.reason).toBe(refusedNothing.event.reason.replace(unknown, secret.id));
  leaks("expireRequests", await plane.expireRequests(outsider, "person:s", at));
  // The same under a policy with an approval block (verification note N7):
  // past the off refusal, the outsider meets the reach and membership rules.
  {
    const routed: Policy = {
      ...policy,
      write: policy.write.map((r) => ({ ...r, requires_review: true })),
      approval: { routes: [{ scope: "person", approvers: ["owner"], expires_after: 60 }] },
    };
    const { plane: queue } = freshPlane(routed);
    const held = { ...secret, status: "candidate" } as MemoryItem;
    expect((await queue.write(owner, held, at)).item?.status).toBe("candidate");
    const listed = await queue.approvals(outsider, at);
    leaks("approvals under a block", listed);
    expect(listed).toEqual([]);
    const no = await queue.refuse(outsider, secret.id, "no", at);
    leaks("refuse under a block", no);
    expect(no.item).toBeNull();
    expect([no.event.scope_from, no.event.scope_to]).toEqual([null, null]);
    const none = await queue.refuse(outsider, unknown, "no", at);
    expect(no.event.reason).toBe(none.event.reason.replace(unknown, secret.id));
    const swept = await queue.expireRequests(outsider, "person:s", "2026-10-26T12:00:00Z");
    leaks("expireRequests under a block", swept);
    expect(swept.decision).toBe("deny");
    expect(JSON.stringify(swept)).not.toContain(secret.id);
  }
  // simulate replays only the workload it is given, on scratch logs and
  // stores (card E8.9): the outsider's own read of the secret's words finds
  // nothing, and the real log gains no event.
  const logged = plane.events().length;
  leaks(
    "simulate",
    await plane.simulate(
      {
        id: "w",
        actors: { o: outsider },
        steps: [
          { op: "read", as: "o", at, text: "vault" },
          { op: "retain", as: "o", at, scope: "person:s" },
        ],
      },
      policy,
    ),
  );
  expect(plane.events().length, "simulate appends nothing to the real log").toBe(logged);
  for (const call of [() => plane.distill([], { id: "awm", model: "scripted/none", seed: 1 })])
    expect(
      await rejection(call()),
      "an unimplemented method must be classified when it lands",
    ).toBeInstanceOf(NotImplementedYet);

  // What write and promote return is the caller's own item.
  const mine = { ...claim, id: "01960000-0000-7000-8000-000000000002" } as MemoryItem;
  expect((await plane.write(outsider, mine, at)).item?.id).toBe(mine.id);
  const lifted = await plane.promote(owner, secret.id, "person:s", at, { review: false });
  expect(lifted.decision).toBe("allow");
  expect(lifted.item?.lineage[0]).toBe(secret.id);
}

// Invariant 1 across two handles (card E2.6; a `decision` log entry records
// the change). Two handles share one log and one store, each with its own
// write queue, as two processes do; the store yields to a fast-check
// scheduler before and after every call, so the walk explores the
// interleavings of the two handles' operations at every store call. Dana
// writes and rewrites person and role items (some carrying a live grant to
// Sam), changes their grants, has a reviewer promote her episodic items,
// sweeps, adopts the store, and Sam reads; once, on either handle, at any
// point, a colleague offboards her, erasing person:dana and handing
// role:release to Lee. Whatever the interleaving: no read whose event follows
// an item's erasure returns it; afterwards no erased id is in the projection,
// a rebuild, the store or a read, before or after another adoption; no event
// and no store record holds content written only to erased ids; and the
// store holds exactly what the projection holds for every projected item.
// Guards require erasures, reads that returned a granted item, and stale
// decisions refused under the lock (a conflict or erasing refusal).

const TWIN_PROFILE = new URL("../../../pi-package/profiles/twin.yaml", import.meta.url);
const W_AT = "2026-11-19T10:00:00Z";
const W_LATER = "2026-11-19T11:00:00Z";
const W_UNTIL = "2026-12-19T00:00:00Z";
const W_DANA: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "role:release"],
  source: "user",
};
const W_HR: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", "person:dana", "role:release"],
  source: "user",
};
const W_SAM: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
const W_ID = (n: number) => `01930000-0000-7000-8000-${String(n).padStart(12, "0")}`;
/** Dana's person items 1 to 4 and role items 5 and 6. */
const W_POOL = [1, 2, 3, 4, 5, 6].map(W_ID);
const W_SCOPES = ["person:dana", "role:release"];

/**
 * How a writer stops (review of PR #50, P50-2 and P50-6): not at all, by
 * throwing at the transaction that would commit it, after its store write,
 * or by failing its next store call after that write (a repair's).
 */
type Crash =
  | "none"
  | "commit"
  | "repair"
  | "offboard-list"
  | "offboard-erase"
  | "offboard-handover";
/** Where an offboarding stops after its mark: at its sweep's listing, its erasure's commit, or a handover's store write. */
type OffboardCrash = "none" | "list" | "erase" | "handover";
const arbCrash = fc.oneof(
  { arbitrary: fc.constant<Crash>("none"), weight: 3 },
  { arbitrary: fc.constantFrom<Crash>("commit", "repair"), weight: 1 },
);

type WalkOp =
  | { kind: "write"; pick: number; grant: boolean; episodic: boolean; crash: Crash }
  /** A new role item derived from a person item: a fresh id whose lineage names it (V4-3). */
  | { kind: "derive"; from: number; crash: Crash }
  | { kind: "grant"; pick: number; add: boolean; crash: Crash }
  | { kind: "promote"; pick: number; crash: Crash }
  | { kind: "retain" }
  | { kind: "adopt"; scope: number }
  | { kind: "read" }
  /** With `crash`, the offboarding stops after its mark, and is run again (V-1, V3-6). */
  | { kind: "offboard"; crash: OffboardCrash };

const arbWalkOp: fc.Arbitrary<WalkOp> = fc.oneof(
  {
    arbitrary: fc.record({
      kind: fc.constant("write" as const),
      pick: fc.nat(5),
      grant: fc.boolean(),
      episodic: fc.boolean(),
      crash: arbCrash,
    }),
    weight: 4,
  },
  {
    arbitrary: fc.record({
      kind: fc.constant("grant" as const),
      pick: fc.nat(5),
      add: fc.boolean(),
      crash: arbCrash,
    }),
    weight: 3,
  },
  {
    arbitrary: fc.record({
      kind: fc.constant("promote" as const),
      pick: fc.nat(3),
      crash: arbCrash,
    }),
    weight: 1,
  },
  {
    arbitrary: fc.record({
      kind: fc.constant("derive" as const),
      from: fc.nat(3),
      crash: arbCrash,
    }),
    weight: 2,
  },
  { arbitrary: fc.record({ kind: fc.constant("retain" as const) }), weight: 1 },
  { arbitrary: fc.record({ kind: fc.constant("adopt" as const), scope: fc.nat(1) }), weight: 2 },
  { arbitrary: fc.record({ kind: fc.constant("read" as const) }), weight: 2 },
);

/**
 * A short walk aimed at a crashed writer racing an erasure: one handle
 * writes a person item and rewrites it (or changes its grant), crashing at
 * the commit or at the repair; the other offboards, sometimes after an
 * operation of its own (P50-2).
 */
const arbCrashRace = fc
  .tuple(
    fc.nat(3),
    fc.boolean(),
    fc.constantFrom<Crash>("commit", "repair"),
    fc.array(arbWalkOp, { maxLength: 1 }),
    fc.boolean(),
  )
  .map(([pick, viaGrant, crash, before, onA]) => {
    const racer: WalkOp[] = [
      { kind: "write", pick, grant: false, episodic: false, crash: "none" },
      viaGrant
        ? { kind: "grant", pick, add: true, crash }
        : { kind: "write", pick, grant: true, episodic: false, crash },
    ];
    const eraser: WalkOp[] = [...before, { kind: "offboard", crash: "none" }];
    return onA ? ([racer, eraser] as const) : ([eraser, racer] as const);
  });

/** Two handles' operation lists, the offboarding inserted once into one of them. */
const arbAnyWalk = fc
  .tuple(
    fc.array(arbWalkOp, { minLength: 1, maxLength: 6 }),
    fc.array(arbWalkOp, { minLength: 1, maxLength: 6 }),
    fc.boolean(),
    fc.nat(6),
    fc.constantFrom<OffboardCrash>("none", "none", "list", "erase", "handover"),
  )
  .map(([a, b, onA, at, crash]) => {
    const into = onA ? a : b;
    const ops = [...into];
    ops.splice(Math.min(at, ops.length), 0, { kind: "offboard", crash });
    return onA ? ([ops, b] as const) : ([a, ops] as const);
  });

/**
 * A short walk aimed at a stale write adopted and then built on (V-2, V-3,
 * V3-3): one handle grants a role item and rewrites it keeping the grant;
 * the other removes the grant, adopts the role scope, and then changes the
 * item (a rewrite, or the grant added again), or does not; the offboarding
 * follows on either handle.
 */
const arbStaleRace = fc
  .tuple(
    fc.constantFrom<WalkOp>(
      { kind: "write", pick: 4, grant: false, episodic: false, crash: "none" },
      { kind: "grant", pick: 4, add: true, crash: "none" },
      { kind: "read" },
    ),
    fc.boolean(),
  )
  .map(([after, onA]) => {
    // The writer yields at its adoption's listing, then decides its rewrite
    // on whatever the owner has committed by then.
    const writer: WalkOp[] = [
      { kind: "adopt", scope: 1 },
      { kind: "write", pick: 4, grant: false, episodic: false, crash: "none" },
    ];
    const owner: WalkOp[] = [
      { kind: "write", pick: 4, grant: true, episodic: false, crash: "none" },
      { kind: "grant", pick: 4, add: false, crash: "none" },
      { kind: "adopt", scope: 1 },
      after,
    ];
    const offboard: WalkOp = { kind: "offboard", crash: "none" };
    const pair: [WalkOp[], WalkOp[]] = onA
      ? [[...writer, offboard], owner]
      : [writer, [...owner, offboard]];
    return pair;
  });

/**
 * A short walk aimed at content derived from a person item racing its
 * erasure (V3-1, V4-1, V4-3): one handle writes the item, then derives new
 * role items from it, some crashing; the other offboards, before or after
 * an operation of its own.
 */
const arbDeriveRace = fc
  .tuple(
    fc.nat(3),
    fc.array(fc.constantFrom<Crash>("commit", "commit", "repair", "none"), {
      minLength: 2,
      maxLength: 4,
    }),
    fc.array(arbWalkOp, { maxLength: 1 }),
    fc.boolean(),
  )
  .map(([from, crashes, before, onA]) => {
    const writer: WalkOp[] = [
      { kind: "write", pick: from, grant: false, episodic: false, crash: "none" },
      ...crashes.map((crash): WalkOp => ({ kind: "derive", from, crash })),
    ];
    const eraser: WalkOp[] = [...before, { kind: "offboard", crash: "none" }];
    const pair: [WalkOp[], WalkOp[]] = onA ? [writer, eraser] : [eraser, writer];
    return pair;
  });

const arbWalk = fc.oneof(
  { arbitrary: arbAnyWalk, weight: 3 },
  { arbitrary: arbCrashRace, weight: 2 },
  { arbitrary: arbStaleRace, weight: 1 },
  { arbitrary: arbDeriveRace, weight: 3 },
);

/** What the walk saw, for its guards. */
interface WalkSeen {
  erased: number;
  grantedReads: number;
  refusedStale: number;
  crashes: number;
  /** Offboardings that stopped after their mark and were run again (V-1). */
  offboardCrashes: number;
  /** Committed grant removals the walk checked at its end (V-2, V-3). */
  removalsKept: number;
  /** Withdrawals and narrowings the walk judged against the owner's later decisions. */
  recoveries: number;
  /** Allowed events of items whose lineage names an erased id, judged (V4-3). */
  derivedChecked: number;
  purged: number;
  /** Walks that ended with an erased id's record in the store, for the next adoption to delete. */
  erasedLeft: number;
}

async function twoHandleWalk(
  s: fc.Scheduler,
  [opsA, opsB]: readonly [WalkOp[], WalkOp[]],
  seen: WalkSeen,
): Promise<void> {
  const policy = parsePolicy(readFileSync(TWIN_PROFILE, "utf8"), "twin.yaml");
  const base = openSqlite(":memory:");
  migrate(base);
  /** One handle's crash plan for the operation it runs now. */
  interface Plan {
    crash: Crash;
    wrote: boolean;
    failTransaction: boolean;
  }
  const crashed = () => new Error("simulated crash of the writer");
  let crashes = 0;
  /** A handle: its own Db object, so its own write queue, over the one log. */
  const handle = (plan: Plan): Db => ({
    dialect: base.dialect,
    exec: (sql) => base.exec(sql),
    prepare: (sql) => base.prepare(sql),
    transaction: (fn) => {
      if (plan.failTransaction) {
        plan.failTransaction = false;
        crashes++;
        throw crashed();
      }
      return base.transaction(fn);
    },
    close: () => {},
  });
  const store = createFakeAdapter({ search: false, history: false });
  const yielding = (name: string, plan: Plan): Adapter => {
    const pass = (label: string) => s.schedule(Promise.resolve(label), label);
    /** A repair's store call, after the operation's first write, fails once. */
    const failRepair = () => {
      if (plan.crash !== "repair" || !plan.wrote) return;
      plan.crash = "none";
      crashes++;
      throw crashed();
    };
    return Object.assign(Object.create(store) as Adapter, {
      write: async (it: MemoryItem) => {
        await pass(`${name} write ${it.id} v${it.version}`);
        failRepair();
        const ref = await store.write(it);
        await pass(`${name} wrote ${it.id}`);
        if (!plan.wrote && plan.crash === "commit") {
          plan.crash = "none";
          plan.failTransaction = true;
        }
        if (plan.crash === "offboard-handover") {
          plan.crash = "none";
          crashes++;
          throw crashed();
        }
        plan.wrote = true;
        return ref;
      },
      delete: async (ref: { adapter: string; key: string }) => {
        await pass(`${name} delete ${ref.key}`);
        failRepair();
        await store.delete(ref);
        // The erasure's commit, which follows the first deletions, fails.
        if (plan.crash === "offboard-erase") {
          plan.crash = "none";
          plan.failTransaction = true;
        }
        await pass(`${name} deleted ${ref.key}`);
      },
      list: async (scope: string) => {
        await pass(`${name} list ${scope}`);
        if (plan.crash === "offboard-list") {
          plan.crash = "none";
          crashes++;
          throw crashed();
        }
        const listed = await store.list(scope);
        await pass(`${name} listed ${scope}`);
        return listed;
      },
      read: async (ref: { adapter: string; key: string }) => {
        await pass(`${name} read ${ref.key}`);
        return store.read(ref);
      },
    });
  };
  let n = 0;
  let tokens = 0;
  let derived = 0;
  /** Every content token written under each item id. */
  const written = new Map<string, Set<string>>();
  const reads: { seq: number; ids: string[] }[] = [];
  const refusals: MemoryEvent[] = [];
  const plans = new Map<PlaneDeps, Plan>();
  const deps = (name: string, from: number): PlaneDeps => {
    const plan: Plan = { crash: "none", wrote: false, failTransaction: false };
    const d: PlaneDeps = {
      db: handle(plan),
      adapter: yielding(name, plan),
      policy,
      newId: () => `01940000-0000-7000-8000-${String(from + ++n).padStart(12, "0")}`,
    };
    plans.set(d, plan);
    return d;
  };
  const run = async (d: PlaneDeps, ops: readonly WalkOp[]) => {
    const plane = createPlane(d);
    const plan = plans.get(d) as Plan;
    for (const op of ops) {
      plan.crash =
        op.kind === "write" || op.kind === "grant" || op.kind === "promote" || op.kind === "derive"
          ? op.crash
          : op.kind === "offboard" && op.crash !== "none"
            ? `offboard-${op.crash}`
            : "none";
      plan.wrote = false;
      plan.failTransaction = false;
      try {
        await step(plane, d, op);
      } catch (e) {
        // A crashed writer stops; anything else fails the walk.
        if (!(e instanceof Error && e.message === crashed().message)) throw e;
      }
      plan.crash = "none";
      plan.failTransaction = false;
    }
  };
  const step = async (plane: Plane, d: PlaneDeps, op: WalkOp) => {
    if (op.kind === "write") {
      const itemId = W_POOL[op.pick] as string;
      const scope = op.pick < 4 ? "person:dana" : "role:release";
      const cls = op.episodic && scope === "person:dana" ? "episodic" : "semantic";
      const held = itemById(d.db, itemId);
      const token = `zq${++tokens}x`;
      written.set(itemId, (written.get(itemId) ?? new Set()).add(token));
      const r = await plane.write(
        W_DANA,
        {
          id: itemId,
          class: held?.class ?? cls,
          scope,
          owner: held?.owner ?? W_DANA.id,
          content: `Dana's note ${token}`,
          provenance: {
            kind: "user",
            ref: "doc/1",
            hash: `sha256:${"0".repeat(64)}`,
            actor: W_DANA.id,
          },
          confidence: 0.9,
          valid_from: "2026-10-01T00:00:00Z",
          valid_to: null,
          ttl: null,
          grants: op.grant
            ? [{ to: W_SAM.id, class: held?.class ?? cls, mode: "read", expires: W_UNTIL }]
            : (held?.grants ?? []),
          version: (held?.version ?? 0) + 1,
          lineage: [],
          // The pool's fourth person item is written as a candidate, so an
          // offboarding meets an item of the person scope that is not
          // active and must erase it too (card X16, I1H-erase-active-only).
          status: op.pick === 3 ? "candidate" : "active",
          store_ref: null,
          schema_version: 1,
        } as MemoryItem,
        W_AT,
      );
      refusals.push(r.event);
    } else if (op.kind === "derive") {
      const source = W_POOL[op.from] as string;
      const r = await plane.write(
        W_DANA,
        {
          id: W_ID(1000 + ++derived),
          class: "semantic",
          scope: "role:release",
          owner: W_DANA.id,
          content: `Dana's derived note zq${++tokens}x`,
          provenance: {
            kind: "user",
            ref: "doc/1",
            hash: `sha256:${"0".repeat(64)}`,
            actor: W_DANA.id,
          },
          confidence: 0.9,
          valid_from: "2026-10-01T00:00:00Z",
          valid_to: null,
          ttl: null,
          grants: [],
          version: 1,
          lineage: [source],
          status: "active",
          store_ref: null,
          schema_version: 1,
        } as MemoryItem,
        W_AT,
      );
      refusals.push(r.event);
    } else if (op.kind === "grant") {
      const itemId = W_POOL[op.pick] as string;
      const held = itemById(d.db, itemId);
      const grant = {
        to: W_SAM.id,
        class: held?.class ?? "semantic",
        mode: "read" as const,
        expires: W_UNTIL,
      };
      const r = await plane.changeGrants(
        W_DANA,
        itemId,
        op.add ? { add: [grant] } : { remove: [held?.grants[0] ?? grant] },
        W_AT,
      );
      refusals.push(r.event);
    } else if (op.kind === "promote") {
      const r = await plane.promote(W_HR, W_POOL[op.pick] as string, "person:dana", W_AT, {
        review: true,
      });
      refusals.push(...r.events);
    } else if (op.kind === "retain") {
      await plane.retain(W_DANA, "person:dana", W_LATER);
    } else if (op.kind === "adopt") {
      await adoptStoreItems(d, W_DANA, W_SCOPES[op.scope] as string, W_AT);
    } else if (op.kind === "read") {
      const r = await plane.read(W_SAM, { at: W_LATER });
      reads.push({ seq: r.event.seq, ids: r.items.map((i) => i.id) });
    } else {
      const request = {
        person: "person:dana",
        roles: [{ scope: "role:release", successor: "person:lee" }],
      };
      try {
        await offboard(d, W_HR, request, W_AT);
      } catch (e) {
        if (!(e instanceof Error && e.message === crashed().message)) throw e;
        // Stopped after its mark: the person scope stays frozen until a rerun.
        seen.offboardCrashes++;
        const plan = plans.get(d) as Plan;
        plan.crash = "none";
        plan.failTransaction = false;
        expect(erasureOpen(base, "person:dana"), "frozen after a stopped offboarding").toBe(true);
        await offboard(d, W_HR, request, W_AT);
      }
    }
  };
  await s.waitFor(Promise.all([run(deps("A", 100_000), opsA), run(deps("B", 200_000), opsB)]));

  const log = allEvents(base);
  const erasedAt = new Map<string, number>();
  for (const e of log)
    if (e.decision === "allow" && e.policy_id === "engram/offboard/erase" && e.item_id)
      erasedAt.set(e.item_id, e.seq);
  seen.erased += erasedAt.size;
  seen.crashes += crashes;
  seen.purged += log.filter(
    (e) =>
      (e.policy_id === "engram/adopt/erased" &&
        e.reason.includes("the plane deletes the record from the store")) ||
      (e.policy_id === "engram/offboard/swept" && e.decision === "allow"),
  ).length;
  seen.refusedStale += refusals.filter((e) =>
    /\/conflict$|^engram\/offboard\/erasing$/.test(e.policy_id),
  ).length;
  // A read committed after an item's erasure never returns it.
  for (const r of reads) {
    if (r.ids.length > 0) seen.grantedReads++;
    for (const itemId of r.ids)
      expect(
        (erasedAt.get(itemId) ?? Number.POSITIVE_INFINITY) > r.seq,
        `read at seq ${r.seq} returned ${itemId}, erased at seq ${erasedAt.get(itemId)}`,
      ).toBe(true);
  }
  // The store holds what the projection holds, item by item, unless a writer
  // crashed: its bytes stay in the store, never projected (decision D6),
  // until the next adoption gates or deletes them.
  const listing = async () => (await Promise.all(W_SCOPES.map((sc) => store.list(sc)))).flat();
  // As adoption compares them: a retirement changes only the projection (ADR
  // 0010: retention and supersession never touch the store), and adoption
  // records a plane-written record again as import without writing the
  // store, so the provenance's kind and actor may differ (the finding of
  // packages/adapters/test/plane/grants-files.test.ts); nothing else may.
  const unsourced = (i: MemoryItem | undefined) =>
    i && { ...i, status: null, provenance: { ...i.provenance, kind: null, actor: null } };
  for (const held of crashes > 0 ? [] : currentItems(base)) {
    if (!held.store_ref) continue;
    // A withdrawn adoption of a write that never existed before retires the
    // item and deletes its record: the stale bytes are gone (V-2).
    const last = eventsByItem(base, held.id)
      .filter((e) => e.decision === "allow")
      .at(-1);
    if (last?.policy_id === "engram/adopt/withdrawn" && held.status === "retired") {
      expect(
        await store.read(held.store_ref),
        `the withdrawn record of ${held.id}`,
      ).toBeUndefined();
      continue;
    }
    expect(unsourced(await store.read(held.store_ref)), `the store's record of ${held.id}`).toEqual(
      unsourced(held),
    );
  }
  const surviving = currentItems(base);
  const survivingText = JSON.stringify(surviving);
  // Every token written under an erased id: none may survive anywhere, under
  // any id (verification pass 3, V3-1: content under a fresh id).
  void survivingText;
  const erasedOnly = [...erasedAt.keys()].flatMap((itemId) => [...(written.get(itemId) ?? [])]);
  const check = async (when: string, adopted: boolean) => {
    // A crashed writer's bytes are gone only once an adoption has run (P50-2).
    const storeToo = adopted || crashes === 0;
    const listed = await listing();
    for (const itemId of erasedAt.keys()) {
      expect(itemById(base, itemId), `${when}: erased ${itemId} projected`).toBeUndefined();
      if (storeToo)
        expect(
          listed.some((i) => i.id === itemId),
          `${when}: erased ${itemId} in the store`,
        ).toBe(false);
    }
    const text = JSON.stringify([allEvents(base), storeToo ? listed : []]);
    for (const t of erasedOnly) expect(text, `${when}: erased content ${t}`).not.toContain(t);
    // After an adoption, every record the store holds is one the log allowed:
    // in an offboarded person scope a write that never committed is deleted.
    if (adopted)
      for (const i of listed)
        expect(
          eventsByItem(base, i.id).some((e) => e.decision === "allow"),
          `${when}: the store holds ${i.id}, which the log never allowed`,
        ).toBe(true);
    for (const reader of [W_SAM, W_DANA]) {
      const r = await createPlane({ ...deps("C", 300_000), adapter: store }).read(reader, {
        at: W_LATER,
      });
      for (const it of r.items)
        expect(erasedAt.has(it.id), `${when}: ${reader.id} read erased ${it.id}`).toBe(false);
    }
  };
  // Every offboarding completed, the stopped ones by their rerun (V-1).
  expect(erasureOpen(base, "person:dana"), "an offboarding's mark left open").toBe(false);
  // Every offboarding erased the whole person scope (card X16, mutant
  // I1H-erase-active-only): as the log stood at its report, the scope holds
  // no item, candidates and retired ones included, but those a store failure
  // kept back (one deny each, offboarding again erases them).
  for (const r of log.filter(
    (e) => e.decision === "allow" && e.policy_id === "engram/offboard/report",
  )) {
    const keptBack = new Set(
      log
        .filter(
          (e) =>
            e.seq < r.seq &&
            e.decision === "deny" &&
            e.op === "retire" &&
            e.scope_from === "person:dana" &&
            e.policy_id === "engram/write/store-failure",
        )
        .map((e) => e.item_id),
    );
    const left = itemsAt(base, r.seq).filter(
      (i) => i.scope === "person:dana" && !keptBack.has(i.id),
    );
    expect(
      left.map((i) => `${i.id} (${i.status})`),
      `the offboarding reported at seq ${r.seq} left items of person:dana`,
    ).toEqual([]);
  }
  /**
   * A committed grant removal survives the plane's own recovery (V-2, V-3):
   * for every grant an owner's grant change removed, if the item carries it
   * at the end, an event after that removal brought it back deliberately: a
   * grant change, a write of the plane's that is not an adoption, or an
   * adoption of bytes their own writer then committed.
   */
  const removalsStand = (when: string) => {
    for (const e of allEvents(base)) {
      if (e.decision !== "allow" || e.policy_id !== "engram/grant/change" || !e.item) continue;
      const history = eventsByItem(base, e.item_id as string).filter((x) => x.decision === "allow");
      const before = [...history].reverse().find((x) => x.seq < e.seq && x.item)?.item;
      const now = itemById(base, e.item_id as string);
      if (!before || !now) continue;
      for (const g of before.grants) {
        if (e.item.grants.some((h) => sameGrant(g, h))) continue;
        seen.removalsKept++;
        if (!now.grants.some((h) => sameGrant(g, h))) continue;
        // Carried at the end: find the event after the removal that brought it back.
        let had = false;
        let back: MemoryEvent | undefined;
        for (const x of history.filter((y) => y.seq > e.seq)) {
          const has: boolean = x.item ? x.item.grants.some((h) => sameGrant(g, h)) : had;
          if (has && !had) back = x;
          had = has;
        }
        const deliberate =
          back !== undefined &&
          (back.policy_id === "engram/grant/change" ||
            (back.op === "write" && !back.reason.startsWith("adopted from store ")) ||
            (back.reason.startsWith("adopted from store ") &&
              history.some(
                (y) =>
                  y.seq > (back as MemoryEvent).seq &&
                  y.op === "write" &&
                  !y.reason.startsWith("adopted from store ") &&
                  y.item?.content === back?.item?.content &&
                  y.item?.version === back?.item?.version,
              )));
        expect(
          deliberate,
          `${when}: the grant to ${g.to} that ${e.id} removed from ${e.item_id} is back, through ${back?.policy_id} at ${back?.seq}`,
        ).toBe(true);
      }
    }
  };
  removalsStand("after the walk");
  /**
   * Content traced to erased content by lineage never lands after the
   * erasure (V3-1, V4-1): every allowed event of an item whose lineage names
   * an erased id came before that id's erasure. A derived item committed
   * before stays, as the scope's, and its later versions (an adoption of
   * its own record, say) are its own.
   */
  const lineageStands = (when: string) => {
    const firsts = new Set<string>();
    for (const e of allEvents(base)) {
      if (e.decision !== "allow" || !e.item) continue;
      if (firsts.has(e.item.id)) continue;
      firsts.add(e.item.id);
      for (const ancestor of e.item.lineage) {
        const at = erasedAt.get(ancestor);
        if (at === undefined) continue;
        seen.derivedChecked++;
        expect(
          e.seq < at,
          `${when}: ${e.policy_id} at ${e.seq} lands ${e.item.id}, whose lineage names ${ancestor}, erased at ${at}`,
        ).toBe(true);
      }
    }
  };
  lineageStands("after the walk");
  /**
   * The plane's own recovery against the owner's later decisions (V-2, V3-3):
   * a withdrawal happens only while nothing but adoptions changed the item
   * since the adoption it names, and a narrowing never takes away a grant an
   * owner's grant change added after that adoption.
   */
  const recoveryKeepsOwnerDecisions = (when: string) => {
    const log2 = allEvents(base);
    for (const r of log2) {
      if (r.decision !== "allow") continue;
      if (r.policy_id !== "engram/adopt/withdrawn" && r.policy_id !== "engram/adopt/narrowed")
        continue;
      const named = /the adoption at event (\S+?)(?= |;|,|$)/.exec(r.reason)?.[1];
      const adoption = log2.find((e) => e.id === named);
      expect(adoption, `${when}: ${r.policy_id} ${r.id} names no event`).toBeDefined();
      const between = log2.filter(
        (e) =>
          e.item_id === r.item_id &&
          e.decision === "allow" &&
          e.seq > (adoption as MemoryEvent).seq &&
          e.seq < r.seq,
      );
      if (r.policy_id === "engram/adopt/withdrawn") {
        expect(
          between.every((e) => e.reason.startsWith("adopted from store ")),
          `${when}: withdrawal ${r.id} put a version back over a later change`,
        ).toBe(true);
        seen.recoveries++;
        continue;
      }
      const before = [...log2]
        .reverse()
        .find(
          (e) => e.seq < r.seq && e.item_id === r.item_id && e.item && e.decision === "allow",
        )?.item;
      const removed = (before?.grants ?? []).filter(
        (g) => !(r.item?.grants ?? []).some((h) => sameGrant(g, h)),
      );
      for (const g of removed)
        expect(
          between.some(
            (e) =>
              e.policy_id === "engram/grant/change" &&
              e.item?.grants.some((h) => sameGrant(g, h)) &&
              !log2
                .filter(
                  (x) =>
                    x.item_id === r.item_id && x.decision === "allow" && x.item && x.seq < e.seq,
                )
                .at(-1)
                ?.item?.grants.some((h) => sameGrant(g, h)),
          ),
          `${when}: narrowing ${r.id} took away the grant to ${g.to} an owner added after the adoption`,
        ).toBe(false);
      seen.recoveries++;
    }
  };
  recoveryKeepsOwnerDecisions("after the walk");
  const left = await listing();
  // An erased id's record, or one whose lineage names an erased id, left for
  // the next adoption to delete.
  if (
    [...erasedAt.keys()].some((itemId) =>
      left.some((i) => i.id === itemId || (i.lineage.includes(itemId) && !itemById(base, i.id))),
    )
  )
    seen.erasedLeft++;
  await check("after the walk", false);
  rebuild(base);
  await check("after a rebuild", false);
  for (const scope of W_SCOPES)
    await adoptStoreItems({ ...deps("C", 300_000), adapter: store }, W_DANA, scope, W_LATER);
  await check("after another adoption", true);
  removalsStand("after another adoption");
  lineageStands("after another adoption");
  base.close();
}

// Invariants 6 and 7 (card RV4, review fix pass of PR #58; a `decision` log
// entry records the change). Items are written through the plane under
// ADMIT_ALL by writers of every source; then the store's records are edited
// outside the plane, as a person edits a memory folder by hand: content
// changed, the claimed kind changed, grants added, a record re-filed under a
// new id (its kind and grants edited too; sometimes written only after the
// scope was adopted without it) or deleted. Each scope is then adopted. A
// re-filed copy is judged against the kind of the item it copies (N-2). Every allowed adoption event is judged against the plane's item
// of its id just before it, from the oracle's own replay of the log: its
// kind is never more trusted than that item's (than `import`, for an id the
// plane never held; invariant 6), and it carries no grant that item does
// not (none, for a new id; invariant 7). `Kind` is the promotion walk's.

/** A hand edit of one record the plane wrote. */
type Tamper =
  | { how: "none" | "content" | "drop" }
  | { how: "kind"; kind: Kind }
  | { how: "grants"; grants: Grant[] }
  /** `between`: the record is deleted, the scope adopted, and only then the copy written (N-2). */
  | { how: "refile"; kind: Kind; grants: Grant[]; between: boolean };

const arbKind = fc.constantFrom<Kind>(...TRUST);
const arbTamper: fc.Arbitrary<Tamper> = fc.oneof(
  fc.constantFrom<Tamper>({ how: "none" }, { how: "content" }, { how: "drop" }),
  arbKind.map((kind): Tamper => ({ how: "kind", kind })),
  fc
    .array(arbGatedGrant, { minLength: 1, maxLength: 2 })
    .map((grants): Tamper => ({ how: "grants", grants: grants as Grant[] })),
  fc.tuple(arbKind, fc.array(arbGatedGrant, { maxLength: 2 }), fc.boolean()).map(
    ([kind, grants, between]): Tamper => ({
      how: "refile",
      kind,
      grants: grants as Grant[],
      between,
    }),
  ),
);

interface AdoptionCase {
  items: MemoryItem[];
  /** The source of each item's writer. */
  sources: Kind[];
  tampers: Tamper[];
  at: string;
}

const arbAdoptionCase: fc.Arbitrary<AdoptionCase> = fc.record({
  items: fc.uniqueArray(arbGatedItem, { selector: (i) => i.id, minLength: 1, maxLength: 5 }),
  sources: fc.array(arbKind, { minLength: 5, maxLength: 5 }),
  tampers: fc.array(arbTamper, { minLength: 5, maxLength: 5 }),
  at: arbTimestamp,
});

const adoptionCounters = () => ({
  adoptedHeld: 0,
  adoptedNew: 0,
  claimRaised: 0,
  refiled: 0,
  refiledLater: 0,
  grantDropped: 0,
  grantKept: 0,
});

const edited = (content: MemoryItem["content"]): MemoryItem["content"] =>
  typeof content === "string"
    ? `${content} (edited by hand)`
    : ({ ...content, body: `${content.body} (edited by hand)` } as MemoryItem["content"]);

/**
 * Runs one case and calls `judge` on every allowed adoption event's item with
 * the plane's item of that id just before the event (undefined when the plane
 * held none).
 */
async function adoptionCase(
  c: AdoptionCase,
  seen: ReturnType<typeof adoptionCounters>,
  judge: (
    adopted: MemoryItem,
    before: MemoryItem | undefined,
    why: string,
    origin: Kind | undefined,
  ) => void,
): Promise<void> {
  const { db, adapter, plane, newId } = freshPlane(ADMIT_ALL);
  for (const [k, item] of c.items.entries()) {
    const source = c.sources[k] ?? "user";
    const writer: Actor & { source: Kind } = {
      id: item.owner,
      level: "person",
      memberships: [item.scope],
      source,
    };
    await plane.write(writer, item, c.at);
  }
  const claimed = new Map<string, Kind>();
  /** A re-filed record's id, and the kind the plane held the item it copies at. */
  const origins = new Map<string, Kind>();
  const later: MemoryItem[] = [];
  for (const [k, held] of currentItems(db).entries()) {
    const tamper = c.tampers[k] ?? { how: "none" };
    const ref = held.store_ref;
    if (!ref) continue;
    const record = { ...held, store_ref: null } as MemoryItem;
    if (tamper.how === "content")
      await adapter.write({ ...record, content: edited(held.content) } as MemoryItem);
    if (tamper.how === "drop") await adapter.delete(ref);
    if (tamper.how === "kind") {
      await adapter.write({ ...record, provenance: { ...held.provenance, kind: tamper.kind } });
      claimed.set(held.id, tamper.kind);
    }
    if (tamper.how === "grants")
      await adapter.write({ ...record, grants: [...held.grants, ...tamper.grants] });
    if (tamper.how === "refile") {
      const id = `01930000-0000-7000-8000-${String(k + 1).padStart(12, "0")}`;
      await adapter.delete(ref);
      const copy = {
        ...record,
        id,
        provenance: { ...held.provenance, kind: tamper.kind },
        grants: [...held.grants, ...tamper.grants],
      } as MemoryItem;
      origins.set(id, held.provenance.kind);
      if (tamper.between) later.push(copy);
      else await adapter.write(copy);
      seen.refiled++;
    }
  }
  const start = allEvents(db).length;
  const scopes = [...new Set(c.items.map((i) => i.scope))].sort();
  const adopter: Actor = { id: "person:omar", level: "person", memberships: scopes };
  const adoptAll = async () => {
    for (const scope of scopes)
      await adoptStoreItems({ db, adapter, policy: ADMIT_ALL, newId }, adopter, scope, c.at);
  };
  await adoptAll();
  if (later.length > 0) {
    // The originals are retired by now; their copies arrive in a later pass.
    for (const copy of later) await adapter.write(copy);
    seen.refiledLater += later.length;
    await adoptAll();
  }

  // The oracle's own replay of the log: each item as the events left it.
  const state = new Map<string, MemoryItem>();
  for (const [k, e] of allEvents(db).entries()) {
    const before = e.item_id ? state.get(e.item_id) : undefined;
    const adoption =
      k >= start && e.op === "write" && e.decision === "allow" && e.item !== undefined;
    if (adoption && e.item && e.reason.startsWith("adopted from store ")) {
      const why = `event ${e.id}`;
      judge(e.item, before, why, origins.get(e.item.id));
      if (before) seen.adoptedHeld++;
      else seen.adoptedNew++;
      const claim = claimed.get(e.item.id);
      if (before && claim && TRUST.indexOf(claim) < TRUST.indexOf(before.provenance.kind))
        seen.claimRaised++;
      if (e.reason.includes("adoption dropped")) seen.grantDropped++;
      if (e.item.grants.length > 0) seen.grantKept++;
    }
    if (!e.item_id) continue;
    if (e.decision === "allow" && e.op === "retire" && e.policy_id === "engram/offboard/erase")
      state.delete(e.item_id);
    else {
      const after = e.decision === "allow" && e.item ? e.item : before;
      if (after && e.decision === "allow" && (e.op === "retire" || e.op === "evict"))
        state.set(e.item_id, { ...after, status: "retired" } as MemoryItem);
      else if (after) state.set(e.item_id, after);
    }
  }
}

// Invariant 8 (card E2.11, ADR 0040, decision 7; a `decision` log entry
// records the change, and the change needed a second reviewer). With
// trust.unattested_floor and trust.protect_trusted on, a walk of writes,
// rewrites, retires by status, promotions, sweeps (some under every budget
// one), adoptions of hand-edited records, and races on two handles over one
// log (a write on the second handle landing between a write's or a
// promotion's decision and its commit on the first; review E2.11-2), by
// three co-members of a person and a team scope who write as every source or
// none, claiming any kind. After
// each step, every event it appended is judged against the oracle's own
// replay of the log: no allowed write records a kind more trusted than its
// actor attests (`floorProblem`), and no allowed write or eviction by a less
// trusted source changes or removes a more trusted active item unless its
// owner acted as user (`protectionProblem`). Every budget check, a write's,
// a promotion's or an adoption's, evicts exactly the oracle's victims among
// the items the landing's kind may evict (`budgetVictims` with `eligible`),
// and so does every sweep, at its sweeper's attested kind, recording once per
// state the part of an overage it may not evict (review E2.11-5); no scope
// ends a step over a budget; replay reproduces the state. Guards require
// floored writes (a claim other than external landing external), rewrites
// and retires denied for trust, writes and promotions denied rather than
// evict a more trusted item, refusals at the commit, races, promotions,
// evictions that passed over a more trusted item, sweeps held back,
// adoptions denied for trust, and allowed rewrites.

const T_SCOPES = ["person:a", "team:t"] as const;
const T_ACTORS = ["person:a", "person:b", "agent:x"] as const;
const T_POOL = [1, 2, 3, 4, 5, 6].map((n) => `01960000-0000-7000-8000-00000000000${n}`);
const T_WORDS = ["alpha", "beta", "gamma", "delta"] as const;
const T_ADOPTER: Actor = { id: "person:a", level: "person", memberships: [...T_SCOPES] };

/** Every write admitted, persons read everything, a budget per scope and class, both options on. */
const trustPolicy = (budget: number, eviction: "recency" | "utility"): Policy => ({
  ...ADMIT_ALL,
  id: "trust-floors",
  read: {
    matrix: [{ reader: "person", may_read: ["person", "role", "team", "org"] }],
    honour_grants: false,
  },
  retention: T_SCOPES.flatMap((scope) =>
    (["episodic", "semantic"] as const).map((cls) => ({
      scope: levelOf(scope) as "person" | "team",
      class: cls,
      ttl: null,
      budget,
      eviction,
    })),
  ),
  trust: { unattested_floor: "on", protect_trusted: "on" },
});

/** A write of a pool id by one co-member: a rewrite when the plane holds it, else a new item. */
interface TrustWrite {
  op: "write";
  who: number;
  source: Kind | null;
  n: number;
  scope: number;
  cls: "episodic" | "semantic";
  claim: Kind;
  retire: boolean;
  word: number;
}
/** A promotion of a held pool id in its own scope (an episodic item becomes semantic). */
interface TrustPromote {
  op: "promote";
  who: number;
  source: Kind | null;
  n: number;
}

type TrustStep =
  | TrustWrite
  | TrustPromote
  | {
      op: "sweep";
      who: number;
      source: Kind | null;
      scope: number;
      tight: boolean;
      /** Sweep again at once: a recorded shortfall is not recorded again (review E2.11-10). */
      repeat: boolean;
    }
  /** Edit the store's record of a pool id by hand, then adopt its scope. */
  | { op: "adopt"; n: number }
  /**
   * Two handles over one log (card E2.6): `other` is written on the second
   * handle while `lead`, on the first, has decided and is writing the store,
   * so it lands between `lead`'s decision and its commit (review E2.11-2).
   */
  | {
      op: "race";
      lead: TrustWrite | TrustPromote;
      other: TrustWrite;
      /**
       * When the lead is a promotion, aim the other write at its target: a new
       * semantic item in the promoted item's scope, so it can fill the
       * target's budget between the promotion's decision and its commit,
       * written by a person so a less trusted promotion may not evict it.
       */
      aim: boolean;
    };

const arbTrustSource = fc.option(fc.constantFrom<Kind>(...KINDS), { nil: null, freq: 3 });
const arbTrustWrite: fc.Arbitrary<TrustWrite> = fc.record({
  op: fc.constant("write" as const),
  who: fc.integer({ min: 0, max: T_ACTORS.length - 1 }),
  source: arbTrustSource,
  n: fc.integer({ min: 0, max: T_POOL.length - 1 }),
  scope: fc.integer({ min: 0, max: T_SCOPES.length - 1 }),
  cls: fc.constantFrom<"episodic" | "semantic">("episodic", "semantic"),
  claim: fc.constantFrom<Kind>(...KINDS),
  retire: fc.boolean(),
  word: fc.integer({ min: 0, max: T_WORDS.length - 1 }),
});
const arbTrustPromote: fc.Arbitrary<TrustPromote> = fc.record({
  op: fc.constant("promote" as const),
  who: fc.integer({ min: 0, max: T_ACTORS.length - 1 }),
  source: arbTrustSource,
  n: fc.integer({ min: 0, max: T_POOL.length - 1 }),
});
const arbTrustStep: fc.Arbitrary<TrustStep> = fc.oneof(
  { weight: 6, arbitrary: arbTrustWrite },
  { weight: 2, arbitrary: arbTrustPromote },
  {
    weight: 2,
    arbitrary: fc.record({
      op: fc.constant("sweep" as const),
      who: fc.integer({ min: 0, max: T_ACTORS.length - 1 }),
      source: arbTrustSource,
      scope: fc.integer({ min: 0, max: T_SCOPES.length - 1 }),
      tight: fc.boolean(),
      repeat: fc.boolean(),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      op: fc.constant("adopt" as const),
      n: fc.integer({ min: 0, max: T_POOL.length - 1 }),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      op: fc.constant("race" as const),
      lead: fc.oneof(arbTrustWrite, arbTrustPromote),
      other: arbTrustWrite,
      aim: fc.boolean(),
    }),
  },
);

const arbTrustCase = fc.record({
  budget: fc.integer({ min: 1, max: 3 }),
  eviction: fc.constantFrom<"recency" | "utility">("recency", "utility"),
  steps: fc.array(arbTrustStep, { minLength: 4, maxLength: 16 }),
});

const trustCounters = () => ({
  floored: 0,
  rewriteDenied: 0,
  retireDenied: 0,
  writeDeniedForBudget: 0,
  evictedAround: 0,
  sweepHeldBack: 0,
  adoptionDenied: 0,
  rewroteAtTrust: 0,
  promoted: 0,
  promotionDeniedForBudget: 0,
  raced: 0,
  refusedAtCommit: 0,
  promotionRefusedAtCommit: 0,
  shortfallNotRepeated: 0,
});

const SUPERSEDED = /\/promotion\/superseded$/;
const DOWNGRADE = "engram/write/downgrade";

/** One invariant 8 walk. */
async function trustWalk(
  c: { budget: number; eviction: "recency" | "utility"; steps: TrustStep[] },
  seen: ReturnType<typeof trustCounters>,
): Promise<void> {
  const policy = trustPolicy(c.budget, c.eviction);
  const tight = { ...trustPolicy(1, c.eviction), id: "trust-floors-tight" };
  const { db, adapter, newId } = freshPlane(policy);
  /** What the first handle's next store write runs first, once: the race's other write. */
  let midWrite: (() => Promise<void>) | null = null;
  const hooked: Adapter = Object.assign(Object.create(adapter) as Adapter, {
    write: async (it: MemoryItem) => {
      const run = midWrite;
      midWrite = null;
      if (run) await run();
      return adapter.write(it);
    },
  });
  const plane = createPlane({ db, adapter: hooked, policy, newId });
  /** The second handle: its own Db object, so its own write queue, over the one log. */
  const handleB: Db = {
    dialect: db.dialect,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    transaction: (fn) => db.transaction(fn),
    close: () => {},
  };
  const planeB = createPlane({ db: handleB, adapter, policy, newId });
  const tightPlane = createPlane({ db, adapter, policy: tight, newId });
  const actorOf = (who: number, source: Kind | null): Actor => ({
    id: T_ACTORS[who] as string,
    level: "person",
    memberships: [...T_SCOPES],
    ...(source === null ? {} : { source }),
  });
  /** May an eviction at `kind` by `actor` choose `victim`, as the oracle reads protection? */
  const eligibleFor = (p: Policy, actor: Actor, kind: Kind) => (victim: MemoryItem) =>
    protectionProblem(
      p,
      actor,
      victim,
      { op: "evict", decision: "allow", actor: actor.id, item_id: victim.id } as MemoryEvent,
      kind,
    ) === undefined;
  const ruleFor = (p: Policy, scope: string, cls: MemoryItem["class"]) =>
    p.retention.find((r) => r.scope === levelOf(scope) && r.class === cls);
  const activeAt = (seq: number, scope: string, cls: MemoryItem["class"]) =>
    (seq < 0 ? [] : itemsAt(db, seq)).filter(
      (x) => x.scope === scope && x.class === cls && x.status === "active",
    );
  /** The write a step makes, as its actor and item, from the projection now. */
  const written = (w: TrustWrite): [Actor, MemoryItem] => {
    const actor = actorOf(w.who, w.source);
    const id = T_POOL[w.n] as string;
    const held = itemById(db, id);
    const word = T_WORDS[w.word] as string;
    const claim = {
      kind: w.claim,
      ref: "doc/1",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:carol",
    };
    const it: MemoryItem = held
      ? ({
          ...held,
          version: held.version + 1,
          store_ref: null,
          content: `${word} rewritten by ${actor.id}`,
          status: w.retire ? "retired" : "active",
          provenance: claim,
        } as MemoryItem)
      : ({
          id,
          class: w.cls,
          scope: T_SCOPES[w.scope],
          owner: actor.id,
          content: `${word} from ${actor.id}`,
          provenance: claim,
          confidence: 0.9,
          valid_from: "2026-10-01T00:00:00Z",
          valid_to: null,
          ttl: null,
          grants: [],
          version: 1,
          lineage: [],
          status: "active",
          store_ref: null,
          schema_version: 1,
        } as MemoryItem);
    return [actor, it];
  };
  /** Runs a write or a promotion on the first handle; returns its actor. */
  const lead = async (s: TrustWrite | TrustPromote, at: string): Promise<Actor> => {
    if (s.op === "write") {
      const [actor, it] = written(s);
      await plane.write(actor, it, at);
      return actor;
    }
    const actor = actorOf(s.who, s.source);
    const held = itemById(db, T_POOL[s.n] as string);
    if (held && held.status === "active") await plane.promote(actor, held.id, held.scope, at);
    return actor;
  };
  /** The oracle's own replay of the log, up to the events judged so far. */
  const state = new Map<string, MemoryItem>();

  /** Judges one run of events, all by `actor`; `sweeping` when they are a sweep's. */
  const judge = (actor: Actor, events: MemoryEvent[], sweeping: boolean, why0: string) => {
    const why = (e: MemoryEvent) =>
      `${why0}, event ${e.op}/${e.decision} ${e.item_id} ${e.policy_id}: ${e.reason}`;
    /** The kind of the landing whose budget check the evictions that follow belong to. */
    let trigger: Kind | undefined;
    for (const [j, e] of events.entries()) {
      const before = e.item_id ? state.get(e.item_id) : undefined;
      if (e.decision === "deny" && e.policy_id === DOWNGRADE) {
        if (e.reason.includes("before it was committed")) {
          seen.refusedAtCommit++;
          if (e.op === "promote") seen.promotionRefusedAtCommit++;
        }
        if (e.op === "promote") seen.promotionDeniedForBudget++;
        else if (e.reason.startsWith("adopted from store ")) seen.adoptionDenied++;
        else if (e.reason.includes("would have to evict")) seen.writeDeniedForBudget++;
        else if (e.reason.includes(" write retires ")) seen.retireDenied++;
        else seen.rewriteDenied++;
      }
      const lands = (e.op === "write" || e.op === "promote") && e.decision === "allow" && e.item;
      if (lands && e.item) {
        trigger = e.item.provenance.kind;
        if (e.op === "promote") seen.promoted++;
        if (before?.status === "active" && e.item.status === "active" && e.op === "write")
          seen.rewroteAtTrust++;
        // The landing's budget check follows its event directly (invariant
        // 5), after a promotion's retirement of its source.
        let k = j + 1;
        if (
          e.op === "promote" &&
          events[k]?.op === "retire" &&
          SUPERSEDED.test(events[k]?.policy_id ?? "")
        )
          k++;
        const at = (events[k - 1] as MemoryEvent).seq;
        const slot: MemoryEvent[] = [];
        for (const f of events.slice(k)) {
          if (f.op !== "evict") break;
          slot.push(f);
        }
        const rule = ruleFor(policy, e.item.scope, e.item.class);
        if (rule && rule.budget !== null && e.item.status === "active") {
          const active = activeAt(at, e.item.scope, e.item.class);
          const changed = lastChanged(allEvents(db), at);
          const eligible = eligibleFor(policy, actor, e.item.provenance.kind);
          const expected = budgetVictims(
            rule.eviction,
            rule.budget,
            active,
            changed,
            new Map(),
            e.item.id,
            eligible,
          );
          const plain = budgetVictims(
            rule.eviction,
            rule.budget,
            active,
            changed,
            new Map(),
            e.item.id,
          );
          expect(
            slot.map((f) => [f.op, f.decision, f.item_id]),
            `the budget check evicts exactly the oracle's eligible victims: ${why(e)}`,
          ).toEqual((expected as string[]).map((v) => ["evict", "allow", v]));
          if (JSON.stringify(plain) !== JSON.stringify(expected)) seen.evictedAround++;
        }
      }
      expect(floorProblem(policy, actor, e), why(e)).toBeUndefined();
      expect(
        protectionProblem(policy, actor, before, e, sweeping ? undefined : trigger),
        why(e),
      ).toBeUndefined();
      replayEvent(state, e);
    }
  };
  /** Counts a floored write: sourceless, claiming a kind other than external, landed external. */
  const countFloor = (w: TrustWrite, events: MemoryEvent[]) => {
    if (w.source !== null || w.claim === "external") return;
    const id = T_POOL[w.n] as string;
    if (
      events.some(
        (e) =>
          e.op === "write" &&
          e.decision === "allow" &&
          e.item_id === id &&
          e.item?.provenance.kind === "external",
      )
    )
      seen.floored++;
  };

  for (const [k, step] of c.steps.entries()) {
    const at = stepTime(k);
    const start = allEvents(db).length;
    const lastSeq = start === 0 ? -1 : (allEvents(db).at(-1)?.seq ?? -1);
    const label = `step ${k} (${JSON.stringify(step)})`;
    if (step.op === "write" || step.op === "promote") {
      const actor = await lead(step, at);
      const events = allEvents(db).slice(start);
      if (step.op === "write") countFloor(step, events);
      judge(actor, events, false, label);
    } else if (step.op === "race") {
      let mid = -1;
      let otherActor: Actor | undefined;
      let other = step.other;
      const target =
        step.lead.op === "promote" ? itemById(db, T_POOL[step.lead.n] as string) : null;
      if (step.aim && target) {
        const free = T_POOL.findIndex((id) => itemById(db, id) === undefined);
        other = {
          ...other,
          cls: "semantic",
          scope: T_SCOPES.indexOf(target.scope as (typeof T_SCOPES)[number]),
          n: free === -1 ? other.n : free,
          retire: false,
          // A person writes it, so a less trusted promotion may not evict it.
          source: "user",
        };
      }
      midWrite = async () => {
        const [actor, it] = written(other);
        otherActor = actor;
        await planeB.write(actor, it, at);
        mid = allEvents(db).length;
      };
      const leadActor = await lead(step.lead, at);
      if (midWrite !== null) {
        // The lead never reached the store: the other write runs after it.
        midWrite = null;
        const leadEnd = allEvents(db).length;
        const [actor, it] = written(other);
        await planeB.write(actor, it, at);
        judge(leadActor, allEvents(db).slice(start, leadEnd), false, `${label}, lead`);
        judge(actor, allEvents(db).slice(leadEnd), false, `${label}, other after`);
        countFloor(other, allEvents(db).slice(leadEnd));
      } else {
        seen.raced++;
        judge(otherActor as Actor, allEvents(db).slice(start, mid), false, `${label}, other`);
        judge(leadActor, allEvents(db).slice(mid), false, `${label}, lead after`);
        countFloor(other, allEvents(db).slice(start, mid));
      }
      if (step.lead.op === "write") countFloor(step.lead, allEvents(db).slice(start));
    } else if (step.op === "sweep") {
      /** One sweep from log position `from` (the seq before it `before`); true when it recorded a shortfall. */
      const sweepOnce = async (from: number, before: number, tag: string) => {
        const actor = actorOf(step.who, step.source);
        const sweepPolicy = step.tight ? tight : policy;
        const scope = T_SCOPES[step.scope] as string;
        await (step.tight ? tightPlane : plane).retain(actor, scope, at);
        const events = allEvents(db).slice(from);
        judge(actor, events, true, tag);
        // The sweep's evictions, class by class, at the sweeper's attested kind;
        // a part of an overage it may not evict is recorded once per state
        // (engram/retention/protected, review E2.11-5).
        const expected: (string | null)[][] = [];
        let unrestricted = 0;
        const log = allEvents(db).filter((e) => e.seq <= before);
        for (const cls of ["episodic", "semantic", "procedural"] as const) {
          const rule = ruleFor(sweepPolicy, scope, cls);
          if (!rule || rule.budget === null) continue;
          const active = activeAt(before, scope, cls);
          const changed = lastChanged(log, before);
          const eligible = eligibleFor(sweepPolicy, actor, attestedKind(actor));
          const victims = budgetVictims(
            rule.eviction,
            rule.budget,
            active,
            changed,
            new Map(),
            undefined,
            eligible,
          ) as string[];
          const over = Math.max(0, active.length - rule.budget);
          unrestricted += over;
          for (const v of victims) expected.push(["evict", "allow", v]);
          if (victims.length < over) {
            const recorded = log
              .filter(
                (e) =>
                  e.op === "evict" &&
                  e.decision === "deny" &&
                  e.scope_to === scope &&
                  e.policy_id === "engram/retention/protected" &&
                  e.reason.includes(`its ${cls} budget`),
              )
              .at(-1)?.seq;
            const own = (before < 0 ? [] : itemsAt(db, before)).filter(
              (x) => x.scope === scope && x.class === cls,
            );
            const latest = Math.max(-1, ...own.map((x) => changed.get(x.id) ?? -1));
            if (recorded === undefined || latest > recorded) expected.push(["evict", "deny", null]);
          }
        }
        expect(
          events.map((e) => [e.op, e.decision, e.item_id]),
          `the sweep of ${scope} by ${actor.id} (${actor.source ?? "no source"}) at ${tag}`,
        ).toEqual(expected);
        if (expected.filter((e) => e[1] === "allow").length < unrestricted) seen.sweepHeldBack++;
        return expected.some((e) => e[1] === "deny");
      };
      const recorded = await sweepOnce(start, lastSeq, label);
      if (step.repeat && recorded) {
        const again = allEvents(db).length;
        const seq = allEvents(db).at(-1)?.seq ?? -1;
        await sweepOnce(again, seq, `${label}, repeated`);
        if (allEvents(db).length === again) seen.shortfallNotRepeated++;
      }
    } else {
      const actor: Actor = { ...T_ADOPTER, source: "import" };
      const held = itemById(db, T_POOL[step.n] as string);
      if (held?.store_ref && held.status === "active") {
        await adapter.write({
          ...held,
          store_ref: null,
          content: `${String(held.content)} (edited by hand)`,
        } as MemoryItem);
        for (const scope of T_SCOPES)
          await adoptStoreItems({ db, adapter, policy, newId }, T_ADOPTER, scope, at);
      }
      judge(actor, allEvents(db).slice(start), false, label);
    }

    // No scope ends a step over a budget of the plane's own policy: a write
    // or promotion that would need a more trusted victim was denied, at its
    // decision or at its commit (sweeps under the tightened policy only evict).
    for (const scope of T_SCOPES)
      for (const cls of ["episodic", "semantic"] as const) {
        const rule = ruleFor(policy, scope, cls);
        const held = currentItems(db).filter(
          (x) => x.scope === scope && x.class === cls && x.status === "active",
        );
        expect(
          held.length,
          `${scope} ${cls} holds ${held.length} active items over a budget of ${rule?.budget} after step ${k} (${JSON.stringify(step)})`,
        ).toBeLessThanOrEqual(rule?.budget ?? Number.POSITIVE_INFINITY);
      }
  }

  const final = currentItems(db);
  rebuild(db);
  expect(currentItems(db), "replay reproduces the state").toEqual(final);
}
