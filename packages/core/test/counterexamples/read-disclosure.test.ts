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
import { ADOPT_NARROWED_ID, removedGrantsNote } from "../../src/plane/commit.ts";
import { adoptedItem } from "../../src/plane/write.ts";
import { type Actor, accessTime } from "../../src/plane.ts";
import { notCarriedClause } from "../../src/policy/promotion.ts";
import type { Grant, MemoryEvent, MemoryItem } from "../../src/schema.ts";
import { disclosedItem, disclosedReason, visibleEvents } from "../../src/visible.ts";
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
    // Sam's grant is first on the item too, so this pins only that his label
    // is kept; the renumbering itself is pinned by eve's above.
    const samsRead = await plane.readById(sam, GRANTED, { at: AT });
    expect(samsRead.explanations[0]?.grants_used).toEqual([`grants[0]:${sam.id}`]);
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

// Review fix pass of RD1, finding 1 and the search after it: every reason
// core writes that can quote a grantee is shown whole only to its maker and
// the item's owner. A refused grant change under the write gate's grant rule
// (`engram/write/grant`: a malformed principal, a class other than the
// item's), a write the grant rules refuse, the plane's narrowing of grants an
// adoption reintroduced, and the clauses an adoption, a store failure's
// mend and a promotion append about grants.
describe("reasons that quote a grantee: whole only to the maker and the owner (RD1 review)", () => {
  const zoe = "person:zoe";
  const kim: Actor = {
    id: "person:kim",
    level: "person",
    memberships: ["person:kim", "team:platform", "org"],
    source: "user",
  };
  const shownTo = (env: Awaited<ReturnType<typeof seeded>>, actor: Actor, at = LATER) => {
    const items = new Map(currentItems(env.db).map((i) => [i.id, i]));
    const view = {
      policy: env.policy,
      at: accessTime(env.db, at),
      current: (i: string) => items.get(i),
    };
    return visibleEvents(actor, env.plane.events(), view);
  };

  for (const [what, refused] of [
    ["a class other than the item's", { ...grant(zoe), class: "episodic" as const }],
    ["a malformed principal", { ...grant("person:z*e"), to: "person:z*e" }],
  ] as const)
    test(`a refused grant change for ${what} names no grantee to lee, through the events and the export`, async () => {
      const env = await seeded();
      const change = await env.plane.changeGrants(dana, GRANTED, { add: [refused] }, LATER);
      expect(change.event.decision).toBe("deny");
      expect(change.event.policy_id).toBe("engram/write/grant");
      expect(change.event.reason).toContain(refused.to);
      const leeSees = shownTo(env, lee);
      const leesChange = leeSees.find((e) => e.id === change.event.id);
      expect(leesChange, "lee, a member of the team, sees that the change was asked").toBeDefined();
      expect(leesChange?.reason).toContain(dana.id);
      expect(JSON.stringify(leeSees)).not.toContain(refused.to);
      // The owner, who made it, sees the reason as the log holds it.
      const danaSees = shownTo(env, dana).find((e) => e.id === change.event.id);
      expect(danaSees?.reason).toBe(change.event.reason);

      // The export: an item in lee's person scope that dana owns, and dana,
      // asserting membership of that scope, refused the same way on it.
      const inLees = item(7, {
        scope: "person:lee",
        owner: dana.id,
        provenance: provenance(lee.id),
      });
      expect((await env.plane.write(lee, inLees, AT)).event.decision).toBe("allow");
      const danaThere: Actor = { ...dana, memberships: [...dana.memberships, "person:lee"] };
      const there = await env.plane.changeGrants(danaThere, inLees.id, { add: [refused] }, LATER);
      expect(there.event.policy_id).toBe("engram/write/grant");
      expect(there.event.reason).toContain(refused.to);
      const { rows } = await env.plane.export(lee, LATER);
      const row = rows.find((r) => r.item.id === inLees.id);
      expect(row?.events.map((e) => e.id)).toContain(there.event.id);
      expect(JSON.stringify(rows)).not.toContain(refused.to);
    });

  test("a rewrite the grant rules refuse names no grantee to lee; dana sees it whole", async () => {
    const env = await seeded();
    const stored = currentItems(env.db).find((i) => i.id === GRANTED) as MemoryItem;
    // A rewrite that adds sam's grant a second time: the reason quotes it.
    const rewrite = {
      ...stored,
      grants: [toSam, toEve, toSam],
      version: stored.version + 1,
    };
    const { event } = await env.plane.write(dana, rewrite, LATER);
    expect(event.decision).toBe("deny");
    expect(event.policy_id).toBe("engram/grant/unchanged");
    expect(event.reason).toContain(sam.id);
    const leesView = shownTo(env, lee).find((e) => e.id === event.id);
    expect(leesView).toBeDefined();
    expect(leesView?.reason).not.toContain(sam.id);
    expect(leesView?.reason).toContain("engram/grant/unchanged");
    expect(shownTo(env, dana).find((e) => e.id === event.id)?.reason).toBe(event.reason);
  });

  // Verification N1: the owner, source and status rules name no grantee on
  // a write, so a member keeps those reasons; only the grant-change gate's
  // update events withhold them.
  test("a co-holder's refused rewrite of a granted item keeps its reason for kim, a member", async () => {
    const env = await seeded();
    const stored = currentItems(env.db).find((i) => i.id === GRANTED) as MemoryItem;
    const rewrite = { ...stored, content: "lee's words", version: stored.version + 1 };
    const { event } = await env.plane.write(lee, rewrite, LATER);
    expect(event).toMatchObject({ decision: "deny", policy_id: "engram/grant/owner" });
    expect(event.reason).not.toContain(sam.id);
    expect(event.reason).not.toContain(eve.id);
    expect(shownTo(env, kim).find((e) => e.id === event.id)?.reason).toBe(event.reason);
    // The same rule on a grant change's update event stays withheld.
    const change = await env.plane.changeGrants(lee, GRANTED, { remove: [toEve] }, LATER);
    expect(change.event).toMatchObject({ op: "update", policy_id: "engram/grant/owner" });
    const kimsChange = shownTo(env, kim).find((e) => e.id === change.event.id);
    expect(kimsChange?.reason).not.toBe(change.event.reason);
    expect(kimsChange?.reason).toContain("asked to change the grants");
  });

  test("a reviewed promotion's reason tells a member who is neither maker nor owner no grant count", async () => {
    const env = await seeded();
    const result = await env.plane.promote(lee, GRANTED, "org", LATER, { review: true });
    expect(result.decision, result.event.reason).toBe("allow");
    expect(result.event.reason).toContain(`2 grants of its owner ${dana.id} are not carried`);
    const kimsView = shownTo(env, kim).find((e) => e.id === result.event.id);
    expect(kimsView).toBeDefined();
    expect(kimsView?.reason).not.toMatch(/grants? of its owner/);
    expect(kimsView?.reason.startsWith(result.event.reason.split(";")[0] as string)).toBe(true);
    for (const who of [lee, dana])
      expect(shownTo(env, who).find((e) => e.id === result.event.id)?.reason, who.id).toBe(
        result.event.reason,
      );
  });

  test("the clauses an adoption and a store failure's mend append name no grantee to kim", () => {
    const policy = testPolicy();
    const record = item(8, {
      owner: dana.id,
      grants: [grant(zoe)],
      provenance: provenance(lee.id),
    });
    const [, note] = adoptedItem(lee, record, undefined);
    expect(note).toContain(zoe);
    const narrowed = `; ${removedGrantsNote([grant(zoe)])}`;
    expect(narrowed).toContain(zoe);
    const event = (reason: string, policy_id: string): MemoryEvent => ({
      id: id(70),
      seq: 1,
      ts: AT,
      op: "write",
      item_id: record.id,
      actor: lee.id,
      scope_from: null,
      scope_to: record.scope,
      decision: "allow",
      reason,
      policy_id,
      schema_version: 1,
    });
    const view = { policy, at: AT, current: () => record };
    const adopted = event(`adopted from store files: ${note}`, "test/write/team");
    expect(disclosedReason(kim, adopted, view)).not.toContain(zoe);
    expect(disclosedReason(kim, adopted, view)).toContain("adopted from store files: provenance");
    const failed = event(`the store refused${narrowed}`, "engram/write/store-failure");
    expect(disclosedReason(kim, failed, view)).toBe("the store refused");
    const mend = { ...event(`the plane removed ${zoe}`, ADOPT_NARROWED_ID), op: "update" as const };
    expect(disclosedReason(kim, mend, view)).not.toContain(zoe);
    const one = event(`promoted${notCarriedClause(1, dana.id, lee.id)}`, "test/promote/review");
    expect(disclosedReason(kim, one, view)).toBe("promoted");
    // The maker and the owner see each as the log holds it.
    for (const e of [adopted, failed, mend, one]) {
      expect(disclosedReason(lee, e, view)).toBe(e.reason);
      expect(disclosedReason(dana, e, view)).toBe(e.reason);
    }
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

  // Review finding 3: in the cases above an ancestor is either in a scope the
  // reader may read or not admitted at all, so nothing pinned the half of
  // the rule that names an ancestor the read filter admits through a grant,
  // nor the read's valid_at in it. Dana's team ancestor 10, granted to sam
  // and valid until 15 October, and her version 11 granted to sam naming it.
  const GRANTED_ANCESTOR = id(10);
  const GRANTED_VERSION = id(11);
  const withGrantedAncestor = async () => {
    const env = fresh(testPolicy());
    const mine = { owner: dana.id, provenance: provenance(dana.id) };
    for (const it of [
      item(10, {
        ...mine,
        grants: [toSam],
        valid_to: "2026-10-15T00:00:00Z",
        content: "the first fact",
      }),
      item(11, { ...mine, grants: [toSam], lineage: [GRANTED_ANCESTOR], content: "the next fact" }),
    ]) {
      const { event } = await env.plane.write(dana, it, AT);
      expect(event.decision, event.reason).toBe("allow");
    }
    return env;
  };
  const samsLineage = async (validAt?: string) => {
    const { plane } = await withGrantedAncestor();
    const query = validAt === undefined ? { at: AT } : { at: AT, valid_at: validAt };
    const read = await plane.readById(sam, GRANTED_VERSION, query);
    expect(read.items.map((i) => i.id)).toEqual([GRANTED_VERSION]);
    return read.items[0]?.lineage;
  };

  test("sam, no member of the team, is shown an ancestor his live grant admits at the read's valid_at", async () => {
    expect(await samsLineage("2026-10-10T00:00:00Z")).toEqual([GRANTED_ANCESTOR]);
  });

  test("the same ancestor is dropped at a valid_at past its window, and at the read's own time", async () => {
    expect(await samsLineage("2026-11-01T00:00:00Z")).toEqual([]);
    expect(await samsLineage()).toEqual([]);
  });

  test("an event's item shows sam the ancestor while the window is open, through his grant", async () => {
    const { db, policy } = await withGrantedAncestor();
    const items = new Map(currentItems(db).map((i) => [i.id, i]));
    const at = "2026-10-12T00:00:00Z";
    const view = { policy, at, current: (i: string) => items.get(i) };
    const shown = disclosedItem(sam, items.get(GRANTED_VERSION) as MemoryItem, view);
    expect(shown.lineage).toEqual([GRANTED_ANCESTOR]);
  });
});
