// Integration tests of Plane.write on the fake adapter (card E2.3): the gate
// runs before the store, an allowed write lands with its store_ref, a denied
// one leaves exactly one event and never reaches the adapter. The review fix
// pass added who may write (decision D4), the plane-set provenance (D4), and
// an event for every outcome, store failures included (D6).
import { describe, expect, test } from "vitest";
import { currentItems } from "../../../src/events.ts";
import { itemByStoreRef } from "../../../src/items.ts";
import { type Actor, InvalidCallError } from "../../../src/plane.ts";
import {
  SCHEMA_ID,
  SOURCE_ISOLATION_ID,
  STORE_FAILURE_ID,
  WRITE_DEFAULT_DENY_ID,
  WRITE_GRANT_ID,
  WRITE_MEMBERSHIP_ID,
  WRITE_VERSION_ID,
} from "../../../src/policy/evaluate.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const writer: Actor = {
  id: "person:omar",
  level: "team",
  memberships: ["team:platform", "person:omar", "role:lead", "org"],
};

describe("Plane.write", () => {
  test("lands an allowed write in the store and records its store_ref in the event", async () => {
    const { plane, adapter, db } = fresh();
    const { item: stored, event } = await plane.write(writer, item(1), AT);
    expect(adapter.writes).toBe(1);
    expect(stored?.store_ref).toEqual({ adapter: "fake", key: id(1) });
    expect(event).toMatchObject({
      op: "write",
      decision: "allow",
      item_id: id(1),
      actor: "person:omar",
      scope_from: null,
      scope_to: "team:platform",
      policy_id: "test/write/team",
      ts: AT,
    });
    expect(event.item).toEqual(stored);
    expect(itemByStoreRef(db, { adapter: "fake", key: id(1) })).toEqual(stored);
    expect(stored && (await adapter.read(stored.store_ref ?? { adapter: "", key: "" }))).toEqual(
      stored,
    );
  });

  test("denies a forbidden-class write without calling the adapter, with one event", async () => {
    const { plane, adapter, db } = fresh();
    const { item: stored, event } = await plane.write(writer, item(1, { class: "episodic" }), AT);
    expect(stored).toBeNull();
    expect(adapter.writes).toBe(0);
    expect(plane.events()).toEqual([event]);
    expect(event).toMatchObject({
      op: "write",
      decision: "deny",
      item_id: id(1),
      scope_to: "team:platform",
      policy_id: "test/write/team",
    });
    expect(event.reason).toMatch(/episodic/);
    expect(event.item).toBeUndefined();
    expect(currentItems(db)).toEqual([]);
  });

  test("denies a source the rule does not list, and a confidence below the floor", async () => {
    const { plane, adapter } = fresh();
    const a = await plane.write(writer, item(1, { kind: "tool" }), AT);
    const b = await plane.write(writer, item(2, { confidence: 0.1 }), AT);
    expect([a.event.decision, b.event.decision]).toEqual(["deny", "deny"]);
    expect(a.event.reason).toMatch(/source tool/);
    expect(b.event.reason).toMatch(/floor/);
    expect(adapter.writes).toBe(0);
  });

  test("denies model content outside person scope under the source-isolation rule", async () => {
    const { plane, adapter } = fresh();
    const { event } = await plane.write(writer, item(1, { kind: "model" }), AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: SOURCE_ISOLATION_ID });
    expect(adapter.writes).toBe(0);
    const person = await plane.write(writer, item(2, { kind: "model", scope: "person:omar" }), AT);
    expect(person.event.decision).toBe("allow");
  });

  test("denies a write to a level with no rule, under the default-deny id", async () => {
    const policy = testPolicy();
    const { plane } = fresh({ ...policy, write: policy.write.filter((r) => r.scope !== "role") });
    const { event } = await plane.write(writer, item(1, { scope: "role:lead" }), AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: WRITE_DEFAULT_DENY_ID });
    expect(event.reason).toMatch(/no write rule for role/);
  });

  test("lands a write to a scope that requires review as a candidate, decision allow", async () => {
    const { plane, adapter } = fresh();
    const { item: stored, event } = await plane.write(writer, item(1, { scope: "org" }), AT);
    expect(event.decision).toBe("allow");
    expect(stored?.status).toBe("candidate");
    expect(event.item?.status).toBe("candidate");
    expect((await adapter.list("org")).map((i) => i.status)).toEqual(["candidate"]);
    expect(event.reason).toMatch(/review/);
  });

  test("ignores a store_ref the caller supplied and records the adapter's", async () => {
    const { plane } = fresh();
    const forged = item(1, { store_ref: { adapter: "elsewhere", key: "k" } });
    const { item: stored } = await plane.write(writer, forged, AT);
    expect(stored?.store_ref).toEqual({ adapter: "fake", key: id(1) });
  });

  test("denies an item that fails the schema with one event naming the schema rule", async () => {
    const { plane, adapter } = fresh();
    const bad = { ...item(1), confidence: 2 } as MemoryItem;
    const { item: stored, event } = await plane.write(writer, bad, AT);
    expect(stored).toBeNull();
    expect(adapter.writes).toBe(0);
    expect(event).toMatchObject({ decision: "deny", policy_id: SCHEMA_ID, item_id: id(1) });
    expect(event.reason).toMatch(/confidence/);
    expect(plane.events()).toHaveLength(1);
  });

  test("records null item_id and scope_to when the invalid item's id and scope are invalid", async () => {
    const { plane } = fresh();
    const bad = { ...item(1), id: "not-a-uuid", scope: "nowhere" } as MemoryItem;
    const { event } = await plane.write(writer, bad, AT);
    expect(event).toMatchObject({ decision: "deny", item_id: null, scope_to: null });
  });

  test("records a non-object item as a schema denial", async () => {
    const { plane } = fresh();
    const { event } = await plane.write(writer, null as unknown as MemoryItem, AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: SCHEMA_ID, item_id: null });
  });

  test("the same writes on a fresh plane give the same events", async () => {
    const run = async () => {
      const { plane } = fresh();
      for (const it of [item(1), item(2, { class: "episodic" }), item(3, { scope: "org" })])
        await plane.write(writer, it, AT);
      return plane.events();
    };
    expect(await run()).toEqual(await run());
  });
});

describe("Plane.write: every outcome is an event (decision D6)", () => {
  test("an adapter that throws after an allow leaves one store-failure event, and rethrows", async () => {
    const { plane, adapter, db } = fresh();
    adapter.fault = async () => {
      throw new Error("store down");
    };
    await expect(plane.write(writer, item(1), AT)).rejects.toThrow(/store down/);
    const events = plane.events();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      op: "write",
      decision: "deny",
      item_id: id(1),
      scope_to: "team:platform",
      policy_id: STORE_FAILURE_ID,
      actor: "person:omar",
      ts: AT,
    });
    expect(STORE_FAILURE_ID).toBe("engram/write/store-failure");
    expect(events[0]?.reason).toMatch(/store down/);
    expect(events[0]?.item).toBeUndefined();
    expect(currentItems(db)).toEqual([]);
  });

  test("a non-Error thrown by the adapter is recorded by its text", async () => {
    const { plane, adapter } = fresh();
    adapter.fault = async () => {
      throw "disk full";
    };
    await expect(plane.write(writer, item(1), AT)).rejects.toBe("disk full");
    expect(plane.events()[0]?.reason).toMatch(/disk full/);
  });

  test("a ref from another adapter is a store failure: one event, nothing projected", async () => {
    const { plane, adapter, db } = fresh();
    adapter.fault = async (it, store) => {
      await store.write(it);
      return { adapter: "elsewhere", key: it.id };
    };
    await expect(plane.write(writer, item(1), AT)).rejects.toThrow(/elsewhere/);
    expect(plane.events()).toHaveLength(1);
    expect(plane.events()[0]).toMatchObject({ decision: "deny", policy_id: STORE_FAILURE_ID });
    expect(currentItems(db)).toEqual([]);
  });

  test("a malformed ref is a store failure, recorded before the bad ref reaches the log", async () => {
    const { plane, adapter, db } = fresh();
    adapter.fault = async () => ({ adapter: "fake", key: "" });
    await expect(plane.write(writer, item(1), AT)).rejects.toThrow(/malformed ref/);
    expect(plane.events().map((e) => e.policy_id)).toEqual([STORE_FAILURE_ID]);
    expect(currentItems(db)).toEqual([]);
  });

  test("a ref already held by an unrelated item is a store failure (finding R5-14)", async () => {
    const { plane, adapter, db } = fresh();
    await plane.write(writer, item(1), AT);
    adapter.fault = async () => ({ adapter: "fake", key: id(1) });
    await expect(plane.write(writer, item(2), AT)).rejects.toThrow(/already holds/);
    expect(plane.events().map((e) => e.decision)).toEqual(["allow", "deny"]);
    expect(plane.events()[1]?.policy_id).toBe(STORE_FAILURE_ID);
    expect(itemByStoreRef(db, { adapter: "fake", key: id(1) })?.id).toBe(id(1));
    expect(currentItems(db).map((i) => i.id)).toEqual([id(1)]);
  });

  test("a new version may share the ref of the version its lineage names", async () => {
    const { plane, adapter, db } = fresh();
    await plane.write(writer, item(1), AT);
    adapter.fault = async () => ({ adapter: "fake", key: id(1) });
    const v2 = item(2, { version: 2, lineage: [id(1)] });
    const { event } = await plane.write(writer, v2, AT);
    expect(event.decision).toBe("allow");
    expect(itemByStoreRef(db, { adapter: "fake", key: id(1) })?.id).toBe(id(2));
  });

  test("an invalid time is refused before the store and the log are touched (finding R5-4)", async () => {
    const { plane, adapter } = fresh();
    for (const at of ["yesterday", "2026-10-25T12:00:00+02:00", ""]) {
      await expect(plane.write(writer, item(1), at), at).rejects.toThrow(InvalidCallError);
    }
    expect(adapter.writes).toBe(0);
    expect(plane.events()).toEqual([]);
  });

  test("an invalid actor is refused before the store and the log are touched", async () => {
    const { plane, adapter } = fresh();
    const bad = [
      { ...writer, id: "" },
      { ...writer, level: "galaxy" },
      { ...writer, memberships: "team:platform" },
      { ...writer, source: "rumour" },
      null,
    ] as unknown as Actor[];
    for (const actor of bad)
      await expect(plane.write(actor, item(1), AT), JSON.stringify(actor)).rejects.toThrow(
        InvalidCallError,
      );
    expect(adapter.writes).toBe(0);
    expect(plane.events()).toEqual([]);
  });
});

describe("Plane.write: who may write (decision D4)", () => {
  test("a non-member cannot write into another person's scope (finding R5-5)", async () => {
    const { plane, adapter } = fresh();
    const mal: Actor = { id: "person:mal", level: "person", memberships: ["person:mal"] };
    const { item: stored, event } = await plane.write(
      mal,
      item(1, { scope: "person:omar", owner: "person:mal" }),
      AT,
    );
    expect(stored).toBeNull();
    expect(event).toMatchObject({ decision: "deny", policy_id: WRITE_MEMBERSHIP_ID });
    expect(adapter.writes).toBe(0);
  });

  test("a member of the new scope cannot take over an item id from a scope it is not in", async () => {
    const { plane, db } = fresh();
    await plane.write(writer, item(1, { scope: "person:omar" }), AT);
    const mal: Actor = { id: "person:mal", level: "team", memberships: ["team:platform"] };
    const { event } = await plane.write(mal, item(1, { version: 2 }), AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: WRITE_MEMBERSHIP_ID });
    expect(currentItems(db)[0]?.scope).toBe("person:omar");
  });

  test("a rewrite of an item id at a lower version, or with another owner, is denied", async () => {
    const { plane, adapter } = fresh();
    await plane.write(writer, item(1, { version: 3 }), AT);
    const lower = await plane.write(writer, item(1, { version: 2 }), AT);
    const owner = await plane.write(writer, item(1, { version: 4, owner: "person:sara" }), AT);
    for (const { event } of [lower, owner])
      expect(event).toMatchObject({ decision: "deny", policy_id: WRITE_VERSION_ID });
    expect(adapter.writes).toBe(1);
    const same = await plane.write(writer, item(1, { version: 3, content: "edited" }), AT);
    expect(same.event.decision).toBe("allow");
  });

  test("a grant to everyone on a written item is denied (finding R5-7)", async () => {
    const { plane, adapter } = fresh();
    const wide = item(1, {
      scope: "person:omar",
      grants: [{ to: "*", mode: "read", class: "semantic", expires: "2027-01-01T00:00:00Z" }],
    });
    const { event } = await plane.write(writer, wide, AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: WRITE_GRANT_ID });
    expect(adapter.writes).toBe(0);
  });
});

/** A gate a test opens by hand: store writes wait on it, so two writes overlap for certain. */
function gate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

/** Lets every pending promise callback run. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("Plane.write: concurrent writes (finding N2 of the second review)", () => {
  const omar: Actor = { id: "person:omar", level: "person", memberships: ["person:omar"] };
  const mal: Actor = { id: "person:mal", level: "person", memberships: ["person:mal"] };

  test("two actors writing one new id at once: the second is judged against the first's item", async () => {
    const { plane, adapter, db } = fresh();
    const g = gate();
    adapter.fault = async (it, store) => {
      await g.opened;
      return store.write(it);
    };
    const first = plane.write(omar, item(1, { scope: "person:omar" }), AT);
    const second = plane.write(
      mal,
      item(1, { scope: "person:mal", owner: "person:mal", content: "mine now" }),
      AT,
    );
    await settle();
    g.open();
    const [a, b] = await Promise.all([first, second]);
    expect(a.event.decision).toBe("allow");
    expect(b.event).toMatchObject({ decision: "deny", policy_id: WRITE_MEMBERSHIP_ID });
    expect(adapter.writes).toBe(1);
    expect(currentItems(db)).toMatchObject([
      { id: id(1), scope: "person:omar", owner: "person:omar" },
    ]);
    expect((await adapter.list("person:mal")).map((i) => i.id)).toEqual([]);
  });

  test("concurrent rewrites at versions 5 and 3 never leave the item at version 3", async () => {
    const { plane, adapter, db } = fresh();
    await plane.write(writer, item(1), AT);
    const g = gate();
    adapter.fault = async (it, store) => {
      await g.opened;
      return store.write(it);
    };
    const five = plane.write(writer, item(1, { version: 5 }), AT);
    const three = plane.write(writer, item(1, { version: 3 }), AT);
    await settle();
    g.open();
    const [a, b] = await Promise.all([five, three]);
    expect(a.event.decision).toBe("allow");
    expect(b.event).toMatchObject({ decision: "deny", policy_id: WRITE_VERSION_ID });
    expect(currentItems(db)[0]?.version).toBe(5);
    expect((await adapter.list("team:platform"))[0]?.version).toBe(5);
  });

  test("a store failure does not stall the writes queued behind it", async () => {
    const { plane, adapter } = fresh();
    adapter.fault = async (it, store) => {
      if (it.id === id(1)) throw new Error("store down");
      return store.write(it);
    };
    const failing = plane.write(writer, item(1), AT);
    const next = plane.write(writer, item(2), AT);
    await expect(failing).rejects.toThrow(/store down/);
    expect((await next).event.decision).toBe("allow");
  });

  test("a read during a pending write is not held up, and sees the item once it lands", async () => {
    const { plane, adapter } = fresh();
    const g = gate();
    adapter.fault = async (it, store) => {
      await g.opened;
      return store.write(it);
    };
    const pending = plane.write(writer, item(1), AT);
    await settle();
    const during = await plane.read(writer, { at: AT });
    expect(during.items).toEqual([]);
    g.open();
    await pending;
    expect((await plane.read(writer, { at: AT })).items.map((i) => i.id)).toEqual([id(1)]);
  });
});

describe("Plane.write: a denial reveals nothing about an item the writer cannot read (finding N3)", () => {
  const mal: Actor = { id: "person:mal", level: "person", memberships: ["person:mal"] };

  test("an id held in another scope is refused without naming its scope, owner or version", async () => {
    const { plane } = fresh();
    await plane.write(writer, item(1, { scope: "person:omar", version: 4 }), AT);
    const { event } = await plane.write(
      mal,
      item(1, { scope: "person:mal", owner: "person:mal" }),
      AT,
    );
    expect(event).toMatchObject({ decision: "deny", policy_id: WRITE_MEMBERSHIP_ID });
    expect(event.reason).toMatch(/the item id is held by an item you cannot access/);
    expect(event.reason).not.toMatch(/person:omar|version 4|\b4\b/);
    expect(event.item).toBeUndefined();
  });

  test("a member who cannot read the item's scope gets the opaque reason on owner and version too", async () => {
    const policy = testPolicy();
    const noPerson = {
      ...policy,
      read: {
        ...policy.read,
        matrix: [{ reader: "team" as const, may_read: ["team" as const, "org" as const] }],
      },
    };
    const { plane } = fresh(noPerson);
    const owner: Actor = { id: "person:omar", level: "person", memberships: ["person:omar"] };
    await plane.write(owner, item(1, { scope: "person:omar", version: 4 }), AT);
    const blind: Actor = { id: "person:sara", level: "team", memberships: ["person:omar"] };
    const lower = await plane.write(blind, item(1, { scope: "person:omar", version: 2 }), AT);
    const other = await plane.write(
      blind,
      item(1, { scope: "person:omar", version: 5, owner: "person:sara" }),
      AT,
    );
    for (const { event } of [lower, other]) {
      expect(event).toMatchObject({ decision: "deny", policy_id: WRITE_VERSION_ID });
      expect(event.reason).toMatch(/the item id is held by an item you cannot access/);
      expect(event.reason).not.toMatch(/version 4|person:omar/);
    }
  });

  test("a writer who can read the item still gets the detailed reason", async () => {
    const { plane } = fresh();
    await plane.write(writer, item(1, { version: 3 }), AT);
    const { event } = await plane.write(writer, item(1, { version: 2 }), AT);
    expect(event.reason).toMatch(/below the projected version 3/);
  });
});

describe("Plane.write: a ref another item holds (finding N4)", () => {
  test("the store-failure event names the orphaned bytes and the item whose record they may replace", async () => {
    const { plane, adapter } = fresh();
    await plane.write(writer, item(1), AT);
    adapter.fault = async () => ({ adapter: "fake", key: id(1) });
    await expect(plane.write(writer, item(2), AT)).rejects.toThrow(/already holds/);
    const reason = plane.events()[1]?.reason ?? "";
    expect(reason).toMatch(/orphaned/);
    expect(reason).toMatch(new RegExp(`item ${id(2)}`));
    expect(reason).toMatch(/contract/);
  });
});

describe("Plane.write: the plane sets provenance (decision D4, finding R5-6)", () => {
  test("a harness-set source overrides the kind and actor the caller claims", async () => {
    const { plane } = fresh();
    const agent: Actor = { ...writer, id: "agent:pi", source: "model" };
    const claimed = item(1, { kind: "user", scope: "person:omar" });
    const { item: stored, event } = await plane.write(agent, claimed, AT);
    expect(event.decision).toBe("allow");
    expect(stored?.provenance).toMatchObject({ kind: "model", actor: "agent:pi" });
    expect(event.item?.provenance).toMatchObject({ kind: "model", actor: "agent:pi" });
    expect(event.reason).toMatch(/provenance set by the plane: source model, actor agent:pi/);
  });

  test("an agent claiming user provenance cannot write into team scope", async () => {
    const { plane, adapter } = fresh();
    const agent: Actor = { ...writer, id: "agent:pi", source: "model" };
    const { event } = await plane.write(agent, item(1, { kind: "user" }), AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: SOURCE_ISOLATION_ID });
    expect(adapter.writes).toBe(0);
  });

  test("without a source the caller's provenance stands, and the reason says so", async () => {
    const { plane } = fresh();
    const { item: stored, event } = await plane.write(writer, item(1), AT);
    expect(stored?.provenance.kind).toBe("user");
    expect(event.reason).toMatch(/provenance as claimed by the caller/);
  });

  test("a denial's reason also records whose provenance was evaluated", async () => {
    const { plane } = fresh();
    const { event } = await plane.write(writer, item(1, { class: "episodic" }), AT);
    expect(event.reason).toMatch(/provenance as claimed by the caller/);
  });
});
