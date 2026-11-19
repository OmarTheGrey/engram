// visibleEvents leaks nothing (plan decision 5; review findings R3-4 and
// R3-12; core review finding RV-CORE-4 of card RV7). The oracle is
// independent of the implementation: each event is built from a case drawn
// first (the viewer's own; another actor's naming, as source or as target, a
// member scope whose level the read matrix lets the viewer read; another
// actor's naming only scopes the viewer may not read, a member scope the
// matrix stops included; another actor's naming no scope), so whether it must
// be shown is known by construction. Every event carries an item, and
// a returned item must be one the viewer could read now: active in the
// projection and as carried, inside its validity window, and in a scope the
// read matrix lets the viewer read as a member, or reached by a grant naming it.

import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import { parsePolicy } from "../../src/policy/load.ts";
import type { MemoryEvent, MemoryItem, Policy } from "../../src/schema.ts";
import { visibleEvents } from "../../src/visible.ts";
import {
  arbGrantedItem,
  arbId,
  arbPolicy,
  arbTimestamp,
  SCOPE_LEVELS,
  seedFor,
} from "../generators.ts";
import { fresh, id, item } from "../unit/plane/helpers.ts";
import { patternCovers } from "./oracle.ts";

const RUNS = 1000;
const SCOPES = ["org", "person:a", "person:b", "role:a", "role:b", "team:a", "team:b", "team:c"];
const OTHERS = ["person:x", "person:y", "agent:pi"];
const CASES = ["own", "from-member", "to-member", "foreign", "unscoped"] as const;
type Case = (typeof CASES)[number];
const SHOWN: Record<Case, boolean> = {
  own: true,
  "from-member": true,
  "to-member": true,
  foreign: false,
  unscoped: false,
};

const arbViewer: fc.Arbitrary<Actor> = fc.record({
  id: fc.constantFrom("person:a", "person:b", "agent:claude-code"),
  level: fc.constantFrom(...SCOPE_LEVELS),
  // At least one scope stays outside, so the foreign case can always be built.
  memberships: fc.uniqueArray(fc.constantFrom(...SCOPES), { maxLength: SCOPES.length - 1 }),
});

/** The viewer's member scopes whose level its read matrix row lets it read. */
const readableScopes = (viewer: Actor, policy: Policy) => {
  const row = policy.read.matrix.find((r) => r.reader === viewer.level);
  return viewer.memberships.filter((s) =>
    (row?.may_read ?? []).includes(level(s) as Policy["read"]["matrix"][number]["reader"]),
  );
};

/** One event of a given case for `viewer`, with an item and the projection's version of it. */
function arbCase(viewer: Actor, policy: Policy) {
  const inside = readableScopes(viewer, policy);
  const outside = SCOPES.filter((s) => !inside.includes(s));
  const pick = (from: string[]) => fc.constantFrom(...(from as [string, ...string[]]));
  const orNull = (from: string[]) => fc.option(pick(from), { nil: null });
  const other = fc.constantFrom(...OTHERS.filter((o) => o !== viewer.id));
  const arbCaseName = fc.constantFrom(
    ...CASES.filter((c) => inside.length > 0 || (c !== "from-member" && c !== "to-member")),
  );
  return arbCaseName.chain((c) => {
    const scopes =
      c === "own"
        ? fc.tuple(orNull(SCOPES), orNull(SCOPES))
        : c === "from-member"
          ? fc.tuple(pick(inside), orNull(SCOPES))
          : c === "to-member"
            ? fc.tuple(orNull(SCOPES), pick(inside))
            : c === "foreign"
              ? fc
                  .tuple(orNull(outside), orNull(outside))
                  .filter(([f, t]) => f !== null || t !== null)
              : fc.constant([null, null] as [null, null]);
    return fc.record({
      case: fc.constant(c),
      actor: c === "own" ? fc.constant(viewer.id) : other,
      scopes,
      id: arbId,
      item: arbGrantedItem,
      current: fc.option(
        fc.constantFrom("active", "candidate", "retired") as fc.Arbitrary<MemoryItem["status"]>,
        { nil: undefined },
      ),
    });
  });
}

const arbWorld = fc.tuple(arbViewer, arbPolicy, arbTimestamp).chain(([viewer, policy, at]) =>
  fc.record({
    viewer: fc.constant(viewer),
    policy: fc.constant(policy),
    at: fc.constant(at),
    cases: fc.array(arbCase(viewer, policy), { maxLength: 25 }),
  }),
);

const level = (scope: string) => (scope === "org" ? "org" : scope.split(":")[0]);

/** Could the viewer read this item now, judged without the implementation's helpers. */
function readable(
  viewer: Actor,
  policy: { read: { matrix: { reader: string; may_read: string[] }[]; honour_grants: boolean } },
  item: MemoryItem,
): boolean {
  const row = policy.read.matrix.find((r) => r.reader === viewer.level);
  const byScope =
    viewer.memberships.includes(item.scope) &&
    (row?.may_read ?? []).includes(level(item.scope) as string);
  const byGrant =
    policy.read.honour_grants && item.grants.some((g) => patternCovers(g.to, viewer.id));
  return item.status === "active" && (byScope || byGrant);
}

describe("visibleEvents", () => {
  const name = "shows exactly the events the case says, in log order";
  test(name, () => {
    // Foreign events naming a member scope the read matrix stops (RV-CORE-4).
    let stopped = 0;
    fc.assert(
      fc.property(arbWorld, ({ viewer, policy, at, cases }) => {
        const log = cases.map((c, seq) => event(c, seq));
        const shown = visibleEvents(viewer, log, { policy, at, current: () => undefined });
        expect(shown.map((e) => e.seq)).toEqual(
          cases.flatMap((c, seq) => (SHOWN[c.case] ? [seq] : [])),
        );
        for (const c of cases)
          if (c.case === "foreign" && c.scopes.some((x) => x && viewer.memberships.includes(x)))
            stopped++;
      }),
      { numRuns: RUNS, seed: seedFor(name) },
    );
    expect(stopped, "foreign events naming a member scope the matrix stops").toBeGreaterThan(
      RUNS / 10,
    );
  });

  const items = "never returns an item the viewer could not read now";
  test(items, () => {
    fc.assert(
      fc.property(arbWorld, ({ viewer, policy, at, cases }) => {
        const log = cases.map((c, seq) => event(c, seq));
        const projected = new Map(
          cases.flatMap((c) =>
            c.current === undefined ? [] : [[c.item.id, { ...c.item, status: c.current }] as const],
          ),
        );
        const shown = visibleEvents(viewer, log, {
          policy,
          at,
          current: (id) => projected.get(id),
        });
        for (const e of shown) {
          if (!e.item) continue;
          expect(readable(viewer, policy, e.item)).toBe(true);
          const now = projected.get(e.item.id);
          if (now) expect(readable(viewer, policy, now)).toBe(true);
        }
      }),
      { numRuns: RUNS, seed: seedFor(items) },
    );
  });
});

function event(
  c: {
    case: Case;
    actor: string;
    scopes: readonly [string | null, string | null];
    id: string;
    item: MemoryItem;
  },
  seq: number,
): MemoryEvent {
  return {
    id: c.id,
    seq,
    ts: "2026-10-29T12:00:00Z",
    op: "write",
    item_id: c.item.id,
    actor: c.actor,
    scope_from: c.scopes[0],
    scope_to: c.scopes[1],
    decision: "allow",
    reason: "generated",
    policy_id: "p",
    item: c.item,
    schema_version: 1,
  };
}

// The core review's repro (RV-CORE-4, card RV7) on the real Plane under the
// twin profile: a role context that is a member of a person scope reads none
// of it (ADR 0021), so it sees none of its events either, a duplicate lint's
// content hash included (ADR 0009's amendment of 2026-11-13).
describe("a member the read matrix stops sees no event of the scope (RV-CORE-4)", () => {
  const PROFILE = new URL("../../../pi-package/profiles/twin.yaml", import.meta.url);
  const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
  const AT = "2026-11-20T10:00:00Z";
  const omar: Actor = {
    id: "person:omar",
    level: "person",
    memberships: ["person:omar", "role:x"],
    source: "user",
  } as Actor;
  const roleContext: Actor = {
    id: "agent:omar-role",
    level: "role",
    memberships: ["person:omar", "role:x"],
  };

  test("no write or lint event of person:omar reaches the role context; the maker sees its own", async () => {
    const env = fresh(twin());
    const note = (n: number) =>
      item(n, { scope: "person:omar", owner: omar.id, content: "The safe code is 4711." });
    expect((await env.plane.write(omar, note(1), AT)).event.decision).toBe("allow");
    expect((await env.plane.write(omar, note(2), AT)).event.decision).toBe("allow");
    const lint = await env.plane.lint(omar, AT, "person:omar");
    const dup = lint.events.find((e) => e.reason.includes("strict content hash"));
    expect(dup, "the duplicate lint names a content hash").toBeDefined();
    expect((await env.plane.read(roleContext, { at: AT })).items).toEqual([]);
    const view = { policy: env.policy, at: AT, current: () => undefined };
    const events = env.plane.events();
    const seen = visibleEvents(roleContext, events, view);
    expect(
      seen.filter((e) => e.scope_to === "person:omar" || e.scope_from === "person:omar"),
    ).toEqual([]);
    expect(seen.map((e) => e.op)).toEqual(["read"]);
    // The maker still sees its own events, and a reader of the scope sees them all.
    const own = visibleEvents(omar, events, view).map((e) => e.item_id);
    expect(own).toEqual(expect.arrayContaining([id(1), id(2)]));
    expect(own.length).toBe(events.filter((e) => e.op !== "read" || e.actor === omar.id).length);
  });
});
