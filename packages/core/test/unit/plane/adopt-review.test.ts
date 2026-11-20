// Review fix pass of PR #58 (card RV4), on the fake adapter: the guards of a
// re-keyed record's retirement (I-2), the subset and provenance clauses that
// decide what adoption keeps (I-8), and the cost of the erased-content check
// (I-7). A re-keying store is a fake around the fake: its listing gives a
// record the plane holds a new id at the same ref, as a moved files folder
// does, or lists one ref under two ids, as no conforming store does.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Adapter } from "../../../src/adapter.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { allEvents, appendEvent, eventsByItem } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import { ADOPTION_PREFIX, ownBytes } from "../../../src/plane/commit.ts";
import { adoptedItem } from "../../../src/plane/write.ts";
import { ADOPT_RETRACT_ID, adoptStoreItems, createPlane, offboard } from "../../../src/plane.ts";
import { STORE_FAILURE_ID } from "../../../src/policy/evaluate.ts";
import type { MemoryEvent, MemoryItem, Policy } from "../../../src/schema.ts";
import { sqliteBackend } from "../../db/backends.ts";
import { AT, id, item, testPolicy } from "./helpers.ts";

const omar = {
  id: "person:omar",
  level: "person" as const,
  memberships: ["person:omar", "team:platform"],
  source: "user" as const,
};
const LATER = "2026-10-26T12:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";

/** The test policy with import allowed at every level, since adoption writes as source import. */
function importPolicy(): Policy {
  const base = testPolicy();
  return {
    ...base,
    write: base.write.map((r) => ({ ...r, allowed_sources: [...r.allowed_sources, "import"] })),
  };
}

/**
 * A fake store whose listing the test rewrites (`listing`), and which runs
 * `afterList` once the listing is taken: what another handle does between
 * the listing and the adoption's commit.
 */
function rekeying() {
  const inner = createFakeAdapter({ history: false });
  const control = {
    listing: (items: MemoryItem[]) => items,
    afterList: null as (() => Promise<void>) | null,
  };
  const adapter: Adapter = Object.assign(Object.create(inner) as Adapter, {
    list: async (scope: string) => {
      const listed = control.listing(await inner.list(scope));
      const hook = control.afterList;
      control.afterList = null;
      if (hook) await hook();
      return listed;
    },
  });
  return { inner, adapter, control };
}

function setup(db: Db = sqliteBackend.open()) {
  migrate(db);
  const store = rekeying();
  let n = 0;
  const deps = {
    db,
    adapter: store.adapter,
    policy: importPolicy(),
    newId: () => id(900_000 + ++n),
  };
  return { db, deps, store, plane: createPlane(deps) };
}

/** `held` under a new id at the ref it already has: the store re-keyed it. */
const rekeyed = (held: MemoryItem, n: number): MemoryItem => ({ ...held, id: id(n) }) as MemoryItem;

const retirements = (db: Db) => allEvents(db).filter((e) => e.op === "retire");

describe("I-2: the guards of a re-keyed record's retirement", () => {
  test("a holder in the same scope that the store still lists fails closed", async () => {
    const { db, deps, store, plane } = setup();
    expect((await plane.write(omar, item(1, { scope: "person:omar" }), AT)).event.decision).toBe(
      "allow",
    );
    // The store lists the record under its id and under a second one, at one ref.
    store.control.listing = (items) => [...items, ...items.map((i) => rekeyed(i, 2))];

    await expect(adoptStoreItems(deps, omar, "person:omar", LATER)).rejects.toThrow(
      /already holds ref/,
    );
    expect(itemById(db, id(1))?.status).toBe("active");
    expect(itemById(db, id(2))).toBeUndefined();
    expect(retirements(db)).toEqual([]);
    expect(eventsByItem(db, id(2)).at(-1)).toMatchObject({
      decision: "deny",
      policy_id: STORE_FAILURE_ID,
    });
  });

  test("mixed holders, one of them in another scope, fail closed and retire nothing", async () => {
    const { db, deps, store, plane } = setup();
    const a = (await plane.write(omar, item(1, { scope: "person:omar" }), AT)).item as MemoryItem;
    // An item of another scope at the same ref, unrelated to item 1.
    appendEvent(db, {
      id: id(800_001),
      ts: AT,
      op: "write",
      item_id: id(3),
      actor: omar.id,
      scope_from: null,
      scope_to: "team:platform",
      decision: "allow",
      reason: "a team item sharing the ref",
      policy_id: "test/write/team",
      item: { ...item(3), store_ref: a.store_ref },
      schema_version: 1,
    });
    store.control.listing = (items) => items.map((i) => rekeyed(i, 2));

    await expect(adoptStoreItems(deps, omar, "person:omar", LATER)).rejects.toThrow(
      /already holds ref/,
    );
    expect(itemById(db, id(1))?.status).toBe("active");
    expect(itemById(db, id(3))?.status).toBe("active");
    expect(itemById(db, id(2))).toBeUndefined();
    expect(retirements(db)).toEqual([]);
  });

  test("a holder changed on a second handle after the listing is deferred", async () => {
    const [mine, theirs] = sqliteBackend.pair();
    const { db, deps, store, plane } = setup(mine);
    expect((await plane.write(omar, item(1, { scope: "person:omar" }), AT)).event.decision).toBe(
      "allow",
    );
    store.control.listing = (items) => items.map((i) => rekeyed(i, 2));
    // After the listing, the other handle rewrites item 1 through the plane.
    const other = createPlane({ ...deps, db: theirs, newId: () => id(700_001) });
    store.control.afterList = async () => {
      const w = await other.write(
        omar,
        item(1, { scope: "person:omar", content: "fact number 1, revised", version: 2 }),
        AT,
      );
      expect(w.event.decision).toBe("allow");
    };

    const report = await adoptStoreItems(deps, omar, "person:omar", LATER);
    expect(report).toMatchObject({ allowed: 0, retired: 0, deferred: 1 });
    expect(itemById(db, id(1))).toMatchObject({ status: "active", version: 2 });
    expect(itemById(db, id(2))).toBeUndefined();
    expect(retirements(db)).toEqual([]);
    expect(allEvents(db).some((e) => e.policy_id === ADOPT_RETRACT_ID)).toBe(false);
    theirs.close();
    mine.close();
  });
});

describe("I-8: what adoption keeps", () => {
  test("an adoption carrying a grant the writer did not write is not the writer's own bytes", () => {
    const { deps } = setup();
    const wrote = {
      ...item(1, { scope: "person:omar" }),
      store_ref: { adapter: "fake", key: id(1) },
    } as MemoryItem;
    const grant = {
      to: "person:sam",
      class: "semantic" as const,
      mode: "read" as const,
      expires: UNTIL,
    };
    const adoption = (adopted: MemoryItem): MemoryEvent => ({
      seq: 1,
      id: id(800_002),
      ts: AT,
      op: "write",
      item_id: adopted.id,
      actor: omar.id,
      scope_from: null,
      scope_to: adopted.scope,
      decision: "allow",
      reason: `${ADOPTION_PREFIX}fake: adopted`,
      policy_id: "test/write/person",
      item: adopted,
      schema_version: 1,
    });
    const imported = {
      ...wrote,
      provenance: { ...wrote.provenance, kind: "import", actor: omar.id },
    } as MemoryItem;
    // A subset of what it wrote (here, all of it) is its own.
    expect(ownBytes(deps, wrote)(adoption(imported))).toBe(true);
    expect(ownBytes(deps, { ...wrote, grants: [grant] } as MemoryItem)(adoption(imported))).toBe(
      true,
    );
    // A grant it did not write makes it another change.
    expect(ownBytes(deps, wrote)(adoption({ ...imported, grants: [grant] } as MemoryItem))).toBe(
      false,
    );
  });

  test("a record whose provenance was edited, content unchanged, is the adopter's import", () => {
    const known = item(1, { scope: "person:omar", kind: "user" });
    const edited = {
      ...known,
      provenance: { ...known.provenance, ref: "doc/edited-by-hand" },
    } as MemoryItem;
    const adopter = { ...omar, source: "import" as const };
    const [asIs] = adoptedItem(adopter, known, known);
    expect(asIs.provenance).toEqual(known.provenance);
    const [adopted, note] = adoptedItem(adopter, edited, known);
    expect(adopted.provenance).toMatchObject({ kind: "import", actor: omar.id });
    expect(note).toMatch(/provenance set by adoption: kind import/);
  });
});

describe("I-7: the erased-content check is computed once per adoption", () => {
  test("each erase event is read once, however many records the adoption gates", async () => {
    const backing = sqliteBackend.open();
    let scanned = 0;
    const counted: Db = {
      dialect: backing.dialect,
      exec: (sql) => backing.exec(sql),
      prepare: (sql) => {
        const st = backing.prepare(sql);
        // The erased-content queries (events.ts erasedScopeContent), before
        // and since this pass; the erasure-mark queries (commit.ts) are not.
        if (!/scope_from = \? AND op = 'retire' AND (item_id IS NOT NULL|seq > \?)/.test(sql))
          return st;
        return {
          run: (...p) => st.run(...p),
          get: (...p) => st.get(...p),
          all: (...p) => {
            const rows = st.all(...p);
            scanned += rows.length;
            return rows;
          },
        };
      },
      transaction: (fn) => backing.transaction(fn),
      close: () => backing.close(),
    };
    const { db, deps, store, plane } = setup(counted);
    for (let k = 1; k <= 3; k++)
      expect((await plane.write(omar, item(k, { scope: "person:omar" }), AT)).event.decision).toBe(
        "allow",
      );
    await offboard(deps, omar, { person: "person:omar", roles: [] }, AT);
    const erasedEvents = allEvents(db).filter(
      (e) => e.op === "retire" && e.scope_from === "person:omar",
    ).length;
    // Twenty records the plane never held, written into the store by hand.
    for (let k = 10; k < 30; k++)
      await store.inner.write(item(k, { scope: "person:omar", content: `new fact ${k}` }));
    scanned = 0;
    const report = await adoptStoreItems(deps, omar, "person:omar", LATER);
    expect(report.allowed).toBe(20);
    expect(scanned).toBeLessThanOrEqual(erasedEvents);
  });
});
