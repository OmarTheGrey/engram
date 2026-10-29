// The invariants (docs/conventions/testing.md, "The invariants are always on").
// Owned by the lead: changing this file needs a second reviewer and a
// `decision` log entry. It never has a skip.
//
// All five run against the real Plane (createPlane), with the read filter of
// card E2.2, the write gate of card E2.3 and retention of card E2.4, under
// random policies. Invariants
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
// audit log no surface passes to a model.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { allEvents, appendEvent, currentItems, rebuild } from "../../src/events.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  ExplainDeniedError,
  NotImplementedYet,
  type Plane,
} from "../../src/plane.ts";
import { itemsAt } from "../../src/replay.ts";
import type { MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import { addSeconds, compareTimestamps } from "../../src/time.ts";
import {
  arbActor,
  arbGatedGrant,
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
  budgetVictims,
  type LoggedWrite,
  pastTtl,
  patternCovers,
  promotionPermitted,
  readable,
  TRUST,
  writeForbidden,
} from "./oracle.ts";

const RUNS = 1000;

function freshPlane(policy: Policy, search = true) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter({ search });
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const plane: Plane = createPlane({ db, adapter, policy, newId });
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
    allowed_sources: ["user", "document", "tool", "model", "import", "compaction"],
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
  schema_version: 0,
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
 * A write forbidden only by source isolation (follow-up I-1): a member's
 * model or compaction content, without grants, into a role, team or org
 * scope whose rule admits that source.
 */
const isolationOnly: fc.Arbitrary<WriteCase> = fc
  .tuple(
    arbPolicy,
    arbGrantedItem,
    arbWriter,
    fc.constantFrom<MemoryItem["provenance"]["kind"]>("model", "compaction"),
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
 * plane's own helper.
 */
function retiredByEvent(db: Parameters<typeof allEvents>[0]): MemoryItem[] {
  const last = new Map<string, MemoryEvent>();
  for (const e of allEvents(db))
    if (e.decision === "allow" && e.item_id !== null && CHANGING.includes(e.op))
      last.set(e.item_id, e);
  return currentItems(db).filter((i) => {
    const e = last.get(i.id);
    // Expiry by the item's own ttl was its writer's choice: no evidence (P4-13).
    return (e?.op === "retire" || e?.op === "evict") && e.policy_id !== "engram/retention/item-ttl";
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
      fc.constantFrom<MemoryItem["provenance"]["kind"]>("model", "compaction", "tool"),
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
              schema_version: 0,
            });
          }
          const projected = retiredByEvent(db);
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
          const forbidden = writeForbidden(policy, actor, item, projected);
          // Forbidden only because it restates retired content.
          if (otherwiseLands && forbidden && !writeForbidden(policy, actor, item)) seen.retired++;
          if (otherwiseLands && writeForbidden(policy, actor, item)) {
            if (!writeForbidden(policy, actor, repaired)) {
              if (item.grants.some((g) => g.class === undefined)) seen.noClass++;
              if (item.grants.some((g) => g.expires === undefined)) seen.noExpiry++;
            }
            if (
              item.grants.length === 0 &&
              ["model", "compaction"].includes(actor.source ?? item.provenance.kind) &&
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
        seen.planted > RUNS / 50,
      `invariant 2 needs writes that land, writes it forbids, and writes the policy's rule admits that are forbidden only by a grant without a class, a grant without an expiry, source isolation, or retired content; it saw ${JSON.stringify(seen)}`,
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
    const seen = {
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
    };
    await fc.assert(
      fc.asyncProperty(arbBudgetPolicy, arbSteps, async (policy, steps) => {
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
              const byAge = budgetVictims(
                "recency",
                rule.budget ?? 0,
                active,
                changed,
                reads,
                it.id,
              );
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

        for (const [i, step] of steps.entries()) {
          const at = stepTime(i);
          const start = allEvents(db).length;
          if (step.kind === "read") {
            const { explanations } = await plane.read(WRITER5, { text: step.text, at });
            for (const e of explanations) reads.set(e.item_id, (reads.get(e.item_id) ?? 0) + 1);
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
          expect(e.policy_id, `event ${e.seq} names a retention or adoption rule`).toMatch(
            /^(budgeted(-tight)?\/retention\/(person|team)\/(episodic|semantic|procedural)|engram\/retention\/(item-ttl|membership)|engram\/adopt\/retract)$/,
          );
          if (e.decision === "allow") expect(e.item_id).not.toBeNull();
        }
        rebuild(db);
        expect(currentItems(db), "replay reproduces every retirement").toEqual(state);
        if (log.length > 0) expect(itemsAt(db, log.length - 1)).toEqual(state);
      }),
      { numRuns: RUNS, seed: seedFor(I5) },
    );
    expect(
      Object.values(seen).every((n) => n > 0),
      `invariant 5 needs evictions by recency and by utility (some where reads, not age, chose the victim), a manual ask, a sweep that retired an expired item and one that evicted, a rewrite of a held id, a concurrent batch, an adopted item, a refused non-member sweep, and expired shared items a session left to a user; it saw ${JSON.stringify(seen)}`,
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
  | { kind: "read"; text: string }
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
const KINDS = ["user", "document", "tool", "model", "import", "compaction"] as const;
type Kind = (typeof KINDS)[number];
const TRUSTED: readonly Kind[] = ["user", "document", "tool"];
const P_SOURCE_ID = "01950000-0000-7000-8000-000000000000";
const pId = (n: number) => `01950000-0000-7000-8000-${String(n + 1).padStart(12, "0")}`;

/** A restatement of content made after the item: by whom, as what, and whether it matches. */
interface Restatement {
  actor: (typeof P_ACTORS)[number];
  kind: Kind;
  same: boolean;
  inScope: boolean;
}

const arbRestatement: fc.Arbitrary<Restatement> = fc.record({
  actor: fc.constantFrom(...P_ACTORS),
  kind: fc.oneof(
    { arbitrary: fc.constantFrom<Kind>("user", "document", "tool"), weight: 3 },
    { arbitrary: fc.constantFrom<Kind>("model", "compaction", "import"), weight: 2 },
  ),
  same: fc.oneof(
    { arbitrary: fc.constant(true), weight: 4 },
    { arbitrary: fc.constant(false), weight: 1 },
  ),
  inScope: fc.oneof(
    { arbitrary: fc.constant(true), weight: 5 },
    { arbitrary: fc.constant(false), weight: 1 },
  ),
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
      return {
        target,
        policy: {
          ...policy,
          write,
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
      kind: fc.constantFrom(...KINDS),
      confidence: fc.constantFrom(0.2, 0.7, 1),
    })
    // Model and compaction content lands only in person scope (ADR 0004, 0007).
    .map((s) =>
      s.kind === "model" || s.kind === "compaction" ? { ...s, scope: "person:a" as const } : s,
    ),
  restatements: fc.array(arbRestatement, { maxLength: 5 }),
  promoter: fc.record({
    id: fc.constantFrom(...P_ACTORS),
    source: fc.constantFrom<Kind | undefined>(
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
});

/** Invariant 2 over promotions (ADR 0026); runs inside invariant 2's test. */
async function promotionsLandOnlyWherePermitted(name: string) {
  const seen = {
    byConfirmation: 0,
    byReview: 0,
    asked: 0,
    sameActorOnly: 0,
    untrustedOnly: 0,
    ownerReview: 0,
    writeRule: 0,
  };
  await fc.assert(
    fc.asyncProperty(
      arbPromotionCase,
      async ({ policy: { policy, target }, source, restatements, promoter, at }) => {
        const { db, adapter, plane, under } = freshPlane(policy);
        const store = under(ADMIT_ALL);
        const word = "alpha";
        const content = (same: boolean) => (same ? restated(word) : "beta");
        const make = (n: number, scope: string, owner: string, text: MemoryItem["content"]) =>
          ({
            id: n < 0 ? P_SOURCE_ID : pId(n),
            class: source.class === "procedural" ? "procedural" : "episodic",
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
            schema_version: 0,
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
        } as MemoryItem;
        expect(
          (await store.write(writer(source.owner, source.scope, source.kind), item, at)).item,
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
            schema_version: 0,
          });
        for (const [n, r] of restatements.entries()) {
          const scope = r.inScope ? source.scope : "role:z";
          await store.write(
            writer(r.actor, scope, r.kind),
            make(n, scope, r.actor, content(r.same)),
            at,
          );
        }
        const actor: Actor = {
          id: promoter.id,
          level: "person",
          memberships: [
            ...new Set([...promoter.extra, ...(promoter.joins ? [source.scope, target] : [])]),
          ],
          ...(promoter.source ? { source: promoter.source } : {}),
        };
        const before = currentItems(db);
        const retired = retiredByEvent(db);
        const projected = before.find((i) => i.id === P_SOURCE_ID) as MemoryItem;
        const writes: LoggedWrite[] = allEvents(db).flatMap((e) =>
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
        const logLength = plane.events().length;
        const result = await plane.promote(actor, P_SOURCE_ID, target, at, {
          review: promoter.review,
        });
        const added = plane.events().slice(logLength);
        expect(added[0], "the decision is the first event the promotion appends").toEqual(
          result.event,
        );
        expect(result.events).toEqual(added.slice(0, result.events.length));
        for (const e of added) {
          expect(e.reason).not.toBe("");
          expect(e.policy_id).not.toBe("");
        }
        const shown = `${projected.class} ${projected.status} item of ${projected.owner} (${projected.provenance.kind}) in ${projected.scope}, promoted to ${target} by ${actor.id} (source ${actor.source ?? "none"}, member of [${actor.memberships.join(", ")}], review ${promoter.review}) after writes ${JSON.stringify(writes.map((w) => [w.actor, w.kind, w.scope, w.content]))} under ${JSON.stringify({ write: policy.write, promotion: policy.promotion })}: ${result.event.decision} ${result.event.policy_id} ${result.event.reason}`;

        // The evidence counts the oracle reads, for the guards.
        const sameText = writes.filter(
          (w) =>
            w.scope === projected.scope && JSON.stringify(w.content) !== JSON.stringify("beta"),
        );
        const k = policy.promotion.episodic_to_semantic.confirmations;
        const trustedItems = new Set(
          sameText.filter((w) => TRUSTED.includes(w.kind)).map((w) => w.item_id),
        ).size;
        const trustedActors = new Set(
          sameText.filter((w) => TRUSTED.includes(w.kind)).map((w) => w.actor),
        ).size;
        const anyActors = new Set(sameText.map((w) => w.actor)).size;

        if (result.item === null) {
          expect(
            currentItems(db),
            `a promotion that did not land changed nothing: ${shown}`,
          ).toEqual(before);
          if (result.decision === "ask") seen.asked++;
          const evidenceOnly =
            result.event.policy_id === "engram/promote/no-evidence" &&
            projected.class === "episodic" &&
            !promoter.review;
          if (evidenceOnly && trustedItems >= k && trustedActors < k) seen.sameActorOnly++;
          if (evidenceOnly && anyActors >= k && trustedActors < k) seen.untrustedOnly++;
          if (
            result.event.policy_id === "engram/promote/reviewer" &&
            actor.id === projected.owner &&
            actor.source === "user" &&
            actor.memberships.includes(target)
          )
            seen.ownerReview++;
          if (/\/write\//.test(result.event.policy_id) && trustedActors >= k) seen.writeRule++;
          return;
        }
        const landed = result.item;
        expect(
          promotionPermitted(policy, actor, projected, target, writes, promoter.review),
          `a promotion landed without the evidence ADR 0026 asks for: ${shown}`,
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
        seen[promoter.review ? "byReview" : "byConfirmation"]++;
      },
    ),
    { numRuns: RUNS, seed: seedFor(name) },
  );
  expect(
    Object.values(seen).every((n) => n > 0),
    `invariant 2 over promotions needs landings by confirmation and by review, an ask, and refusals where only the distinct-actor rule, only the trusted-kind rule, only the owner-as-reviewer rule or only the target's write rule stood in the way; it saw ${JSON.stringify(seen)}`,
  ).toBe(true);
}

/**
 * The Plane's surface (2606.24535): every method is accounted for, and none
 * hands an item to an actor who cannot read it. An item is held in a scope
 * the outsider is not in; each method is called by the outsider with what it
 * takes (the item's id where one is taken) and its result must not carry the
 * item's content. `read` filters; `write` and `promote` return only the
 * caller's own item; `events` is the audit log, which surfaces mirror to the
 * session record and never pass to a model.
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
    "checkWrite",
    "distill",
    "events",
    "explain",
    "lint",
    "promote",
    "read",
    "recordBypass",
    "retain",
    "simulate",
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
    schema_version: 0,
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
  const promoted = await plane.promote(outsider, secret.id, "team:b", at, { review: true });
  leaks("promote", promoted);
  expect(promoted.item).toBeNull();
  leaks("retain", await plane.retain(outsider, "person:s", at));
  leaks(
    "recordBypass",
    await plane.recordBypass(outsider, { command: "cat x", store: "files" }, at),
  );
  expect(await rejection(plane.explain(outsider, ownRead.id))).toBeInstanceOf(ExplainDeniedError);
  for (const call of [
    () => plane.lint("person:s"),
    () => plane.simulate({ id: "w", events: [] }, policy),
    () => plane.distill([], { id: "awm", model: "scripted/none", seed: 1 }),
  ])
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
