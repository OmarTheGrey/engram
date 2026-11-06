// Adopting what a store already holds (card E8.2 needs it for the files
// adapter; decision D8 of the review fix pass): every item in a scope crosses
// the same write gate as Plane.write, as the store's owner with source import;
// an allowed one is recorded with the store_ref it already has and its bytes
// are never rewritten; a denied one leaves one event, and is not re-gated
// while it stays as it is; an item the log already holds as it stands is left
// alone; and an item the store no longer has, or whose store version is
// denied, is retired so the plane never serves what the store does not hold.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Adapter } from "../../../src/adapter.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { allEvents, appendEvent, currentItems } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import { ADOPT_RETRACT_ID, adoptStoreItems, createPlane } from "../../../src/plane.ts";
import type { MemoryItem, Policy } from "../../../src/schema.ts";
import { AT, counting, id, item, testPolicy } from "./helpers.ts";

const owner = { id: "person:omar", level: "person" as const, memberships: ["person:omar"] };
const LATER = "2026-10-26T12:00:00Z";

/** The test policy with import allowed at every level, since adoption writes as source import. */
function importPolicy(over: Partial<Policy> = {}): Policy {
  const base = testPolicy(over);
  return {
    ...base,
    write: base.write.map((r) => ({ ...r, allowed_sources: [...r.allowed_sources, "import"] })),
  };
}

async function seeded(policy: Policy = importPolicy()) {
  const inner = createFakeAdapter();
  // Memories that were in the store before the plane governed it.
  await inner.write(item(1, { scope: "person:omar" }));
  await inner.write(item(2, { scope: "person:omar", class: "episodic" }));
  await inner.write(item(3, { scope: "team:platform" }));
  const adapter = counting(inner);
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const deps = { db, adapter, policy, newId: () => id(900_000 + ++n) };
  return { deps, inner, adapter, db, plane: createPlane(deps) };
}

const ref = (n: number) => ({ adapter: "fake", key: id(n) });

describe("adoptStoreItems", () => {
  test("gates every item in the scope and adopts the allowed ones without rewriting them", async () => {
    const { deps, adapter, db } = await seeded();
    const report = await adoptStoreItems(deps, owner, "person:omar", AT);

    expect(report).toMatchObject({ listed: 2, allowed: 1, denied: 1, unchanged: 0, retired: 0 });
    expect(adapter.writes).toBe(0);
    expect(currentItems(db).map((i) => [i.id, i.store_ref])).toEqual([[id(1), ref(1)]]);
  });

  test("records every decision as one event with its reason and policy id", async () => {
    const { deps, db } = await seeded();
    const report = await adoptStoreItems(deps, owner, "person:omar", AT);

    const events = allEvents(db);
    expect(events.map((e) => [e.item_id, e.op, e.decision])).toEqual([
      [id(1), "write", "allow"],
      [id(2), "write", "deny"],
    ]);
    expect(report.denials).toEqual([
      { item_id: id(2), reason: events[1]?.reason, policy_id: events[1]?.policy_id },
    ]);
    expect(events[1]?.policy_id).toBe("test/write/person");
  });

  test("marks every adoption event with the store it adopted from", async () => {
    const { deps, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    for (const e of allEvents(db)) expect(e.reason).toMatch(/^adopted from store fake: /);
  });

  test("writes as source import whatever the caller's actor says, and records it", async () => {
    const { deps, db } = await seeded();
    await adoptStoreItems(deps, { ...owner, source: "user" }, "person:omar", AT);
    const adopted = itemById(db, id(1));
    expect(adopted?.provenance).toMatchObject({ kind: "import", actor: "person:omar" });
    expect(allEvents(db)[0]?.actor).toBe("person:omar");
  });

  test("denies every item to an actor who is not a member of the scope", async () => {
    const { deps, db } = await seeded();
    const eve = { id: "person:eve", level: "person" as const, memberships: ["person:eve"] };
    const report = await adoptStoreItems(deps, eve, "person:omar", AT);
    expect(report).toMatchObject({ allowed: 0, denied: 2 });
    expect(allEvents(db).map((e) => e.policy_id)).toEqual([
      "engram/write/membership",
      "engram/write/membership",
    ]);
    expect(currentItems(db)).toEqual([]);
  });

  test("leaves items outside the scope alone", async () => {
    const { deps, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    expect(currentItems(db).some((i) => i.scope === "team:platform")).toBe(false);
  });

  test("a second run finds both items as they were and appends no event", async () => {
    const { deps, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    const before = allEvents(db).length;

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ listed: 2, allowed: 0, denied: 0, unchanged: 2, retired: 0 });
    expect(allEvents(db).length).toBe(before);
  });

  test("an item the store changed is gated again and lands as the store now has it", async () => {
    const { deps, inner, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    await inner.write(item(1, { scope: "person:omar", content: "fact number 1, revised" }));

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ allowed: 1, unchanged: 1 });
    expect(itemById(db, id(1))?.content).toBe("fact number 1, revised");
    expect(allEvents(db).at(-1)).toMatchObject({ item_id: id(1), op: "write", ts: LATER });
  });

  test("an item stored as a candidate under review is unchanged on the next run", async () => {
    const reviewed = importPolicy();
    reviewed.write = reviewed.write.map((r) => ({ ...r, requires_review: true }));
    const { deps, db } = await seeded(reviewed);
    await adoptStoreItems(deps, owner, "person:omar", AT);
    expect(itemById(db, id(1))?.status).toBe("candidate");
    const before = allEvents(db).length;

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ allowed: 0, unchanged: 2 });
    expect(allEvents(db).length).toBe(before);
  });

  test("a denied item the store changed is gated again", async () => {
    const { deps, inner, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    await inner.write(item(2, { scope: "person:omar", class: "semantic" }));

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ allowed: 1, unchanged: 1 });
    expect(itemById(db, id(2))?.status).toBe("active");
  });

  test("retires an adopted item when the store's new version is denied", async () => {
    const { deps, inner, db, plane } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    await inner.write(item(1, { scope: "person:omar", class: "episodic" }));

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ denied: 1, retired: 1 });
    const [deny, retire] = allEvents(db).slice(-2);
    expect(deny).toMatchObject({ item_id: id(1), op: "write", decision: "deny" });
    expect(retire).toMatchObject({
      item_id: id(1),
      op: "retire",
      decision: "allow",
      policy_id: ADOPT_RETRACT_ID,
      actor: "person:omar",
      ts: LATER,
    });
    expect(retire?.reason).toMatch(
      /^adopted from store fake: the store's version of .* was denied/,
    );
    expect(itemById(db, id(1))?.status).toBe("retired");
    expect((await plane.read(owner, { at: LATER })).items).toEqual([]);
  });

  test("retires an adopted item the store no longer has", async () => {
    const { deps, inner, db, plane } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    await inner.delete(ref(1));

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ listed: 1, retired: 1 });
    expect(again.retirements).toEqual([{ item_id: id(1), reason: allEvents(db).at(-1)?.reason }]);
    expect(allEvents(db).at(-1)).toMatchObject({
      item_id: id(1),
      op: "retire",
      policy_id: ADOPT_RETRACT_ID,
    });
    expect(allEvents(db).at(-1)?.reason).toContain("no longer in store fake scope person:omar");
    expect((await plane.read(owner, { at: LATER })).items).toEqual([]);

    const third = await adoptStoreItems(deps, owner, "person:omar", LATER);
    expect(third).toMatchObject({ retired: 0 });
  });

  test("retires an item the store can no longer read, naming the store's diagnostic", async () => {
    const { deps, inner, db, plane } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    // The store still has the entry, but skips it when listing: it cannot parse it.
    await inner.delete(ref(1));
    const diagnostic = { key: id(1), reason: "frontmatter does not parse at line 3" };
    const adapter = Object.assign(Object.create(deps.adapter) as Adapter, {
      diagnostics: () => [diagnostic],
    });

    const again = await adoptStoreItems({ ...deps, adapter }, owner, "person:omar", LATER);

    expect(again).toMatchObject({ listed: 1, retired: 1 });
    const retire = allEvents(db).at(-1);
    expect(retire).toMatchObject({ item_id: id(1), op: "retire", policy_id: ADOPT_RETRACT_ID });
    expect(retire?.reason).toBe(
      `adopted from store fake: store fake can no longer read item ${id(1)} (${id(1)}): frontmatter does not parse at line 3; the plane retires its projected version, which the store no longer holds in a readable form`,
    );
    expect(retire?.reason).not.toContain("no longer in store");
    expect((await plane.read(owner, { at: LATER })).items).toEqual([]);

    // Readable again: adopted again, as any retracted item the store holds.
    await inner.write(item(1, { scope: "person:omar" }));
    const fixed = await adoptStoreItems(deps, owner, "person:omar", LATER);
    expect(fixed).toMatchObject({ allowed: 1 });
    expect(itemById(db, id(1))?.status).toBe("active");
  });

  test("a change only in fields the store derives is no change: no event, no gate", async () => {
    const { deps, inner, db } = await seeded();
    const adapter = Object.assign(Object.create(deps.adapter) as Adapter, {
      derivedFields: (): (keyof MemoryItem)[] => ["valid_from"],
    });
    const derived = { ...deps, adapter };
    await adoptStoreItems(derived, owner, "person:omar", AT);
    const before = allEvents(db).length;
    // As a touched file's modification time moves an imported item's valid_from.
    await inner.write(item(1, { scope: "person:omar", valid_from: LATER }));
    await inner.write(item(2, { scope: "person:omar", class: "episodic", valid_from: LATER }));

    const again = await adoptStoreItems(derived, owner, "person:omar", LATER);

    expect(again).toMatchObject({ allowed: 0, denied: 0, retired: 0, unchanged: 2 });
    expect(allEvents(db)).toHaveLength(before);
    expect(itemById(db, id(1))?.valid_from).toBe("2026-10-01T00:00:00Z");
  });

  test("a change in valid_from the store does not derive is gated again", async () => {
    const { deps, inner, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    await inner.write(item(1, { scope: "person:omar", valid_from: LATER }));

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ allowed: 1, unchanged: 1 });
    expect(itemById(db, id(1))?.valid_from).toBe(LATER);
  });

  test("re-adopts a retracted item when the store has it again", async () => {
    const { deps, inner, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    await inner.delete(ref(1));
    await adoptStoreItems(deps, owner, "person:omar", AT);
    await inner.write(item(1, { scope: "person:omar" }));

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ allowed: 1 });
    expect(itemById(db, id(1))?.status).toBe("active");
  });

  test("does not bring back an item retired by anything but adoption", async () => {
    const { deps, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    appendEvent(db, {
      id: id(800_001),
      ts: AT,
      op: "retire",
      item_id: id(1),
      actor: "person:omar",
      scope_from: null,
      scope_to: "person:omar",
      decision: "allow",
      reason: "retired by its owner",
      policy_id: "test/retire",
      schema_version: 1,
    });

    const again = await adoptStoreItems(deps, owner, "person:omar", LATER);

    expect(again).toMatchObject({ allowed: 0, unchanged: 2 });
    expect(itemById(db, id(1))?.status).toBe("retired");
  });

  test("an item whose store_ref another item holds leaves a store-failure event and throws", async () => {
    const { deps, adapter, db } = await seeded();
    // An unrelated item already recorded at item 1's ref.
    appendEvent(db, {
      id: id(800_002),
      ts: AT,
      op: "write",
      item_id: id(7),
      actor: "person:omar",
      scope_from: null,
      scope_to: "person:omar",
      decision: "allow",
      reason: "seeded",
      policy_id: "test/seed",
      item: { ...item(7, { scope: "person:omar" }), store_ref: ref(1) },
      schema_version: 1,
    });

    await expect(adoptStoreItems(deps, owner, "person:omar", AT)).rejects.toThrow(/already holds/);
    expect(adapter.writes).toBe(0);
    expect(allEvents(db).at(-1)).toMatchObject({
      item_id: id(1),
      decision: "deny",
      policy_id: "engram/write/store-failure",
    });
    // Adoption writes nothing, so the reason must not claim the store wrote bytes.
    const reason = allEvents(db).at(-1)?.reason ?? "";
    expect(reason).toMatch(/nothing was written/);
    expect(reason).not.toMatch(/orphaned|bytes it wrote/);
  });

  test("adopted items are readable through Plane.read like any other", async () => {
    const { deps, plane } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    const { items } = await plane.read(owner, { at: AT });
    expect(items.map((i) => i.id)).toEqual([id(1)]);
  });
});
