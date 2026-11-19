// Card E2.6: every store-then-log commit holds under the log's lock, against
// a writer or an offboarding on another handle over the same log (another
// process, in the dogfood: `engram serve` beside an `engram read`). Each test
// opens two handles on one log and one store, pauses one side at a store
// call, runs the other side in that window, then checks that an erased item
// never returns (projection, rebuild, store, reads, adoption) and that a
// committed decision is never silently undone. R1 to R9 are the verifier's
// reproductions from PR #44 (the verification of card E9.4); R10 onwards are
// the orderings this card found besides. A refusal is one deny event with a
// reason and a policy id (AGENTS.md rule 3), and the store is put back.
//
// The sync-gap tests (retain, adoption) hook the first transaction a handle
// opens, to commit on the other handle exactly between a decision read
// outside the lock and its commit: two processes can interleave there,
// although one process's synchronous code cannot.
import { readFileSync } from "node:fs";
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import type { Adapter, StoreRef } from "../../../src/adapter.ts";
import type { Db } from "../../../src/db/db.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { allEvents, appendEvent, ERASURE_ID, eventsByItem, rebuild } from "../../../src/events.ts";
import { itemById } from "../../../src/items.ts";
import {
  type Actor,
  adoptStoreItems,
  createPlane,
  HANDOVER_ID,
  offboard,
  type PlaneDeps,
} from "../../../src/plane.ts";
import { parsePolicy } from "../../../src/policy/load.ts";
import type { Grant, MemoryItem } from "../../../src/schema.ts";
import { visibleEvents } from "../../../src/visible.ts";
import { type Backend, forEachBackend } from "../../db/backends.ts";
import { id, item } from "./helpers.ts";

const PROFILE = new URL("../../../../pi-package/profiles/twin.yaml", import.meta.url);
const twin = () => parsePolicy(readFileSync(PROFILE, "utf8"), "twin.yaml");
const AT = "2026-11-19T10:00:00Z";
const LATER = "2026-11-19T11:00:00Z";
const UNTIL = "2026-12-19T00:00:00Z";
const SECRET = "Dana's sister is Mira.";

const WRITE_CONFLICT = "engram/write/conflict";
const GRANT_CONFLICT = "engram/grant/conflict";
const PROMOTE_CONFLICT = "engram/promote/conflict";
const HANDOVER_CONFLICT = "engram/offboard/conflict";
const ERASING = "engram/offboard/erasing";

const dana: Actor = {
  id: "person:dana",
  level: "person",
  memberships: ["person:dana", "role:release", "team:x"],
  source: "user",
};
const hr: Actor = {
  id: "person:hr",
  level: "person",
  memberships: ["person:hr", "person:dana", "role:release"],
  source: "user",
};
const sam: Actor = {
  id: "person:sam",
  level: "person",
  memberships: ["person:sam"],
  source: "user",
};
const lee: Actor = {
  id: "person:lee",
  level: "person",
  memberships: ["person:lee", "role:release", "team:x"],
  source: "user",
};
const toSam: Grant = { to: "person:sam", class: "semantic", mode: "read", expires: UNTIL };
const toLee: Grant = { ...toSam, to: "person:lee" };

type Method = "write" | "delete" | "list" | "read";
interface Pause {
  /** Resolves when the paused call arrives. */
  arrived: Promise<void>;
  release(): void;
}

/**
 * One handle's view of the shared store: `pause(method, when)` holds the next
 * call of that method before or after it reaches the store, until released.
 */
function pausable(store: Adapter) {
  const armed = new Map<string, { arrive: () => void; gate: Promise<void> }>();
  const at = async (method: Method, when: "before" | "after") => {
    const key = `${method}:${when}`;
    const hold = armed.get(key);
    if (!hold) return;
    armed.delete(key);
    hold.arrive();
    await hold.gate;
  };
  const adapter: Adapter = Object.assign(Object.create(store) as Adapter, {
    write: async (it: MemoryItem) => {
      await at("write", "before");
      const ref = await store.write(it);
      await at("write", "after");
      return ref;
    },
    delete: async (ref: StoreRef) => {
      await at("delete", "before");
      await store.delete(ref);
      await at("delete", "after");
    },
    list: async (scope: string) => {
      await at("list", "before");
      const listed = await store.list(scope);
      await at("list", "after");
      return listed;
    },
    read: async (ref: StoreRef) => {
      await at("read", "before");
      const got = await store.read(ref);
      await at("read", "after");
      return got;
    },
  });
  const pause = (method: Method, when: "before" | "after" = "before"): Pause => {
    let arrive = () => {};
    let release = () => {};
    const arrived = new Promise<void>((r) => {
      arrive = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    armed.set(`${method}:${when}`, { arrive, gate });
    return { arrived, release };
  };
  return { adapter, pause };
}

/**
 * The handle `db`, whose next outermost transaction first runs `hook`: what
 * another process commits between a decision read outside the lock and the
 * commit that follows it.
 */
function hooked(db: Db) {
  let hook: (() => void) | null = null;
  let depth = 0;
  const wrapped: Db = {
    dialect: db.dialect,
    exec: (sql) => db.exec(sql),
    prepare: (sql) => db.prepare(sql),
    transaction<T>(fn: () => T): T {
      if (depth === 0 && hook) {
        const h = hook;
        hook = null;
        h();
      }
      depth++;
      try {
        return db.transaction(fn);
      } finally {
        depth--;
      }
    },
    close: () => db.close(),
  };
  return { db: wrapped, onNextTransaction: (h: () => void) => (hook = h) };
}

function setup(backend: Backend) {
  const [mine, theirs] = backend.pair();
  migrate(mine);
  const store = createFakeAdapter({ history: false });
  const a = pausable(store);
  const b = pausable(store);
  const hook = hooked(mine);
  let n = 0;
  const policy = twin();
  const depsMine: PlaneDeps = {
    db: hook.db,
    adapter: a.adapter,
    policy,
    newId: () => id(800_000 + ++n),
  };
  const depsTheirs: PlaneDeps = {
    db: theirs,
    adapter: b.adapter,
    policy,
    newId: () => id(700_000 + ++n),
  };
  return {
    mine,
    theirs,
    store,
    a,
    b,
    hook,
    depsMine,
    depsTheirs,
    plane: createPlane(depsMine),
    planeTheirs: createPlane(depsTheirs),
    newTheirsId: () => id(700_000 + ++n),
  };
}
type Env = ReturnType<typeof setup>;

async function seedPerson(env: Env, grants: Grant[] = []) {
  const r = await env.plane.write(
    dana,
    item(1, { scope: "person:dana", owner: dana.id, content: SECRET, grants }),
    AT,
  );
  expect(r.event.decision).toBe("allow");
  return r.item as MemoryItem;
}

async function seedRole(env: Env, grants: Grant[] = []) {
  const r = await env.plane.write(
    dana,
    item(2, {
      scope: "role:release",
      owner: dana.id,
      content: "The release train leaves at 3.",
      grants,
    }),
    AT,
  );
  expect(r.event.decision).toBe("allow");
  return r.item as MemoryItem;
}

/** Offboards Dana on the other handle: her person scope erased, nothing handed over. */
const offboardTheirs = (env: Env) =>
  offboard(env.depsTheirs, hr, { person: "person:dana", roles: [] }, AT);

/**
 * Nothing of item 1 (erased with person:dana) is anywhere: projection, store,
 * a rebuild, a read by the grantee or the owner, before and after the next
 * adoption, or any event's text.
 */
async function nothingErasedReturns(env: Env) {
  expect(itemById(env.mine, id(1))).toBeUndefined();
  expect((await env.store.list("person:dana")).map((i) => i.content)).toEqual([]);
  rebuild(env.mine);
  expect(itemById(env.mine, id(1))).toBeUndefined();
  expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
  await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
  expect(itemById(env.mine, id(1))).toBeUndefined();
  expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
  expect((await env.plane.read(dana, { at: LATER })).items.map((i) => i.id)).not.toContain(id(1));
  expect(JSON.stringify(allEvents(env.mine))).not.toContain("Mira");
}

/** The store holds exactly the projected item, as the log has it. */
async function storeMatches(env: Env, itemId: string) {
  const now = itemById(env.mine, itemId) as MemoryItem;
  expect(now).toBeDefined();
  expect(await env.store.read(now.store_ref as StoreRef)).toEqual(now);
  return now;
}

/** The allowed events of an item, as `<policy_id>:v<version>`. */
const allowedVersions = (env: Env, itemId: string) =>
  eventsByItem(env.mine, itemId)
    .filter((e) => e.decision === "allow" && e.item)
    .map((e) => `${e.policy_id}:v${e.item?.version}`);

forEachBackend((backend) => {
  describe("an erasure on another handle", () => {
    test("R1: a grant change held at its store write while an offboarding completes is refused, and the store record deleted", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const w = env.a.pause("write");
      const change = env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
      await w.arrived;
      await offboardTheirs(env);
      w.release();
      const r = await change;
      expect(r).toMatchObject({ decision: "deny", item: null });
      expect(r.event.policy_id).toBe(GRANT_CONFLICT);
      await nothingErasedReturns(env);
    });

    test("R2: an offboarding slow to commit after deleting the record refuses a grant change in that window", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const d = env.b.pause("delete", "after");
      const off = offboardTheirs(env);
      await d.arrived;
      const r = await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
      expect(r).toMatchObject({ decision: "deny", item: null });
      expect(r.event.policy_id).toBe(ERASING);
      expect(r.event.reason).toMatch(/person:dana is being erased/);
      d.release();
      expect((await off).erased.items).toEqual([id(1)]);
      await nothingErasedReturns(env);
    });

    test("R2: ... and an owner's rewrite and an adoption in that window", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      const d = env.b.pause("delete", "after");
      const off = offboardTheirs(env);
      await d.arrived;
      const w = await env.plane.write(
        dana,
        { ...seeded, version: 2, grants: [toSam], store_ref: null } as MemoryItem,
        AT,
      );
      expect(w.event).toMatchObject({ decision: "deny", policy_id: ERASING });
      expect(w.item).toBeNull();
      const fresh = await env.plane.write(
        dana,
        item(5, { scope: "person:dana", owner: dana.id, content: "Mira visits in May." }),
        AT,
      );
      expect(fresh.event).toMatchObject({ decision: "deny", policy_id: ERASING });
      await adoptStoreItems(env.depsMine, dana, "person:dana", AT);
      d.release();
      await off;
      await nothingErasedReturns(env);
      expect(itemById(env.mine, id(5))).toBeUndefined();
    });

    test("R3: an owner's rewrite held at its store write while an offboarding completes is refused, and nothing comes back", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      const w = env.a.pause("write");
      const pending = env.plane.write(
        dana,
        { ...seeded, version: 2, grants: [toSam], store_ref: null } as MemoryItem,
        AT,
      );
      await w.arrived;
      await offboardTheirs(env);
      w.release();
      const r = await pending;
      expect(r.item).toBeNull();
      expect(r.event).toMatchObject({ decision: "deny", policy_id: WRITE_CONFLICT });
      expect(r.event.reason).toMatch(/erased or removed/);
      await nothingErasedReturns(env);
    });

    test("R3: a first write into the person scope held while an offboarding completes is refused", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const w = env.a.pause("write");
      const pending = env.plane.write(
        dana,
        item(5, { scope: "person:dana", owner: dana.id, content: "Mira visits in May." }),
        AT,
      );
      await w.arrived;
      await offboardTheirs(env);
      w.release();
      const r = await pending;
      expect(r.event).toMatchObject({ decision: "deny", policy_id: WRITE_CONFLICT });
      expect(itemById(env.mine, id(5))).toBeUndefined();
      await nothingErasedReturns(env);
    });

    test("R9b: a promotion to a new version held at its store write while the offboarding erases its source leaves nothing", async () => {
      const env = setup(backend);
      const w0 = await env.plane.write(
        dana,
        item(3, {
          scope: "person:dana",
          owner: dana.id,
          class: "episodic",
          content: "Mira came for lunch.",
        }),
        AT,
      );
      expect(w0.event.decision).toBe("allow");
      const w = env.a.pause("write");
      const pending = env.plane.promote(hr, id(3), "person:dana", AT, { review: true });
      await w.arrived;
      await offboardTheirs(env);
      w.release();
      const r = await pending;
      expect(r).toMatchObject({ decision: "deny", item: null });
      expect(r.event.policy_id).toBe(PROMOTE_CONFLICT);
      expect(await env.store.list("person:dana")).toEqual([]);
      rebuild(env.mine);
      expect(
        allEvents(env.mine).filter((e) => e.op === "promote" && e.decision === "allow"),
      ).toEqual([]);
      expect(JSON.stringify(allEvents(env.mine))).not.toContain("Mira");
    });

    test("R10: an adoption that listed the store before an offboarding on another handle does not bring the erased item back", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const l = env.a.pause("list", "after");
      const adopting = adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      await l.arrived;
      await offboardTheirs(env);
      l.release();
      const report = await adopting;
      expect(report.allowed).toBe(0);
      await nothingErasedReturns(env);
    });

    test("R13: an adoption whose decision another process's erasure overtakes before its commit adopts nothing", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      // Dana edits the record by hand, so adoption gates it again.
      await env.store.write({
        ...seeded,
        content: `${SECRET} Edited.`,
        store_ref: null,
      } as MemoryItem);
      env.hook.onNextTransaction(() => {
        appendEvent(env.theirs, {
          id: env.newTheirsId(),
          ts: AT,
          op: "retire",
          item_id: id(1),
          actor: hr.id,
          scope_from: "person:dana",
          scope_to: null,
          decision: "allow",
          reason: "erased with person:dana at offboarding (simulated commit of another process)",
          policy_id: ERASURE_ID,
          schema_version: 1,
        });
      });
      const report = await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(report.allowed).toBe(0);
      expect(itemById(env.mine, id(1))).toBeUndefined();
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
      expect((await env.plane.read(dana, { at: LATER })).items).toEqual([]);
    });

    test("R13: a retention sweep whose decision another process's erasure overtakes appends nothing about the erased item", async () => {
      const env = setup(backend);
      const w0 = await env.plane.write(
        dana,
        item(3, {
          scope: "person:dana",
          owner: dana.id,
          class: "episodic",
          content: "lunch with Mira",
          ttl: 60,
        }),
        AT,
      );
      expect(w0.event.decision).toBe("allow");
      let erasedAt = -1;
      env.hook.onNextTransaction(() => {
        erasedAt = appendEvent(env.theirs, {
          id: env.newTheirsId(),
          ts: AT,
          op: "retire",
          item_id: id(3),
          actor: hr.id,
          scope_from: "person:dana",
          scope_to: null,
          decision: "allow",
          reason: "erased with person:dana at offboarding (simulated commit of another process)",
          policy_id: ERASURE_ID,
          schema_version: 1,
        }).seq;
      });
      const report = await env.plane.retain(dana, "person:dana", LATER);
      expect(erasedAt).toBeGreaterThan(0);
      expect(report.expired).toEqual([]);
      expect(eventsByItem(env.mine, id(3)).filter((e) => e.seq > erasedAt)).toEqual([]);
    });
  });

  describe("an erased id", () => {
    test("a record under an erased id that reappears in the store (a write that was in flight, a restored copy) is never adopted", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      await offboardTheirs(env);
      await env.store.write({ ...seeded, version: 2, store_ref: null } as MemoryItem);
      const report = await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(report).toMatchObject({ allowed: 0, denied: 1 });
      expect(report.denials[0]?.policy_id).toBe("engram/adopt/erased");
      expect(report.denials[0]?.reason).not.toContain("Mira");
      expect(itemById(env.mine, id(1))).toBeUndefined();
      expect((await env.plane.read(dana, { at: LATER })).items).toEqual([]);
      // Denied once for that record; the next adoption appends nothing.
      const n = allEvents(env.mine).length;
      expect((await adoptStoreItems(env.depsMine, dana, "person:dana", LATER)).unchanged).toBe(1);
      expect(allEvents(env.mine)).toHaveLength(n);
    });

    test("a write under an erased id is refused, and the refusal names the erased scope only to its members", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      await offboardTheirs(env);
      const again = { ...seeded, version: 1, store_ref: null } as MemoryItem;
      const r = await env.plane.write(dana, again, LATER);
      expect(r.item).toBeNull();
      expect(r.event).toMatchObject({ decision: "deny", policy_id: "engram/write/erased" });
      expect(r.event.reason).toMatch(/erased with person:dana/);
      expect((await env.plane.checkWrite(dana, again, LATER)).policy_id).toBe(
        "engram/write/erased",
      );
      const outsider: Actor = { ...lee, memberships: ["person:lee", "team:x"] };
      const elsewhere = { ...again, scope: "team:x", owner: lee.id } as MemoryItem;
      const o = await env.plane.write(outsider, elsewhere, LATER);
      expect(o.event.policy_id).toBe("engram/write/erased");
      expect(o.event.reason).not.toMatch(/person:dana/);
      expect(await env.store.list("person:dana")).toEqual([]);
      expect(itemById(env.mine, id(1))).toBeUndefined();
    });
  });

  describe("a committed decision on another handle", () => {
    test("R4: a handover held at its store write while the owner removes a grant keeps the removal and hands over the new version", async () => {
      const env = setup(backend);
      await seedRole(env, [toSam]);
      expect((await env.plane.read(sam, { at: LATER })).items.map((i) => i.id)).toEqual([id(2)]);
      const w = env.b.pause("write");
      const off = offboard(
        env.depsTheirs,
        hr,
        { person: "person:dana", roles: [{ scope: "role:release", successor: "person:lee" }] },
        AT,
      );
      await w.arrived;
      const r = await env.plane.changeGrants(dana, id(2), { remove: [toSam] }, AT);
      expect(r.decision).toBe("allow");
      w.release();
      const report = await off;
      expect(report.handover).toEqual([
        { scope: "role:release", successor: "person:lee", items: [id(2)] },
      ]);
      const now = await storeMatches(env, id(2));
      expect(now).toMatchObject({ owner: "person:lee", grants: [], version: 3 });
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
      expect(allowedVersions(env, id(2))).toEqual([
        "profile.twin/write/role:v1",
        "engram/grant/change:v2",
        `${HANDOVER_ID}:v3`,
      ]);
      const conflict = report.events.filter((e) => e.policy_id === HANDOVER_CONFLICT);
      expect(conflict).toHaveLength(1);
      expect(conflict[0]).toMatchObject({ decision: "deny", item_id: id(2) });
    });

    test("R5: a grant change held while another grant change commits is refused, and the store holds the projection", async () => {
      const env = setup(backend);
      await seedPerson(env, [toSam]);
      const w = env.a.pause("write");
      const pending = env.plane.changeGrants(dana, id(1), { add: [toLee] }, AT);
      await w.arrived;
      expect(
        (await env.planeTheirs.changeGrants(dana, id(1), { remove: [toSam] }, AT)).decision,
      ).toBe("allow");
      w.release();
      const r = await pending;
      expect(r.event.policy_id).toBe(GRANT_CONFLICT);
      const now = await storeMatches(env, id(1));
      expect(now.grants).toEqual([]);
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
    });

    test("R6: a grant change held while the other handle adopts a hand-edited record leaves the store and the projection alike", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      await env.store.write({
        ...seeded,
        content: "Dana edited this.",
        store_ref: null,
      } as MemoryItem);
      const w = env.a.pause("write");
      const pending = env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
      await w.arrived;
      await adoptStoreItems(env.depsTheirs, dana, "person:dana", AT);
      w.release();
      await pending;
      await storeMatches(env, id(1));
    });

    test("R7: a grant change held while a sweep retires the item is refused, and the grantee reads nothing", async () => {
      const env = setup(backend);
      const w0 = await env.plane.write(
        dana,
        item(3, {
          scope: "person:dana",
          owner: dana.id,
          class: "episodic",
          content: "lunch with Mira",
          ttl: 60,
        }),
        AT,
      );
      expect(w0.event.decision).toBe("allow");
      const w = env.a.pause("write");
      const toSamEp = { ...toSam, class: "episodic" as const };
      const pending = env.plane.changeGrants(dana, id(3), { add: [toSamEp] }, AT);
      await w.arrived;
      expect((await env.planeTheirs.retain(dana, "person:dana", LATER)).expired).toEqual([id(3)]);
      w.release();
      expect((await pending).event.policy_id).toBe(GRANT_CONFLICT);
      const now = await storeMatches(env, id(3));
      expect(now).toMatchObject({ status: "retired", grants: [] });
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
    });

    test("R8: the conflict's deny event carries a reason and a policy id, no item, and is not shown to the grantee", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const w = env.a.pause("write");
      const pending = env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
      await w.arrived;
      await offboardTheirs(env);
      w.release();
      const { event } = await pending;
      expect(event).toMatchObject({ decision: "deny", policy_id: GRANT_CONFLICT });
      expect(event.reason.length).toBeGreaterThan(0);
      expect(event.item).toBeUndefined();
      const view = { policy: twin(), at: LATER, current: (i: string) => itemById(env.mine, i) };
      const seenBy = (who: Actor) =>
        visibleEvents(who, allEvents(env.mine), view).filter((e) => e.id === event.id).length;
      expect(seenBy(sam)).toBe(0);
      expect(seenBy(lee)).toBe(0);
      expect(seenBy(dana)).toBe(1);
    });

    test("R9: an in-place promotion held at its store write while the owner removes a grant keeps the removal", async () => {
      const env = setup(backend);
      const toSamT = { ...toSam };
      const w0 = await env.plane.write(
        dana,
        item(4, {
          scope: "team:x",
          owner: dana.id,
          content: "deploys are on Friday",
          grants: [toSamT],
        }),
        AT,
      );
      expect(w0.item?.status).toBe("candidate");
      const w = env.b.pause("write");
      const pending = env.planeTheirs.promote(lee, id(4), "team:x", AT, { review: true });
      await w.arrived;
      expect((await env.plane.changeGrants(dana, id(4), { remove: [toSamT] }, AT)).decision).toBe(
        "allow",
      );
      w.release();
      const r = await pending;
      expect(r).toMatchObject({ decision: "deny", item: null });
      expect(r.event.policy_id).toBe(PROMOTE_CONFLICT);
      const now = await storeMatches(env, id(4));
      expect(now).toMatchObject({ grants: [], status: "candidate", version: 2 });
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
    });

    test("R9: the same promotion with no race lands (control)", async () => {
      const env = setup(backend);
      await env.plane.write(
        dana,
        item(4, { scope: "team:x", owner: dana.id, content: "deploys are on Friday" }),
        AT,
      );
      const r = await env.planeTheirs.promote(lee, id(4), "team:x", AT, { review: true });
      expect(r.decision).toBe("allow");
      expect((await storeMatches(env, id(4))).status).toBe("active");
    });

    test("R11: an adoption that listed the store before a grant change on another handle does not retire the changed item", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const l = env.a.pause("list", "after");
      const adopting = adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      await l.arrived;
      expect((await env.planeTheirs.changeGrants(dana, id(1), { add: [toSam] }, AT)).decision).toBe(
        "allow",
      );
      l.release();
      await adopting;
      const now = await storeMatches(env, id(1));
      expect(now).toMatchObject({ status: "active", grants: [toSam] });
      expect((await env.plane.read(sam, { at: LATER })).items.map((i) => i.id)).toEqual([id(1)]);
    });

    test("R12: a stale grant change whose repair lands after a newer change committed does not leave the store behind the log", async () => {
      const env = setup(backend);
      await seedPerson(env);
      const w1 = env.b.pause("write");
      const stale = env.planeTheirs.changeGrants(dana, id(1), { add: [toLee] }, AT);
      await w1.arrived;
      expect((await env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT)).decision).toBe(
        "allow",
      );
      const w2 = env.b.pause("write");
      w1.release();
      await w2.arrived;
      // The stale change found its conflict and is putting the store back.
      const removal = await env.plane.changeGrants(dana, id(1), { remove: [toSam] }, AT);
      expect(removal.decision).toBe("allow");
      w2.release();
      expect((await stale).event.policy_id).toBe(GRANT_CONFLICT);
      const now = await storeMatches(env, id(1));
      expect(now.grants).toEqual([]);
      await adoptStoreItems(env.depsMine, dana, "person:dana", LATER);
      expect(itemById(env.mine, id(1))).toMatchObject({ status: "active", grants: [] });
      expect((await env.plane.read(sam, { at: LATER })).items).toEqual([]);
    });

    test("R14: a grant change held while the other handle rewrites the item is refused", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      const w = env.a.pause("write");
      const pending = env.plane.changeGrants(dana, id(1), { add: [toSam] }, AT);
      await w.arrived;
      const rewrite = await env.planeTheirs.write(
        dana,
        {
          ...seeded,
          version: 2,
          content: "Dana's sister lives in Oslo.",
          store_ref: null,
        } as MemoryItem,
        AT,
      );
      expect(rewrite.event.decision).toBe("allow");
      w.release();
      expect((await pending).event.policy_id).toBe(GRANT_CONFLICT);
      const now = await storeMatches(env, id(1));
      expect(now).toMatchObject({ grants: [], content: "Dana's sister lives in Oslo." });
    });

    test("R15: an owner's rewrite held while a grant change commits on the other handle is refused, keeping the grant", async () => {
      const env = setup(backend);
      const seeded = await seedPerson(env);
      const w = env.a.pause("write");
      const pending = env.plane.write(
        dana,
        {
          ...seeded,
          version: 2,
          content: "Dana's sister lives in Oslo.",
          store_ref: null,
        } as MemoryItem,
        AT,
      );
      await w.arrived;
      expect((await env.planeTheirs.changeGrants(dana, id(1), { add: [toSam] }, AT)).decision).toBe(
        "allow",
      );
      w.release();
      const r = await pending;
      expect(r.item).toBeNull();
      expect(r.event).toMatchObject({ decision: "deny", policy_id: WRITE_CONFLICT });
      const now = await storeMatches(env, id(1));
      expect(now).toMatchObject({ grants: [toSam], content: SECRET });
    });
  });
});
