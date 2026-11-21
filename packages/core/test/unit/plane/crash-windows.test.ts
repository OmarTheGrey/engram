// The crash windows of the store-then-log commits (card E1.4, ADR 0007's
// amendment of 2026-11-19, plane/commit.ts): one case per window between
// "the store was written" (or a record deleted) and "the event was
// appended", in the write path (Plane.write and Plane.changeGrants), the
// offboarding (handover, erasure, sweep, report) and the adapter-delete
// paths (adoption's purge, a stale writer's settling). Each case stops one
// handle at a named failpoint (test/helpers/failpoint.ts, ported from
// EverOS), then opens the next handle on another connection to the same log
// and the same store, as a restarted process does, and shows what it sees
// and that recovery (adoption, or offboarding again) completes: the log
// frees the scope, nothing erased comes back, nothing the store holds is
// unknown to the log, and the store holds what the projection holds.
//
// `crash` is a hard kill: the call that reaches the point and every later
// call through that handle throw, so no catch block of the plane records a
// store failure. `raise` is a transient fault the handle survives. A window
// whose recovery does not complete is pinned as it behaves today, with its
// finding id (E14-F<n>) in the test's name and a `finding` log entry; core is
// not changed by this card.
//
// The first block ports EverOS's own tests of the failpoint modes
// (tests/unit/test_core/test_failpoints.py at the same commit).
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { StoreRef } from "../../../src/adapter.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { allEvents, currentItems, eventsByItem, rebuild } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import { erasureOpen } from "../../../src/plane/commit.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  type OffboardRequest,
  offboard,
  type PlaneDeps,
} from "../../../src/plane.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { Grant, MemoryEvent, MemoryItem } from "../../../src/schema.ts";
import { type Backend, forEachBackend } from "../../db/backends.ts";
import { Crashed, FailpointError, type Failpoints, failpoints } from "../../helpers/failpoint.ts";
import { id, item } from "./helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";
const SECRET = "Dana's sister is Mira.";

const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "role:release"],
  source: "user",
};
const hr: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", "person:dana", "role:release"],
  source: "user",
};
const sam: Actor = { id: "person:sam", level: "person", memberships: ["person:sam"] };
const lee: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", "role:release"],
  source: "user",
};
const toSam: Grant = { to: "person:sam", class: "semantic", mode: "read", expires: UNTIL };
const LEAVE: OffboardRequest = {
  person: "person:dana",
  roles: [{ scope: "role:release", successor: "person:lee" }],
};
const SCOPES = ["person:dana", "role:release"];

// ------------------------------------------------------------ the failpoint helper

describe("the failpoint helper (ported from EverOS's test_failpoints.py)", () => {
  const parts = () => {
    const inner = openSqlite(":memory:");
    migrate(inner);
    const store = createFakeAdapter({ history: false });
    const fp = failpoints();
    return { inner, store, fp, db: fp.db(inner), adapter: fp.adapter(store) };
  };

  test("unarmed, the points change nothing", async () => {
    const { store, db, adapter } = parts();
    const ref = await adapter.write(item(1));
    expect(await adapter.read(ref)).toEqual(await store.read(ref));
    expect(await adapter.list("team:platform")).toHaveLength(1);
    expect(db.transaction(() => 7)).toBe(7);
    await adapter.delete(ref);
    expect(await store.list("team:platform")).toEqual([]);
  });

  test("raise fires the first n times, then the point passes", async () => {
    const { store, fp, adapter } = parts();
    const armed = fp.arm("store.write:before", { raise: 2 });
    for (let k = 0; k < 2; k++)
      await expect(adapter.write(item(1))).rejects.toThrow(FailpointError);
    expect(await store.list("team:platform")).toEqual([]);
    await adapter.write(item(1));
    expect(armed.fired).toBe(2);
    expect(fp.dead).toBe(false);
  });

  test("raise at a commit point rolls the transaction back and leaves the handle alive", () => {
    const { inner, fp, db } = parts();
    fp.arm("commit:before", { raise: 1 });
    expect(() => db.transaction(() => db.exec("CREATE TABLE t (x INTEGER)"))).toThrow(
      FailpointError,
    );
    expect(inner.prepare("SELECT name FROM sqlite_master WHERE name = 't'").get()).toBeUndefined();
    db.transaction(() => db.exec("CREATE TABLE t (x INTEGER)"));
    expect(inner.prepare("SELECT name FROM sqlite_master WHERE name = 't'").get()).toBeDefined();
  });

  test("pause holds the call at the point until released", async () => {
    const { store, fp, adapter } = parts();
    const armed = fp.arm("store.write:after", "pause");
    let done = false;
    const pending = adapter.write(item(1)).then(() => {
      done = true;
    });
    const hit = await armed.arrived;
    expect(hit.item?.id).toBe(id(1));
    expect(await store.list("team:platform")).toHaveLength(1); // the bytes are in
    await Promise.resolve();
    expect(done).toBe(false);
    armed.release();
    await pending;
    expect(done).toBe(true);
  });

  test("skip does not make the store call and returns as if it had", async () => {
    const { store, fp, adapter } = parts();
    const ref = await store.write(item(1));
    fp.arm("store.delete:before", "skip");
    fp.arm("store.read:before", "skip");
    await adapter.delete(ref);
    expect(await store.read(ref)).toBeDefined();
    expect(await adapter.read(ref)).toBeUndefined();
    expect(() => fp.arm("store.write:before", "skip")).toThrow(/skip applies/);
    expect(() => fp.arm("commit:after", "pause")).toThrow(/synchronous/);
  });

  test("crash kills the handle: that call and every later one throws, the store and the log stay as they were", async () => {
    const { inner, store, fp, db, adapter } = parts();
    const stmt = db.prepare("SELECT count(*) AS n FROM events");
    fp.arm("store.write:after", "crash", (hit) => hit.item?.id === id(2));
    await adapter.write(item(1));
    await expect(adapter.write(item(2))).rejects.toThrow(Crashed);
    expect(fp.dead).toBe(true);
    expect(fp.diedAt).toBe("store.write:after");
    await expect(adapter.list("team:platform")).rejects.toThrow(Crashed);
    expect(() => db.prepare("SELECT 1")).toThrow(Crashed);
    expect(() => stmt.get()).toThrow(Crashed);
    expect(() => db.transaction(() => 1)).toThrow(Crashed);
    // What it did before dying stays: both records are in the store.
    expect((await store.list("team:platform")).map((i) => i.id)).toEqual([id(1), id(2)]);
    // Another handle over the same log and store works.
    const next = failpoints();
    expect(await next.adapter(store).list("team:platform")).toHaveLength(2);
    expect(next.db(inner).prepare("SELECT 1 AS one").get()?.one).toBe(1);
  });

  test("a commit point sees the events its transaction appended, and crash before the commit rolls them back", async () => {
    const { inner, store, fp, db, adapter } = parts();
    let n = 0;
    const deps: PlaneDeps = { db, adapter, policy: twin(), newId: () => id(900_000 + ++n) };
    const armed = fp.arm("commit:before", "crash", (hit) =>
      hit.appended.some((e) => e.op === "write" && e.decision === "allow"),
    );
    await expect(
      createPlane(deps).write(dana, item(1, { scope: "person:dana", owner: dana.id }), AT),
    ).rejects.toThrow(Crashed);
    expect((await armed.arrived).appended.map((e) => e.item_id)).toEqual([id(1)]);
    expect(allEvents(inner)).toEqual([]);
    expect(await store.list("person:dana")).toHaveLength(1);
  });
});

// ------------------------------------------------------------ the windows

interface Handle {
  fp: Failpoints;
  deps: PlaneDeps;
  plane: ReturnType<typeof createPlane>;
}

/** One log on two connections and one store; `first` is the handle that stops, `next()` the process after it. */
function world(backend: Backend) {
  const [one, two] = backend.pair();
  migrate(one);
  const store = createFakeAdapter({ history: false });
  const policy = twin();
  let n = 0;
  const open = (conn: Db, from: number): Handle => {
    const fp = failpoints();
    const deps: PlaneDeps = {
      db: fp.db(conn),
      adapter: fp.adapter(store),
      policy,
      newId: () => id(from + ++n),
    };
    return { fp, deps, plane: createPlane(deps) };
  };
  return { log: two, store, policy, first: open(one, 800_000), next: () => open(two, 700_000) };
}
type World = ReturnType<typeof world>;

type Over = Parameters<typeof item>[1];
const person = (n: number, over: Over = {}) =>
  item(n, { scope: "person:dana", owner: dana.id, content: SECRET, ...over } as Over);
const role = (n: number, over: Over = {}) =>
  item(n, {
    scope: "role:release",
    owner: dana.id,
    content: "The release train leaves at 3.",
    ...over,
  } as Over);

async function seed(h: Handle, it: MemoryItem): Promise<MemoryItem> {
  const r = await h.plane.write(dana, it, AT);
  expect(r.event.decision, r.event.reason).toBe("allow");
  return r.item as MemoryItem;
}

const allowedFor = (w: World, itemId: string) =>
  eventsByItem(w.log, itemId).filter((e) => e.decision === "allow");

/** As adoption compares a record with the projection: status and the provenance's kind and actor aside. */
const unsourced = (i: MemoryItem | undefined) =>
  i && { ...i, status: null, provenance: { ...i.provenance, kind: null, actor: null } };

/**
 * Recovery completes: after one adoption of each scope on the next handle,
 * a second appends nothing (a fixed point), every record the store holds is
 * one the log allowed under its id, and every projected item the store
 * holds a record for is that record. Returns the events the first pass appended.
 */
async function recovers(
  w: World,
  h: Handle,
  { at = LATER, grantsLeft = [] as string[] } = {},
): Promise<MemoryEvent[]> {
  const start = allEvents(w.log).length;
  for (const scope of SCOPES) await adoptStoreItems(h.deps, dana, scope, at);
  const first = allEvents(w.log).slice(start);
  const mid = allEvents(w.log).length;
  for (const scope of SCOPES) await adoptStoreItems(h.deps, dana, scope, at);
  expect(
    allEvents(w.log)
      .slice(mid)
      .map((e) => `${e.policy_id}: ${e.reason}`),
    "a second adoption appends nothing",
  ).toEqual([]);
  for (const scope of SCOPES)
    for (const record of await w.store.list(scope)) {
      expect(
        allowedFor(w, record.id).length,
        `the store holds ${record.id}, which the log never allowed`,
      ).toBeGreaterThan(0);
      // grantsLeft: records whose grants the projection dropped and the store keeps (E14-F1).
      const ungranted = (i: MemoryItem | undefined) =>
        i && grantsLeft.includes(i.id) ? { ...unsourced(i), grants: null } : unsourced(i);
      expect(ungranted(record), `the store's record of ${record.id}`).toEqual(
        ungranted(itemById(w.log, record.id)),
      );
    }
  for (const held of currentItems(w.log))
    if (held.store_ref && held.status !== "retired")
      expect(
        await w.store.read(held.store_ref),
        `${held.id} is projected but not in the store`,
      ).toBeDefined();
  return first;
}

/** Nothing erased returns: not projected, rebuilt, stored, read, adopted, or in any event's text. */
async function nothingErasedReturns(w: World, h: Handle, ids: string[], words: string[]) {
  const check = async (when: string) => {
    for (const i of ids) expect(itemById(w.log, i), `${when}: ${i} projected`).toBeUndefined();
    const listed = await w.store.list("person:dana");
    for (const i of ids)
      expect(
        listed.map((r) => r.id),
        `${when}: ${i} in the store`,
      ).not.toContain(i);
    for (const reader of [dana, sam, lee]) {
      const r = await h.plane.read(reader, { at: LATER });
      for (const i of ids)
        expect(
          r.items.map((x) => x.id),
          `${when}: ${reader.id} read ${i}`,
        ).not.toContain(i);
    }
    const text = JSON.stringify([allEvents(w.log), listed]);
    for (const word of words) expect(text, `${when}: the erased word ${word}`).not.toContain(word);
  };
  await check("after recovery");
  rebuild(w.log);
  await check("after a rebuild");
  for (const scope of SCOPES) await adoptStoreItems(h.deps, dana, scope, LATER);
  await check("after another adoption");
}

forEachBackend((backend) => {
  describe("crash windows of the write path", () => {
    test("W1: a writer killed before its store write leaves nothing in the store or the log", async () => {
      const w = world(backend);
      w.first.fp.arm("store.write:before", "crash");
      await expect(w.first.plane.write(dana, person(1), AT)).rejects.toThrow(Crashed);
      const h = w.next();
      expect(allEvents(w.log)).toEqual([]);
      expect(await w.store.list("person:dana")).toEqual([]);
      expect(await recovers(w, h)).toEqual([]);
    });

    test("W2: a first write killed after its store write leaves bytes no event names, unread until adoption records them as import", async () => {
      const w = world(backend);
      w.first.fp.arm("store.write:after", "crash");
      await expect(w.first.plane.write(dana, person(1), AT)).rejects.toThrow(Crashed);
      const h = w.next();
      // Killed, the writer recorded nothing, not even a store failure (decision D6 holds only for a live writer).
      expect(allEvents(w.log)).toEqual([]);
      expect((await w.store.list("person:dana")).map((i) => i.id)).toEqual([id(1)]);
      expect(itemById(w.log, id(1))).toBeUndefined();
      expect((await h.plane.read(dana, { at: LATER })).items).toEqual([]);
      const adopted = await recovers(w, h);
      expect(adopted.map((e) => `${e.decision} ${e.item?.provenance.kind}`)).toEqual([
        "allow import",
      ]);
      expect((await h.plane.read(dana, { at: LATER })).items.map((i) => i.id)).toEqual([id(1)]);
    });

    test("W2b (finding E14-F1): a rewrite adding a grant, killed after its store write, never lets the grantee read; adoption drops the grant from the projection, and the store keeps it", async () => {
      const w = world(backend);
      const v1 = await seed(w.first, person(1));
      w.first.fp.arm("store.write:after", "crash");
      await expect(
        w.first.plane.write(
          dana,
          { ...v1, version: 2, grants: [toSam], store_ref: null } as MemoryItem,
          AT,
        ),
      ).rejects.toThrow(Crashed);
      const h = w.next();
      expect((await w.store.read(v1.store_ref as StoreRef))?.grants).toEqual([toSam]);
      expect(itemById(w.log, id(1))?.grants).toEqual([]);
      expect((await h.plane.read(sam, { at: LATER })).items).toEqual([]);
      const adopted = await recovers(w, h, { grantsLeft: [id(1)] });
      // The record is the plane's item but for a grant the plane never recorded: kept, the grant dropped and named.
      expect(adopted.map((e) => [e.decision, e.item?.grants.length ?? null])).toEqual([
        ["allow", 0],
      ]);
      expect(adopted[0]?.reason).toContain("person:sam");
      expect((await h.plane.read(sam, { at: LATER })).items).toEqual([]);
      // E14-F1, as it stands today: adoption never rewrites the store, so the
      // record keeps the grant the log never recorded, for good.
      expect((await w.store.read(v1.store_ref as StoreRef))?.grants).toEqual([toSam]);
      expect(itemById(w.log, id(1))?.grants).toEqual([]);
    });

    test("W3: a writer killed inside its commit, before it commits, is the same window: bytes and no event", async () => {
      const w = world(backend);
      w.first.fp.arm("commit:before", "crash", (hit) =>
        hit.appended.some((e) => e.op === "write" && e.decision === "allow"),
      );
      await expect(w.first.plane.write(dana, person(1), AT)).rejects.toThrow(Crashed);
      const h = w.next();
      expect(allEvents(w.log)).toEqual([]);
      expect((await w.store.list("person:dana")).map((i) => i.id)).toEqual([id(1)]);
      expect((await recovers(w, h)).map((e) => e.decision)).toEqual(["allow"]);
    });

    test("W4: a writer killed after its commit has nothing to recover", async () => {
      const w = world(backend);
      w.first.fp.arm("commit:after", "crash", (hit) =>
        hit.appended.some((e) => e.op === "write" && e.decision === "allow"),
      );
      await expect(w.first.plane.write(dana, person(1), AT)).rejects.toThrow(Crashed);
      const h = w.next();
      expect(allowedFor(w, id(1))).toHaveLength(1);
      expect((await h.plane.read(dana, { at: LATER })).items.map((i) => i.id)).toEqual([id(1)]);
      expect(await recovers(w, h)).toEqual([]);
    });

    test("W5: a store that fails after persisting leaves one store-failure deny over bytes the next adoption records", async () => {
      const w = world(backend);
      w.first.fp.arm("store.write:after", { raise: 1 });
      await expect(w.first.plane.write(dana, person(1), AT)).rejects.toThrow(FailpointError);
      const h = w.next();
      expect(allEvents(w.log).map((e) => `${e.decision} ${e.policy_id}`)).toEqual([
        "deny engram/write/store-failure",
      ]);
      expect((await w.store.list("person:dana")).map((i) => i.id)).toEqual([id(1)]);
      expect((await h.plane.read(dana, { at: LATER })).items).toEqual([]);
      expect((await recovers(w, h)).map((e) => `${e.decision} ${e.item?.provenance.kind}`)).toEqual(
        ["allow import"],
      );
    });

    test("W6: a commit that fails and rolls back leaves one store-failure deny over bytes the next adoption records", async () => {
      const w = world(backend);
      w.first.fp.arm("commit:before", { raise: 1 }, (hit) =>
        hit.appended.some((e) => e.op === "write" && e.decision === "allow"),
      );
      await expect(w.first.plane.write(dana, person(1), AT)).rejects.toThrow(FailpointError);
      const h = w.next();
      expect(allEvents(w.log).map((e) => `${e.decision} ${e.policy_id}`)).toEqual([
        "deny engram/write/store-failure",
      ]);
      expect((await recovers(w, h)).map((e) => e.decision)).toEqual(["allow"]);
    });

    test("G1 (finding E14-F1): a grant change killed after its store write never lets the grantee read; adoption drops the grant from the projection, and the store keeps it", async () => {
      const w = world(backend);
      const v1 = await seed(w.first, person(1));
      w.first.fp.arm("store.write:after", "crash");
      await expect(w.first.plane.changeGrants(dana, id(1), { add: [toSam] }, AT)).rejects.toThrow(
        Crashed,
      );
      const h = w.next();
      expect(itemById(w.log, id(1))?.grants).toEqual([]);
      expect((await h.plane.read(sam, { at: LATER })).items).toEqual([]);
      const adopted = await recovers(w, h, { grantsLeft: [id(1)] });
      expect(adopted.map((e) => [e.decision, e.item?.grants.length ?? null])).toEqual([
        ["allow", 0],
      ]);
      expect((await h.plane.read(sam, { at: LATER })).items).toEqual([]);
      // E14-F1, as it stands today: the store keeps the grant the log never recorded.
      expect((await w.store.read(v1.store_ref as StoreRef))?.grants).toEqual([toSam]);
    });

    test("G2: a grant removal killed after its store write leaves the grant in force until adoption records the narrower record", async () => {
      const w = world(backend);
      await seed(w.first, person(1, { grants: [toSam] }));
      w.first.fp.arm("store.write:after", "crash");
      await expect(
        w.first.plane.changeGrants(dana, id(1), { remove: [toSam] }, AT),
      ).rejects.toThrow(Crashed);
      const h = w.next();
      // The log never recorded the removal: the grantee still reads, as the log has it.
      expect((await h.plane.read(sam, { at: LATER })).items.map((i) => i.id)).toEqual([id(1)]);
      const adopted = await recovers(w, h);
      expect(adopted.map((e) => [e.decision, e.item?.grants.length ?? null])).toEqual([
        ["allow", 0],
      ]);
      expect((await h.plane.read(sam, { at: LATER })).items).toEqual([]);
    });
  });

  describe("crash windows of the offboarding", () => {
    /** Dana's person item 1 and role item 2, then the offboarding on the first handle, stopped as armed. */
    async function stopped(w: World, arm: (fp: Failpoints) => void, expected: unknown = Crashed) {
      await seed(w.first, person(1));
      await seed(w.first, role(2));
      arm(w.first.fp);
      await expect(offboard(w.first.deps, hr, LEAVE, AT)).rejects.toThrow(
        expected as typeof Crashed,
      );
      return w.next();
    }

    /** Offboarding again on the next handle completes: the scope is free, the role is Lee's, nothing erased returns. */
    async function rerunCompletes(w: World, h: Handle) {
      expect(erasureOpen(w.log, "person:dana"), "frozen until offboarding again").toBe(true);
      const frozen = await h.plane.write(dana, person(3, { content: "A new note." }), LATER);
      expect(frozen.event.policy_id).toBe("engram/offboard/erasing");
      const report = await offboard(h.deps, hr, LEAVE, LATER);
      expect(report.decision).toBe("allow");
      expect(erasureOpen(w.log, "person:dana")).toBe(false);
      expect(itemById(w.log, id(2))?.owner).toBe(lee.id);
      await recovers(w, h);
      await nothingErasedReturns(w, h, [id(1)], ["Mira"]);
      return report;
    }

    test("O1: killed after its begin mark committed, the scope stays frozen until offboarding again", async () => {
      const w = world(backend);
      const h = await stopped(w, (fp) =>
        fp.arm("commit:after", "crash", (hit) =>
          hit.appended.some((e) => e.policy_id === "engram/offboard/begin"),
        ),
      );
      expect(itemById(w.log, id(1))).toBeDefined();
      expect(itemById(w.log, id(2))?.owner).toBe(dana.id);
      await rerunCompletes(w, h);
    });

    test("O2: killed after a handover's store write, the role record is Lee's in the store and Dana's in the log until offboarding again", async () => {
      const w = world(backend);
      const h = await stopped(w, (fp) =>
        fp.arm("store.write:after", "crash", (hit) => hit.item?.scope === "role:release"),
      );
      expect((await w.store.read(itemById(w.log, id(2))?.store_ref as StoreRef))?.owner).toBe(
        lee.id,
      );
      expect(itemById(w.log, id(2))?.owner).toBe(dana.id);
      await rerunCompletes(w, h);
    });

    test("O3: killed after the erasure's first store delete, the rerun finds no record at that ref and says it is not proven deleted", async () => {
      const w = world(backend);
      const h = await stopped(w, (fp) => fp.arm("store.delete:after", "crash"));
      expect(await w.store.list("person:dana")).toEqual([]);
      expect(itemById(w.log, id(1))).toBeDefined(); // the log has not erased it
      const report = await rerunCompletes(w, h);
      expect(report.erased.items).toEqual([id(1)]);
      expect(report.erased.not_found_in_store.map((r) => r.items)).toEqual([[id(1)]]);
    });

    test("O4: killed inside the erasure's commit, after every delete, the rerun erases what the log still holds", async () => {
      const w = world(backend);
      const h = await stopped(w, (fp) =>
        fp.arm("commit:before", "crash", (hit) =>
          hit.appended.some((e) => e.policy_id === "engram/offboard/erase"),
        ),
      );
      expect(itemById(w.log, id(1))).toBeDefined();
      expect(JSON.stringify(allEvents(w.log))).toContain("Mira"); // not redacted yet
      const report = await rerunCompletes(w, h);
      expect(report.erased.items).toEqual([id(1)]);
    });

    test("O5: killed at the sweep's listing, after the erasure committed, the rerun only closes the scope", async () => {
      const w = world(backend);
      const h = await stopped(w, (fp) =>
        fp.arm("store.list:before", "crash", (hit) => hit.scope === "person:dana"),
      );
      expect(itemById(w.log, id(1))).toBeUndefined();
      const report = await rerunCompletes(w, h);
      expect(report.erased.items).toEqual([]);
    });

    test("O6: killed inside the report's commit, the rerun closes the scope", async () => {
      const w = world(backend);
      const h = await stopped(w, (fp) =>
        fp.arm("commit:before", "crash", (hit) =>
          hit.appended.some((e) => e.policy_id === "engram/offboard/report"),
        ),
      );
      expect(itemById(w.log, id(1))).toBeUndefined();
      await rerunCompletes(w, h);
    });

    test("O7: a sweep killed after deleting a never-committed record, before its event, leaves the rerun nothing to sweep", async () => {
      const w = world(backend);
      // A writer killed after its store write leaves a record the log never allowed (W2).
      w.first.fp.arm("store.write:after", "crash");
      await expect(
        w.first.plane.write(dana, person(5, { content: "Mira, again." }), AT),
      ).rejects.toThrow(Crashed);
      const second = w.next();
      await seed(second, person(1));
      await seed(second, role(2));
      second.fp.arm("store.delete:after", "crash", (hit) => hit.ref?.key === id(5));
      await expect(offboard(second.deps, hr, LEAVE, AT)).rejects.toThrow(Crashed);
      const h = w.next();
      expect(eventsByItem(w.log, id(5))).toEqual([]);
      expect((await w.store.list("person:dana")).map((i) => i.id)).toEqual([]);
      await rerunCompletes(w, h);
      await nothingErasedReturns(w, h, [id(1), id(5)], ["Mira"]);
    });

    test("O8: a transient delete failure keeps the item back with one deny; offboarding again erases it", async () => {
      const w = world(backend);
      await seed(w.first, person(1));
      await seed(w.first, role(2));
      w.first.fp.arm("store.delete:before", { raise: 1 });
      const first = await offboard(w.first.deps, hr, LEAVE, AT);
      expect(first.erased.store_failures.map((f) => f.items)).toEqual([[id(1)]]);
      expect(erasureOpen(w.log, "person:dana")).toBe(false);
      expect(itemById(w.log, id(1))).toBeDefined();
      const h = w.next();
      const again = await offboard(h.deps, hr, LEAVE, LATER);
      expect(again.erased.items).toEqual([id(1)]);
      await recovers(w, h);
      await nothingErasedReturns(w, h, [id(1)], ["Mira"]);
    });
  });

  describe("crash windows of the adapter-delete paths", () => {
    /** Dana's person item 1, offboarded on the first handle, then its record put back in the store (a restored copy). */
    async function restored(w: World) {
      const v1 = await seed(w.first, person(1));
      await seed(w.first, role(2));
      await offboard(w.first.deps, hr, LEAVE, AT);
      await w.store.write({ ...v1, store_ref: null } as MemoryItem);
      return v1;
    }

    test("D1: an adoption killed after refusing an erased id's record, before deleting it, leaves the record for the next adoption to delete", async () => {
      const w = world(backend);
      await restored(w);
      w.first.fp.arm("store.delete:before", "crash");
      await expect(adoptStoreItems(w.first.deps, dana, "person:dana", LATER)).rejects.toThrow(
        Crashed,
      );
      const h = w.next();
      expect(
        eventsByItem(w.log, id(1)).filter((e) => e.policy_id === "engram/adopt/erased"),
      ).toHaveLength(1);
      expect((await w.store.list("person:dana")).map((i) => i.id)).toEqual([id(1)]);
      for (const reader of [dana, sam])
        expect((await h.plane.read(reader, { at: LATER })).items.map((i) => i.id)).not.toContain(
          id(1),
        );
      await adoptStoreItems(h.deps, dana, "person:dana", LATER);
      expect(await w.store.list("person:dana")).toEqual([]);
      await nothingErasedReturns(w, h, [id(1)], ["Mira"]);
    });

    test("D2: an adoption killed after deleting an erased id's record has nothing left to do", async () => {
      const w = world(backend);
      await restored(w);
      w.first.fp.arm("store.delete:after", "crash");
      await expect(adoptStoreItems(w.first.deps, dana, "person:dana", LATER)).rejects.toThrow(
        Crashed,
      );
      const h = w.next();
      expect(await w.store.list("person:dana")).toEqual([]);
      await recovers(w, h);
      await nothingErasedReturns(w, h, [id(1)], ["Mira"]);
    });

    test("D3: a purge whose delete fails is recorded once, and the next adoption deletes the record and says so", async () => {
      const w = world(backend);
      await restored(w);
      w.first.fp.arm("store.delete:before", { raise: 1 });
      await adoptStoreItems(w.first.deps, dana, "person:dana", LATER);
      expect(
        eventsByItem(w.log, id(1)).filter((e) => e.policy_id === "engram/write/store-failure"),
      ).toHaveLength(1);
      const h = w.next();
      await adoptStoreItems(h.deps, dana, "person:dana", LATER);
      expect(await w.store.list("person:dana")).toEqual([]);
      await nothingErasedReturns(w, h, [id(1)], ["Mira"]);
    });

    test("D4: a stale rewrite of an erased item, killed before its settling deletes its bytes, is refused and deleted by the next adoption", async () => {
      const w = world(backend);
      const v1 = await seed(w.first, person(1));
      await seed(w.first, role(2));
      const held = w.first.fp.arm("store.write:before", "pause", (hit) => hit.item?.version === 2);
      const pending = w.first.plane.write(
        dana,
        { ...v1, version: 2, content: `${SECRET} Still.`, store_ref: null } as MemoryItem,
        AT,
      );
      await held.arrived;
      const other = w.next();
      await offboard(other.deps, hr, LEAVE, AT); // complete, on the other connection
      w.first.fp.arm("store.delete:before", "crash");
      held.release();
      await expect(pending).rejects.toThrow(Crashed);
      expect((await w.store.list("person:dana")).map((i) => i.content)).toEqual([
        `${SECRET} Still.`,
      ]);
      const h = w.next();
      await adoptStoreItems(h.deps, dana, "person:dana", LATER);
      expect(await w.store.list("person:dana")).toEqual([]);
      await nothingErasedReturns(w, h, [id(1)], ["Mira", "Still"]);
    });

    // A live writer in this window is refused (engram/offboard/erasing, then
    // its settling deletes its bytes: R3 of cross-handle.test.ts). Killed
    // here, it leaves bytes under an id the log never recorded in a person
    // scope whose offboarding has completed, which adoption takes as the
    // person's (V-5; the open question of ADR 0010 that offboard.ts names).
    test("D5 (finding E14-F2): a first write decided before an offboarding and killed before its settling deletes its bytes lands in the offboarded scope at the next adoption", async () => {
      const w = world(backend);
      await seed(w.first, person(1));
      await seed(w.first, role(2));
      const held = w.first.fp.arm("store.write:before", "pause", (hit) => hit.item?.id === id(5));
      const pending = w.first.plane.write(
        dana,
        person(5, { content: "Decided before the offboarding." }),
        AT,
      );
      await held.arrived;
      const other = w.next();
      await offboard(other.deps, hr, LEAVE, AT);
      w.first.fp.arm("store.delete:before", "crash");
      held.release();
      await expect(pending).rejects.toThrow(Crashed);
      const h = w.next();
      expect(eventsByItem(w.log, id(5))).toEqual([]);
      expect((await w.store.list("person:dana")).map((i) => i.id)).toEqual([id(5)]);
      const adopted = await recovers(w, h);
      // E14-F2, as it stands today: the write decided before the offboarding lands after it.
      expect(adopted.map((e) => `${e.item_id} ${e.decision} ${e.item?.provenance.kind}`)).toEqual([
        `${id(5)} allow import`,
      ]);
      expect((await h.plane.read(dana, { at: LATER })).items.map((i) => i.content)).toContain(
        "Decided before the offboarding.",
      );
    });
  });
});
