// Card E2.19's invariant, in its own property file (the lead-owned
// invariants file is not edited): under a policy whose approval block routes
// requests to named approvers, no candidate becomes active without an allow
// by a routed approver, given before its request expired. Random routes
// (a level or one scope; roles, persons, the owner; with and without an
// expiry), random sequences of held writes, rewrites, promotions with and
// without review by every kind of actor (the writer, a routed lead, an
// unrouted member, a lead outside the team, an agent), refusals and expiry
// sweeps, at an injected clock that moves by random steps. Each landing
// promotion is judged three ways: by this file's own reading of the routes
// and the request's expiry, by the oracle's `promotionPermitted` (which
// reads the approval block with its own code, oracle.ts), and against the
// queue's projection. Every expiry is an event at or after its due time, a
// final sweep leaves no due request unrecorded, and a held write is never
// landed: no read returns a candidate.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { currentItems } from "../../src/events.ts";
import { promotionPermitted } from "../../src/oracle.ts";
import {
  type Actor,
  APPROVAL_EXPIRED_ID,
  APPROVAL_REFUSED_ID,
  APPROVAL_ROUTE_ID,
  approvalQueue,
} from "../../src/plane.ts";
import type { MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import { compareTimestamps } from "../../src/time.ts";
import { seedFor } from "../generators.ts";
import { AT, fresh, id, item, testPolicy } from "../unit/plane/helpers.ts";

const INVARIANT =
  "no candidate becomes active without an allow by a routed approver before its request expires";
const EVERY_EXPIRY =
  "every expiry is one event, never before it is due, and a sweep leaves none due";
const RUNS = 500;
/** Each property takes about five seconds alone; the shared 30 s timeout is too tight under load. */
const SLOW = 180_000;

const user = (name: string, memberships: string[]): Actor => ({
  id: `person:${name}`,
  level: "person",
  memberships: [`person:${name}`, ...memberships],
  source: "user",
});
const ACTORS: Record<string, Actor> = {
  omar: user("omar", ["team:platform", "role:lead"]),
  ada: user("ada", ["team:platform", "role:lead"]),
  bob: user("bob", ["team:platform"]),
  carl: user("carl", ["role:lead"]),
  dana: user("dana", ["team:platform"]),
};
ACTORS.adaAgent = { ...(ACTORS.ada as Actor), source: "model" };
ACTORS.danaAgent = { ...(ACTORS.dana as Actor), source: "model" };
const NAMES = Object.keys(ACTORS);
const actor = (name: string) => ACTORS[name] as Actor;

type Routes = NonNullable<Policy["approval"]>["routes"];
const arbExpiry = fc.constantFrom<number | undefined>(undefined, 600, 3600);
const arbRoutes: fc.Arbitrary<Routes> = fc
  .record({
    team: fc.option(
      fc.record({
        scope: fc.constantFrom("team", "team:platform"),
        approvers: fc.subarray(["role:lead", "person:ada", "person:bob", "person:omar"], {
          minLength: 1,
        }),
        expires_after: arbExpiry,
      }),
      { nil: undefined },
    ),
    person: fc.option(
      fc.record({
        scope: fc.constantFrom("person", "person:dana"),
        approvers: fc.subarray(["owner", "person:ada"], { minLength: 1 }),
        expires_after: arbExpiry,
      }),
      { nil: undefined },
    ),
  })
  .map(
    ({ team, person }) =>
      [team, person]
        .filter((r) => r !== undefined)
        .map(({ expires_after, ...r }) =>
          expires_after === undefined ? r : { ...r, expires_after },
        ) as Routes,
  );

/** Every level but role requires review, so a user write there lands as a candidate. */
function policyWith(routes: Routes): Policy {
  const base = testPolicy();
  return {
    ...base,
    write: base.write.map((r) => ({ ...r, requires_review: r.scope !== "role" })),
    approval: { routes },
  };
}

type Step =
  | { kind: "write"; n: number; home: "team" | "person" | "role"; dt: number }
  | { kind: "rewrite"; n: number; dt: number }
  | { kind: "promote"; n: number; who: string; review: boolean; widen: boolean; dt: number }
  | { kind: "refuse"; n: number; who: string; dt: number }
  | { kind: "expire"; who: string; scope: "team:platform" | "person:dana"; dt: number };

const arbN = fc.integer({ min: 1, max: 2 });
const arbDt = fc.constantFrom(0, 0, 60, 60, 600, 1800, 3600);
/** The routed lead, a reviewer no role route names and the person owner, more often. */
const arbWho = fc.constantFrom(...NAMES, "ada", "ada", "bob", "dana");
const arbStep: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant("write" as const),
      n: arbN,
      home: fc.constantFrom("team" as const, "person" as const, "role" as const),
      dt: arbDt,
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant("rewrite" as const), n: arbN, dt: arbDt }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant("promote" as const),
      n: arbN,
      who: arbWho,
      review: fc.constantFrom(true, true, true, false),
      widen: fc.boolean(),
      dt: arbDt,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ kind: fc.constant("refuse" as const), n: arbN, who: arbWho, dt: arbDt }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant("expire" as const),
      who: arbWho,
      scope: fc.constantFrom("team:platform" as const, "person:dana" as const),
      dt: arbDt,
    }),
  },
);

const later = (from: string, seconds: number) =>
  new Date(Date.parse(from) + seconds * 1000).toISOString().replace(".000Z", "Z");

/** This file's own reading of a route: the one naming the scope, else its level. */
function routeOf(policy: Policy, target: string) {
  const routes = policy.approval?.routes ?? [];
  const lvl = target === "org" ? "org" : target.slice(0, target.indexOf(":"));
  return routes.find((r) => r.scope === target) ?? routes.find((r) => r.scope === lvl);
}

/** Does `route` name `who` for `source`: a person by id, a role by membership, the owner in their own person scope? */
function names(
  route: NonNullable<ReturnType<typeof routeOf>>,
  who: Actor,
  source: MemoryItem,
): boolean {
  return route.approvers.some((a) => {
    if (a === "owner")
      return who.id === source.owner && source.scope === who.id && source.class === "semantic";
    if (a.startsWith("person:")) return who.id === a;
    return who.memberships.includes(a);
  });
}

interface Run {
  policy: Policy;
  events: MemoryEvent[];
  /** The promote calls made with review, by the id of the event each appended first. */
  reviewed: Set<string>;
  end: string;
  reads: MemoryItem[][];
}

async function run(routes: Routes, steps: Step[]): Promise<Run> {
  const policy = policyWith(routes);
  const { plane, db } = fresh(policy);
  const reviewed = new Set<string>();
  let at = AT;
  const home = (h: "team" | "person" | "role") =>
    h === "team"
      ? { scope: "team:platform", owner: "person:omar", writer: "omar" }
      : h === "role"
        ? { scope: "role:lead", owner: "person:omar", writer: "omar" }
        : { scope: "person:dana", owner: "person:dana", writer: "dana" };
  for (const s of steps) {
    at = later(at, s.dt);
    const now = "n" in s ? currentItems(db).find((i) => i.id === id(s.n)) : undefined;
    if (s.kind === "write") {
      if (now) continue;
      const h = home(s.home);
      await plane.write(actor(h.writer), item(s.n, { scope: h.scope, owner: h.owner }), at);
    } else if (s.kind === "rewrite") {
      if (!now || now.status === "retired") continue;
      const writer = now.owner === "person:dana" ? "dana" : "omar";
      await plane.write(
        actor(writer),
        item(s.n, {
          scope: now.scope,
          owner: now.owner,
          version: now.version + 1,
          content: `fact number ${s.n}, version ${now.version + 1}`,
          status: "candidate",
        }),
        at,
      );
    } else if (s.kind === "promote") {
      const target =
        s.widen && now?.scope === "role:lead" ? "team:platform" : (now?.scope ?? "org");
      const r = await plane.promote(actor(s.who), id(s.n), target, at, { review: s.review });
      if (s.review) reviewed.add(r.event.id);
    } else if (s.kind === "refuse") {
      await plane.refuse(actor(s.who), id(s.n), `no, said ${s.who}`, at);
    } else {
      await plane.expireRequests(actor(s.who), s.scope, at);
    }
  }
  // A final sweep, far ahead, by a member of each scope that holds requests.
  const end = later(at, 86_400);
  await plane.expireRequests(actor("bob"), "team:platform", end);
  await plane.expireRequests(actor("dana"), "person:dana", end);
  await plane.expireRequests(actor("ada"), "role:lead", end);
  const reads: MemoryItem[][] = [];
  for (const name of NAMES)
    reads.push((await plane.read(actor(name), { text: "fact", at: end })).items);
  return { policy, events: plane.events(), reviewed, end, reads };
}

/** The item state before event `seq`, by this file's own replay. */
function stateBefore(events: readonly MemoryEvent[], seq: number): Map<string, MemoryItem> {
  const out = new Map<string, MemoryItem>();
  for (const e of events) {
    if (e.seq >= seq) break;
    if (e.decision !== "allow" || e.item_id === null) continue;
    if (e.item) out.set(e.item_id, e.item);
    else if (e.op === "retire" || e.op === "evict") {
      const was = out.get(e.item_id);
      if (was) out.set(e.item_id, { ...was, status: "retired" });
    }
  }
  return out;
}

/** When the request on `source`'s version opened, and into where, by this file's own reading. */
function openedFor(events: readonly MemoryEvent[], seq: number, source: MemoryItem) {
  let version = 0;
  for (const e of events) {
    if (e.seq >= seq) break;
    if (e.decision === "allow" && e.item?.id === source.id) version = e.item.version;
    if (version !== source.version) continue;
    if (
      (e.op === "write" || e.op === "update") &&
      e.decision === "allow" &&
      e.item?.id === source.id &&
      e.item.status === "candidate"
    )
      return { ts: e.ts, target: source.scope };
    if (e.op === "gate" && e.decision === "ask" && e.item_id === source.id)
      return { ts: e.ts, target: e.scope_to ?? source.scope };
  }
  return undefined;
}

const tally = {
  routedLandings: 0,
  ownerLandings: 0,
  routeRefusals: 0,
  selfRefusals: 0,
  expiries: 0,
  sweptExpiries: 0,
  refusals: 0,
};

describe("the approval queue's invariant (card E2.19)", () => {
  test(
    INVARIANT,
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbRoutes,
          fc.array(arbStep, { minLength: 4, maxLength: 24 }),
          async (routes, steps) => {
            const { policy, events, reviewed } = await run(routes, steps);
            const queue = approvalQueue(policy, events, AT);
            for (const e of events) {
              if (e.policy_id === APPROVAL_ROUTE_ID) tally.routeRefusals++;
              if (e.policy_id === APPROVAL_REFUSED_ID && e.decision === "allow") tally.refusals++;
              if (e.reason.includes("cannot approve its own item")) tally.selfRefusals++;
              if (e.op !== "promote" || e.decision !== "allow" || !e.item) continue;
              // In place, the item keeps its id; a new version's lineage starts at its source.
              const before = stateBefore(events, e.seq);
              const sourceId = before.has(e.item.id) ? e.item.id : (e.item.lineage[0] as string);
              const source = before.get(sourceId) as MemoryItem;
              expect(source, `the promotion ${e.id} names a source the log held`).toBeDefined();
              const prior = events.filter((x) => x.seq < e.seq);
              const review = reviewed.has(e.id);
              // The oracle, with its own reading of the approval block.
              const promoter = Object.values(ACTORS).find(
                (a) =>
                  a.id === e.actor &&
                  promotionPermitted(
                    policy,
                    a,
                    sourceId,
                    e.scope_to as string,
                    prior,
                    review,
                    e.ts,
                  ),
              );
              expect(promoter, `the oracle permits promotion ${e.id} by ${e.actor}`).toBeDefined();
              if (source.status !== "candidate") continue;
              // This file's own reading: a candidate lands only by a review a route names.
              const route = routeOf(policy, e.scope_to as string);
              expect(review, `candidate ${sourceId} landed without a review`).toBe(true);
              if (route) {
                const named = Object.values(ACTORS).some(
                  (a) => a.id === e.actor && a.source === "user" && names(route, a, source),
                );
                expect(named, `${e.actor} is not routed for ${e.scope_to}`).toBe(true);
                if (e.actor === source.owner) tally.ownerLandings++;
                else tally.routedLandings++;
              }
              // Never by its writer, save the owner's acceptance in their own person scope.
              if (e.actor === source.provenance.actor)
                expect(source.scope, `${e.actor} approved its own write`).toBe(e.actor);
              // Before its request expired.
              const opened = openedFor(events, e.seq, source);
              expect(opened, `candidate ${sourceId} landed with no request`).toBeDefined();
              const ttl = opened ? routeOf(policy, opened.target)?.expires_after : undefined;
              if (opened && ttl !== undefined)
                expect(
                  compareTimestamps(e.ts, later(opened.ts, ttl)),
                  `candidate ${sourceId} landed after its request expired`,
                ).toBeLessThan(0);
              // The projection agrees: the request on that version is approved by this event.
              const r = queue.find((q) => q.item_id === sourceId && q.version === source.version);
              expect(r?.state).toBe("approved");
              expect(r?.closed_by).toBe(e.id);
            }
          },
        ),
        { numRuns: RUNS, seed: seedFor(INVARIANT) },
      );
      // The property bites: routed approvals land, the route and the reviewer rule refuse.
      expect(tally.routedLandings).toBeGreaterThan(20);
      expect(tally.ownerLandings).toBeGreaterThan(0);
      expect(tally.routeRefusals).toBeGreaterThan(20);
      expect(tally.selfRefusals).toBeGreaterThan(20);
      expect(tally.refusals).toBeGreaterThan(5);
    },
    SLOW,
  );

  test(
    EVERY_EXPIRY,
    async () => {
      await fc.assert(
        fc.asyncProperty(
          arbRoutes,
          fc.array(arbStep, { minLength: 4, maxLength: 24 }),
          async (routes, steps) => {
            const { policy, events, end, reads } = await run(routes, steps);
            const expiries = events.filter(
              (e) => e.policy_id === APPROVAL_EXPIRED_ID && e.item_id !== null,
            );
            const seen = new Set<string>();
            for (const x of expiries) {
              tally.expiries++;
              expect(x.op).toBe("promote");
              expect(x.decision).toBe("deny");
              expect(x.reason.length).toBeGreaterThan(0);
              const source = stateBefore(events, x.seq).get(x.item_id as string) as MemoryItem;
              const opened = openedFor(events, x.seq, source);
              expect(opened, `expiry ${x.id} closes no request`).toBeDefined();
              const ttl = opened ? routeOf(policy, opened.target)?.expires_after : undefined;
              expect(ttl, `expiry ${x.id} under a route with no expiry`).toBeDefined();
              if (opened && ttl !== undefined)
                expect(compareTimestamps(x.ts, later(opened.ts, ttl))).toBeGreaterThanOrEqual(0);
              // The sweep records a request once; a later attempt on the version adds its own deny.
              if (
                x.actor === "person:bob" ||
                x.actor === "person:dana" ||
                x.actor === "person:ada"
              ) {
                const key = `${x.item_id}@${source.version}`;
                if (x.ts === end) {
                  expect(seen.has(key), `request ${key} recorded expired twice by sweeps`).toBe(
                    false,
                  );
                  tally.sweptExpiries++;
                }
                seen.add(key);
              }
            }
            // After the final sweep no request is due and unrecorded.
            for (const r of approvalQueue(policy, events, end))
              expect(r.due, `request on ${r.item_id}@${r.version} due and unrecorded`).toBe(false);
            // A held write is not landed: no read returns a candidate.
            for (const items of reads) for (const i of items) expect(i.status).toBe("active");
          },
        ),
        { numRuns: RUNS, seed: seedFor(EVERY_EXPIRY) },
      );
      expect(tally.expiries).toBeGreaterThan(20);
      expect(tally.sweptExpiries).toBeGreaterThan(10);
    },
    SLOW,
  );
});
