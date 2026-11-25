// Card RD1: a read reveals no more than the reader may see. Two rules, in
// core, so every surface agrees (lead-decisions item 36, answered (a); card
// E8.15c's finding on the read route's lineage ids).
//
// Grants. The owner of an item (its id is the item's owner and it may read
// the item's scope, as Plane.changeGrants and whoCanReadItem know it) is
// shown every grant on it; anyone else only the grants whose `to` names it.
// A member of the scope who is neither owner nor grantee is shown none.
// Each explanation's grants_used is numbered by the grants shown, so it
// never tells a grantee how many grants come before its own.
//
// Lineage. An id a lineage names is shown only when ADR 0047's by-id rule
// would let the reader ask for it: its item is in a scope the reader may
// read, or the read filter admits it at the read's time. Otherwise it is
// dropped, with no count, as the inspector's item page leaves it
// (packages/ui/src/provenance.ts).
//
// Counterexample style: dana owns team items granted to sam and to eve; lee
// is a member of the team with no grant; each case names who sees what.
import { describe, expect, test } from "vitest";
import { currentItems } from "../../src/events.ts";
import { type Actor, accessTime } from "../../src/plane.ts";
import type { Grant, MemoryItem } from "../../src/schema.ts";
import { visibleEvents } from "../../src/visible.ts";
import { fresh, id, item, testPolicy } from "../unit/plane/helpers.ts";

const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";

const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "team:platform", "org"],
  source: "user",
};
const sam: Actor = {
  id: "person:sam",
  level: "person",
  memberships: ["person:sam"],
  source: "user",
};
const eve: Actor = {
  id: "person:eve",
  level: "person",
  memberships: ["person:eve"],
  source: "user",
};
const lee: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", "team:platform", "org"],
  source: "user",
};

const grant = (to: string): Grant => ({ to, class: "semantic", mode: "read", expires: UNTIL });
const toSam = grant(sam.id);
const toEve = grant(eve.id);

const NOTE = id(2);
const STALE = id(3);
const GRANTED = id(1);
const VERSION = id(4);
const ERASED = id(99);

/**
 * Dana's items: 1, a team fact granted to sam then eve; 2, her person note;
 * 3, a team fact past its ttl, granted to sam; 4, a team version granted to
 * sam and eve whose lineage names 3, 2 and an id the log never held.
 */
async function seeded() {
  const env = fresh(testPolicy());
  const write = async (it: MemoryItem) => {
    const { event } = await env.plane.write(dana, it, AT);
    expect(event.decision, event.reason).toBe("allow");
  };
  const mine = { owner: dana.id, provenance: provenance(dana.id) };
  await write(item(1, { ...mine, grants: [toSam, toEve] }));
  await write(item(2, { ...mine, scope: "person:dana", content: "Dana's sister is Mira." }));
  await write(item(3, { ...mine, ttl: 1, grants: [toSam], content: "the old fact" }));
  await write(
    item(4, {
      ...mine,
      grants: [toSam, toEve],
      lineage: [STALE, NOTE, ERASED],
      content: "the new fact",
    }),
  );
  return env;
}

function provenance(actor: string): MemoryItem["provenance"] {
  return { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor };
}

const grantees = (it: MemoryItem | null | undefined) => it?.grants.map((g) => g.to);

describe("grants: the owner sees all, anyone else only those naming it (item 36)", () => {
  test("sam's read shows his grant, eve's hers, dana's both, lee's none", async () => {
    const { plane } = await seeded();
    const seen = async (actor: Actor) => {
      const read = await plane.read(actor, { at: AT });
      return grantees(read.items.find((i) => i.id === GRANTED));
    };
    expect(await seen(sam)).toEqual([sam.id]);
    expect(await seen(eve)).toEqual([eve.id]);
    expect(await seen(dana)).toEqual([sam.id, eve.id]);
    expect(await seen(lee)).toEqual([]);
  });

  test("a by-id read gives the same grants as a read", async () => {
    const { plane } = await seeded();
    for (const [actor, want] of [
      [sam, [sam.id]],
      [eve, [eve.id]],
      [dana, [sam.id, eve.id]],
      [lee, []],
    ] as const) {
      const read = await plane.readById(actor, GRANTED, { at: AT });
      expect(grantees(read.items[0]), actor.id).toEqual(want);
    }
  });

  test("eve's explanation names her grant by its place among the grants she is shown", async () => {
    const { plane } = await seeded();
    const read = await plane.readById(eve, GRANTED, { at: AT });
    // On the item eve's grant is the second; she is shown one grant, so it is grants[0].
    expect(read.explanations[0]?.grants_used).toEqual([`grants[0]:${eve.id}`]);
    expect(read.items[0]?.grants[0]?.to).toBe(eve.id);
    expect(await plane.explain(eve, read.event.id)).toEqual(read.explanations);
    const owners = await plane.readById(sam, GRANTED, { at: AT });
    expect(owners.explanations[0]?.grants_used).toEqual([`grants[0]:${sam.id}`]);
  });

  test("the log keeps every grant: only the answer is narrowed", async () => {
    const { plane, db } = await seeded();
    await plane.read(sam, { at: AT });
    const stored = currentItems(db).find((i) => i.id === GRANTED);
    expect(grantees(stored)).toEqual([sam.id, eve.id]);
  });

  test("the events lee may see show no grant on dana's items, and no grantee in a grant change", async () => {
    const { plane, db, policy } = await seeded();
    const change = await plane.changeGrants(dana, GRANTED, { remove: [toEve] }, LATER);
    expect(change.event.decision, change.event.reason).toBe("allow");
    expect(change.event.reason).toContain(eve.id);
    const items = new Map(currentItems(db).map((i) => [i.id, i]));
    const view = { policy, at: accessTime(db, LATER), current: (i: string) => items.get(i) };
    const leeSees = visibleEvents(lee, plane.events(), view);
    expect(JSON.stringify(leeSees)).not.toContain(sam.id);
    expect(JSON.stringify(leeSees)).not.toContain(eve.id);
    const leesChange = leeSees.find((e) => e.id === change.event.id);
    expect(leesChange?.reason).toContain(dana.id);
    // The owner sees the change and every grant as the log holds them.
    const danaSees = visibleEvents(dana, plane.events(), view);
    expect(danaSees.find((e) => e.id === change.event.id)?.reason).toBe(change.event.reason);
    const write = danaSees.find((e) => e.op === "write" && e.item_id === GRANTED);
    expect(grantees(write?.item)).toEqual([sam.id, eve.id]);
  });

  test("a reviewer's promotion answers with no grant the reviewer is not named in", async () => {
    const policy = testPolicy();
    const env = fresh(policy);
    const held = item(5, {
      scope: "org",
      owner: dana.id,
      provenance: provenance(dana.id),
      grants: [toSam, toEve],
    });
    const { event } = await env.plane.write(dana, held, AT);
    expect(event.decision, event.reason).toBe("allow");
    const result = await env.plane.promote(lee, held.id, "org", LATER, { review: true });
    expect(result.decision, result.event.reason).toBe("allow");
    expect(result.item?.grants).toEqual([]);
    for (const e of result.events) if (e.item) expect(e.item.grants).toEqual([]);
    const own = currentItems(env.db).find((i) => i.id === held.id);
    expect(grantees(own)).toEqual([sam.id, eve.id]);
  });

  test("a bundle row of an item lee holds but dana owns shows lee none of dana's grants", async () => {
    const env = fresh(testPolicy());
    const kept = item(6, {
      scope: "person:lee",
      owner: dana.id,
      provenance: provenance(lee.id),
      grants: [toSam],
    });
    const { event } = await env.plane.write(lee, kept, AT);
    expect(event.decision, event.reason).toBe("allow");
    const { rows } = await env.plane.export(lee, LATER);
    expect(rows.map((r) => [r.item.id, r.item.grants])).toEqual([[kept.id, []]]);
  });
});

describe("lineage: only ids the reader may ask for by id (card E8.15c's finding)", () => {
  const lineageOf = async (actor: Actor) => {
    const { plane } = await seeded();
    const read = await plane.readById(actor, VERSION, { at: AT });
    return read.items[0]?.lineage;
  };

  test("sam's read of the version names no ancestor: one past its ttl, one in a person scope, one unknown", async () => {
    expect(await lineageOf(sam)).toEqual([]);
  });

  test("lee, a member of the team, sees the team ancestor past its ttl, not dana's note", async () => {
    expect(await lineageOf(lee)).toEqual([STALE]);
  });

  test("dana sees every ancestor still projected, in the lineage's order", async () => {
    expect(await lineageOf(dana)).toEqual([STALE, NOTE]);
  });

  test("a read with text drops the same ids as a by-id read", async () => {
    const { plane } = await seeded();
    const read = await plane.read(sam, { text: "new fact", at: AT });
    const version = read.items.find((i) => i.id === VERSION);
    expect(version?.lineage).toEqual([]);
    expect(JSON.stringify(read)).not.toContain(NOTE);
    expect(JSON.stringify(read)).not.toContain(STALE);
  });

  test("an event's item shows lee only the lineage ids lee may ask for", async () => {
    const { plane, db, policy } = await seeded();
    const items = new Map(currentItems(db).map((i) => [i.id, i]));
    const view = { policy, at: accessTime(db, AT), current: (i: string) => items.get(i) };
    const leeSees = visibleEvents(lee, plane.events(), view);
    const write = leeSees.find((e) => e.op === "write" && e.item_id === VERSION);
    expect(write?.item?.lineage).toEqual([STALE]);
  });
});
