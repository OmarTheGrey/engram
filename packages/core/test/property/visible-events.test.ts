// visibleEvents leaks nothing (plan decision 5; review findings R3-4 and
// R3-12). The oracle is independent of the implementation: each event is
// built from a case drawn first (the viewer's own; another actor's naming a
// member scope as source or as target; another actor's naming only scopes the
// viewer is not a member of; another actor's naming no scope), so whether it
// must be shown is known by construction. Every event carries an item, and
// a returned item must be one the viewer could read now: active in the
// projection and as carried, inside its validity window, and in a scope the
// read matrix lets the viewer read as a member, or reached by a grant naming it.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../src/actor.ts";
import type { MemoryEvent, MemoryItem } from "../../src/schema.ts";
import { visibleEvents } from "../../src/visible.ts";
import {
  arbGrantedItem,
  arbId,
  arbPolicy,
  arbTimestamp,
  SCOPE_LEVELS,
  seedFor,
} from "../generators.ts";
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

/** One event of a given case for `viewer`, with an item and the projection's version of it. */
function arbCase(viewer: Actor) {
  const inside = viewer.memberships;
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
    cases: fc.array(arbCase(viewer), { maxLength: 25 }),
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
    fc.assert(
      fc.property(arbWorld, ({ viewer, policy, at, cases }) => {
        const log = cases.map((c, seq) => event(c, seq));
        const shown = visibleEvents(viewer, log, { policy, at, current: () => undefined });
        expect(shown.map((e) => e.seq)).toEqual(
          cases.flatMap((c, seq) => (SHOWN[c.case] ? [seq] : [])),
        );
      }),
      { numRuns: RUNS, seed: seedFor(name) },
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
